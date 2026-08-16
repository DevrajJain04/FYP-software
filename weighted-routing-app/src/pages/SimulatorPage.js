import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  submitTelemetry, 
  submitBatchTelemetry, 
  getIngestionStats,
  triggerAQIFetch,
  checkBackendHealth 
} from '../services/backendService';

/**
 * SimulatorPage - Hidden developer tool for testing telemetry ingestion
 * Access via /dev/simulator
 */

// Custom vehicle marker
const vehicleIcon = L.divIcon({
  className: 'vehicle-marker',
  html: `<div style="
    background: #3b82f6;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  ">🚗</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Map click handler
const MapClickHandler = ({ onMapClick, clickEnabled }) => {
  useMapEvents({
    click: (e) => {
      if (clickEnabled) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const SimulatorPage = () => {
  // Backend status
  const [backendStatus, setBackendStatus] = useState({
    routing: false,
    ingestion: false,
    scraper: false,
  });

  // Single telemetry state
  const [vehicleId, setVehicleId] = useState('dev-vehicle-001');
  const [latitude, setLatitude] = useState(19.0760);
  const [longitude, setLongitude] = useState(72.8777);
  const [aqi, setAqi] = useState(75);
  const [clickToPlace, setClickToPlace] = useState(false);

  // Batch simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationInterval, setSimulationInterval] = useState(2000);
  const [simulationPath, setSimulationPath] = useState([]);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);
  const [simulationLog, setSimulationLog] = useState([]);

  // Stats
  const [ingestionStats, setIngestionStats] = useState(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [lastSubmission, setLastSubmission] = useState(null);

  // Refs
  const simulationRef = useRef(null);

  // Check backend health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await checkBackendHealth();
        setBackendStatus({
          routing: health.routing.healthy,
          ingestion: health.ingestion.healthy,
          scraper: health.scraper.healthy,
        });
      } catch (err) {
        console.error('Health check failed:', err);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ingestion stats
  const fetchStats = async () => {
    try {
      const stats = await getIngestionStats();
      setIngestionStats(stats);
    } catch (err) {
      console.warn('Could not fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Log helper
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setSimulationLog(prev => [{
      timestamp,
      message,
      type,
    }, ...prev.slice(0, 99)]); // Keep last 100 logs
  };

  // Handle map click to set location
  const handleMapClick = (lat, lng) => {
    if (clickToPlace) {
      setLatitude(parseFloat(lat.toFixed(6)));
      setLongitude(parseFloat(lng.toFixed(6)));
      setClickToPlace(false);
      addLog(`Location set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');
    } else {
      // Add to simulation path
      setSimulationPath(prev => [...prev, { lat, lng }]);
      addLog(`Added waypoint to path: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');
    }
  };

  // Submit single telemetry
  const handleSubmitTelemetry = async () => {
    if (!backendStatus.ingestion) {
      addLog('Ingestion service offline!', 'error');
      return;
    }

    try {
      const response = await submitTelemetry(vehicleId, latitude, longitude, aqi);
      setSubmissionCount(prev => prev + 1);
      setLastSubmission(new Date());
      addLog(`✓ Telemetry submitted: ${vehicleId} @ (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) AQI=${aqi}`, 'success');
      addLog(`  Hexagon: ${response.hexagon_id || 'unknown'}`, 'info');
      fetchStats();
    } catch (err) {
      addLog(`✗ Submission failed: ${err.message}`, 'error');
    }
  };

  // Start path simulation
  const startSimulation = () => {
    if (simulationPath.length < 2) {
      addLog('Need at least 2 waypoints for simulation', 'error');
      return;
    }

    setIsSimulating(true);
    setCurrentPathIndex(0);
    addLog(`Starting simulation with ${simulationPath.length} waypoints`, 'info');

    let index = 0;
    simulationRef.current = setInterval(async () => {
      if (index >= simulationPath.length) {
        // Loop back to start
        index = 0;
        addLog('Simulation path completed, looping...', 'info');
      }

      const point = simulationPath[index];
      const currentAqi = aqi + (Math.random() - 0.5) * 20; // Add some variation

      try {
        await submitTelemetry(vehicleId, point.lat, point.lng, Math.max(0, Math.min(500, currentAqi)));
        setCurrentPathIndex(index);
        setLatitude(point.lat);
        setLongitude(point.lng);
        setSubmissionCount(prev => prev + 1);
        addLog(`✓ [${index + 1}/${simulationPath.length}] ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`, 'success');
      } catch (err) {
        addLog(`✗ Submission failed at waypoint ${index}: ${err.message}`, 'error');
      }

      index++;
    }, simulationInterval);
  };

  // Stop simulation
  const stopSimulation = () => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
    setIsSimulating(false);
    addLog('Simulation stopped', 'info');
  };

  // Clear path
  const clearPath = () => {
    setSimulationPath([]);
    setCurrentPathIndex(0);
    addLog('Path cleared', 'info');
  };

  // Generate random path
  const generateRandomPath = () => {
    const points = [];
    let lat = latitude;
    let lng = longitude;
    
    for (let i = 0; i < 10; i++) {
      lat += (Math.random() - 0.5) * 0.01;
      lng += (Math.random() - 0.5) * 0.01;
      points.push({ lat, lng });
    }
    
    setSimulationPath(points);
    addLog(`Generated random path with ${points.length} waypoints`, 'info');
  };

  // Trigger AQI scraper fetch
  const handleTriggerScraper = async () => {
    try {
      await triggerAQIFetch();
      addLog('Triggered AQI scraper fetch', 'success');
    } catch (err) {
      addLog(`Scraper trigger failed: ${err.message}`, 'error');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, []);

  return (
    <div className="page simulator-page">
      <div className="simulator-header">
        <h1>🔧 Vehicle Telemetry Simulator</h1>
        <p className="dev-warning">
          ⚠️ Developer Tool - This page is hidden from regular users
        </p>
      </div>

      {/* Backend Status Bar */}
      <div className="backend-status-bar">
        <span className={`status-pill ${backendStatus.routing ? 'online' : 'offline'}`}>
          Routing: {backendStatus.routing ? '●' : '○'}
        </span>
        <span className={`status-pill ${backendStatus.ingestion ? 'online' : 'offline'}`}>
          Ingestion: {backendStatus.ingestion ? '●' : '○'}
        </span>
        <span className={`status-pill ${backendStatus.scraper ? 'online' : 'offline'}`}>
          Scraper: {backendStatus.scraper ? '●' : '○'}
        </span>
        <span className="stats-pill">
          Submissions: {submissionCount}
        </span>
      </div>

      <div className="simulator-layout">
        {/* Left Panel - Controls */}
        <aside className="simulator-controls">
          {/* Single Submission */}
          <section className="control-section">
            <h3>📡 Single Telemetry</h3>
            
            <div className="form-group">
              <label>Vehicle ID</label>
              <input
                type="text"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                placeholder="dev-vehicle-001"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <button
              className={`btn btn-secondary btn-sm ${clickToPlace ? 'active' : ''}`}
              onClick={() => setClickToPlace(!clickToPlace)}
            >
              {clickToPlace ? '📍 Click on map...' : '📍 Pick from Map'}
            </button>

            <div className="form-group">
              <label>AQI Value: {aqi}</label>
              <input
                type="range"
                min="0"
                max="500"
                value={aqi}
                onChange={(e) => setAqi(parseInt(e.target.value))}
              />
              <div className="aqi-scale">
                <span style={{ color: '#22c55e' }}>Good</span>
                <span style={{ color: '#f59e0b' }}>Moderate</span>
                <span style={{ color: '#ef4444' }}>Unhealthy</span>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSubmitTelemetry}
              disabled={!backendStatus.ingestion}
            >
              📤 Submit Telemetry
            </button>
          </section>

          {/* Path Simulation */}
          <section className="control-section">
            <h3>🛣️ Path Simulation</h3>
            <p className="hint">Click on map to add waypoints</p>

            <div className="path-info">
              <span>{simulationPath.length} waypoints</span>
              {isSimulating && (
                <span className="simulating-badge">
                  🔄 Running ({currentPathIndex + 1}/{simulationPath.length})
                </span>
              )}
            </div>

            <div className="form-group">
              <label>Interval (ms): {simulationInterval}</label>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={simulationInterval}
                onChange={(e) => setSimulationInterval(parseInt(e.target.value))}
                disabled={isSimulating}
              />
            </div>

            <div className="btn-group">
              {!isSimulating ? (
                <button
                  className="btn btn-success"
                  onClick={startSimulation}
                  disabled={simulationPath.length < 2 || !backendStatus.ingestion}
                >
                  ▶ Start
                </button>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={stopSimulation}
                >
                  ⏹ Stop
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={generateRandomPath}
                disabled={isSimulating}
              >
                🎲 Random Path
              </button>
              <button
                className="btn btn-secondary"
                onClick={clearPath}
                disabled={isSimulating}
              >
                🗑️ Clear
              </button>
            </div>
          </section>

          {/* Scraper Controls */}
          <section className="control-section">
            <h3>🌡️ AQI Scraper</h3>
            <button
              className="btn btn-secondary"
              onClick={handleTriggerScraper}
              disabled={!backendStatus.scraper}
            >
              🔄 Trigger Fetch
            </button>
          </section>

          {/* Stats */}
          {ingestionStats && (
            <section className="control-section">
              <h3>📊 Ingestion Stats</h3>
              <div className="stats-display">
                {Object.entries(ingestionStats).map(([key, value]) => (
                  <div key={key} className="stat-row">
                    <span className="stat-key">{key}:</span>
                    <span className="stat-value">{String(value)}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-sm btn-secondary" onClick={fetchStats}>
                🔄 Refresh Stats
              </button>
            </section>
          )}
        </aside>

        {/* Map */}
        <div className="simulator-map">
          <MapContainer
            center={[latitude, longitude]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapClickHandler 
              onMapClick={handleMapClick} 
              clickEnabled={true} 
            />

            {/* Current position marker */}
            <Marker position={[latitude, longitude]} icon={vehicleIcon}>
              <Popup>
                <strong>{vehicleId}</strong><br />
                AQI: {aqi}<br />
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </Popup>
            </Marker>

            {/* Simulation path */}
            {simulationPath.length > 0 && (
              <>
                <Polyline
                  positions={simulationPath.map(p => [p.lat, p.lng])}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '10, 5',
                  }}
                />
                {simulationPath.map((point, idx) => (
                  <Marker
                    key={idx}
                    position={[point.lat, point.lng]}
                    icon={L.divIcon({
                      className: 'waypoint-marker',
                      html: `<div style="
                        background: ${idx === currentPathIndex && isSimulating ? '#22c55e' : '#6b7280'};
                        color: white;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        border: 2px solid white;
                      ">${idx + 1}</div>`,
                      iconSize: [20, 20],
                      iconAnchor: [10, 10],
                    })}
                  >
                    <Popup>Waypoint {idx + 1}</Popup>
                  </Marker>
                ))}
              </>
            )}
          </MapContainer>
        </div>

        {/* Log Panel */}
        <aside className="simulator-log">
          <h3>📜 Activity Log</h3>
          <div className="log-entries">
            {simulationLog.length === 0 ? (
              <div className="log-empty">No activity yet</div>
            ) : (
              simulationLog.map((log, idx) => (
                <div key={idx} className={`log-entry log-${log.type}`}>
                  <span className="log-time">{log.timestamp}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))
            )}
          </div>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setSimulationLog([])}
          >
            Clear Log
          </button>
        </aside>
      </div>
    </div>
  );
};

export default SimulatorPage;
