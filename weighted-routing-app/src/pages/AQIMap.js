import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { getAreaAQI, getScrapedStations, isBackendAvailable } from '../services/backendService';

/**
 * AQIMap - Real-time air quality heatmap visualization
 */

// Map bounds handler
const MapBoundsHandler = ({ onBoundsChange }) => {
  const map = useMap();
  
  useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    },
    zoomend: () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    },
  });

  // Get initial bounds
  useEffect(() => {
    const bounds = map.getBounds();
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [map, onBoundsChange]);

  return null;
};

// AQI color mapping
const getAQIColor = (aqi) => {
  if (aqi <= 50) return '#22c55e';   // Good - Green
  if (aqi <= 100) return '#84cc16';  // Moderate - Yellow-green
  if (aqi <= 150) return '#f59e0b';  // USG - Orange
  if (aqi <= 200) return '#ef4444';  // Unhealthy - Red
  if (aqi <= 300) return '#7c2d12';  // Very Unhealthy - Brown
  return '#4a044e';                   // Hazardous - Purple
};

const getAQILabel = (aqi) => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

// Hexagon component
const HexagonOverlay = ({ hexagons }) => {
  if (!hexagons || hexagons.length === 0) return null;

  return (
    <>
      {hexagons.map((hex) => {
        const color = getAQIColor(hex.median_aqi);
        return (
          <Circle
            key={hex.hexagon_id}
            center={[hex.center.lat, hex.center.lng]}
            radius={150} // ~150m radius for H3 res 9
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.4,
              weight: 1,
              opacity: 0.6,
            }}
          >
            <Popup>
              <div className="hex-popup">
                <strong>Hexagon AQI</strong>
                <div 
                  className="aqi-value"
                  style={{ backgroundColor: color, color: 'white' }}
                >
                  {Math.round(hex.median_aqi)}
                </div>
                <div className="aqi-label">{getAQILabel(hex.median_aqi)}</div>
                <div className="hex-details">
                  <span>📡 {hex.vehicle_count} vehicle(s)</span>
                  <span className="hex-id">{hex.hexagon_id.substring(0, 10)}...</span>
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
};

// Station markers
const StationMarkers = ({ stations, showStations }) => {
  if (!showStations || !stations || stations.length === 0) return null;

  return (
    <>
      {stations.map((station, idx) => {
        const color = getAQIColor(station.aqi || 50);
        return (
          <Circle
            key={station.h3_index || idx}
            center={[station.latitude, station.longitude]}
            radius={300}
            pathOptions={{
              color: '#1f2937',
              fillColor: color,
              fillOpacity: 0.7,
              weight: 2,
              opacity: 1,
            }}
          >
            <Popup>
              <div className="station-popup">
                <strong>{station.location || 'Monitoring Station'}</strong>
                <div 
                  className="aqi-value"
                  style={{ backgroundColor: color, color: 'white' }}
                >
                  {Math.round(station.aqi || 0)}
                </div>
                <div className="aqi-label">{getAQILabel(station.aqi || 0)}</div>
                <div className="station-details">
                  <span>📍 {station.city || station.country || 'Unknown'}</span>
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
};

const AQIMap = () => {
  const [hexagons, setHexagons] = useState([]);
  const [stations, setStations] = useState([]);
  const [bounds, setBounds] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null);

  // Display options
  const [showHexagons, setShowHexagons] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Check backend on mount
  useEffect(() => {
    const checkBackend = async () => {
      const available = await isBackendAvailable();
      setBackendOnline(available);
    };
    checkBackend();
  }, []);

  // Fetch AQI data for current bounds
  const fetchAQIData = useCallback(async () => {
    if (!bounds || !backendOnline) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch hexagon data
      if (showHexagons) {
        const areaData = await getAreaAQI(bounds);
        setHexagons(areaData.hexagons || []);
      }

      // Fetch station data
      if (showStations) {
        try {
          const stationData = await getScrapedStations();
          // Filter stations within bounds (backend returns latitude/longitude)
          const filteredStations = (stationData || []).filter(s => 
            s.latitude >= bounds.south && s.latitude <= bounds.north &&
            s.longitude >= bounds.west && s.longitude <= bounds.east
          );
          setStations(filteredStations);
        } catch (e) {
          console.warn('Could not fetch stations:', e);
        }
      }

      setLastFetch(new Date());
    } catch (err) {
      console.error('Error fetching AQI data:', err);
      setError(err.message || 'Failed to fetch AQI data');
    } finally {
      setIsLoading(false);
    }
  }, [bounds, backendOnline, showHexagons, showStations]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchAQIData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchAQIData]);

  // Handle bounds change
  const handleBoundsChange = useCallback((newBounds) => {
    setBounds(newBounds);
  }, []);

  return (
    <div className="page aqi-map-page">
      <div className="aqi-map-layout">
        {/* Controls Sidebar */}
        <aside className="aqi-controls">
          <h2>🗺️ AQI Heatmap</h2>
          <p className="control-description">
            Real-time air quality visualization from vehicle sensors and monitoring stations.
          </p>

          {/* Backend Status */}
          {backendOnline === false && (
            <div className="warning-banner">
              ⚠️ Backend offline. Cannot fetch live AQI data.
            </div>
          )}

          {/* Fetch Button */}
          <section className="control-section">
            <button
              className="btn btn-primary btn-large"
              onClick={fetchAQIData}
              disabled={isLoading || !backendOnline || !bounds}
            >
              {isLoading ? (
                <>
                  <span className="spinner-sm"></span>
                  Loading...
                </>
              ) : (
                <>🔄 Fetch AQI Data</>
              )}
            </button>

            {lastFetch && (
              <p className="last-fetch">
                Last updated: {lastFetch.toLocaleTimeString()}
              </p>
            )}
          </section>

          {/* Display Options */}
          <section className="control-section">
            <h3>Display Options</h3>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showHexagons}
                onChange={(e) => setShowHexagons(e.target.checked)}
              />
              <span>Show Vehicle Telemetry (Hexagons)</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showStations}
                onChange={(e) => setShowStations(e.target.checked)}
              />
              <span>Show Monitoring Stations</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh (30s)</span>
            </label>
          </section>

          {/* Stats */}
          <section className="control-section">
            <h3>Data Summary</h3>
            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-number">{hexagons.length}</span>
                <span className="stat-text">Hexagons</span>
              </div>
              <div className="stat-box">
                <span className="stat-number">{stations.length}</span>
                <span className="stat-text">Stations</span>
              </div>
              <div className="stat-box">
                <span className="stat-number">
                  {hexagons.length > 0 
                    ? Math.round(hexagons.reduce((sum, h) => sum + h.median_aqi, 0) / hexagons.length)
                    : '--'}
                </span>
                <span className="stat-text">Avg AQI</span>
              </div>
            </div>
          </section>

          {/* Error Display */}
          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Legend */}
          <section className="control-section">
            <h3>Legend</h3>
            <div className="aqi-legend-vertical">
              <div className="legend-row">
                <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
                <span>0-50: Good</span>
              </div>
              <div className="legend-row">
                <span className="legend-color" style={{ backgroundColor: '#84cc16' }}></span>
                <span>51-100: Moderate</span>
              </div>
              <div className="legend-row">
                <span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span>
                <span>101-150: Unhealthy (Sensitive)</span>
              </div>
              <div className="legend-row">
                <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
                <span>151-200: Unhealthy</span>
              </div>
              <div className="legend-row">
                <span className="legend-color" style={{ backgroundColor: '#7c2d12' }}></span>
                <span>201-300: Very Unhealthy</span>
              </div>
              <div className="legend-row">
                <span className="legend-color" style={{ backgroundColor: '#4a044e' }}></span>
                <span>301+: Hazardous</span>
              </div>
            </div>
          </section>

          {/* Instructions */}
          <section className="control-section">
            <h3>How to Use</h3>
            <ol className="instructions-list">
              <li>Pan and zoom the map to your area of interest</li>
              <li>Click "Fetch AQI Data" to load data for visible area</li>
              <li>Click on hexagons or stations for details</li>
              <li>Enable auto-refresh for live updates</li>
            </ol>
          </section>
        </aside>

        {/* Map Area */}
        <main className="aqi-map-container">
          {isLoading && (
            <div className="map-loading-overlay">
              <div className="spinner"></div>
              <span>Fetching AQI data...</span>
            </div>
          )}

          <MapContainer
            center={[19.0760, 72.8777]} // Mumbai
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapBoundsHandler onBoundsChange={handleBoundsChange} />
            
            {showHexagons && <HexagonOverlay hexagons={hexagons} />}
            {showStations && <StationMarkers stations={stations} showStations={showStations} />}
          </MapContainer>

          {/* Data source indicator */}
          <div className="data-source-indicator">
            {showHexagons && hexagons.length > 0 && (
              <span className="source-badge hexagon">🚗 Vehicle Data</span>
            )}
            {showStations && stations.length > 0 && (
              <span className="source-badge station">📍 Station Data</span>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AQIMap;
