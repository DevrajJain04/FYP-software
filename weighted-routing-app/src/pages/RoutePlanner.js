import React, { useState, useCallback, useEffect, useRef } from 'react';
import MapComponent from '../components/MapComponent';
import DirectionsPanel from '../components/DirectionsPanel';
import LocationSearch, { reverseGeocode } from '../components/LocationSearch';
import { calculateRoute, getDetailedRoute, isBackendAvailable } from '../services/backendService';

/**
 * RoutePlanner - Main routing interface with button-driven interactions
 */
const RoutePlanner = () => {
  // Location state
  const [startCoords, setStartCoords] = useState([19.0760, 72.8777]); // Mumbai Central
  const [endCoords, setEndCoords] = useState([19.0178, 72.8478]);     // Dadar
  const [startName, setStartName] = useState('Mumbai Central');
  const [endName, setEndName] = useState('Dadar, Mumbai');

  // Route preferences
  const [balance, setBalance] = useState(0.5);
  const [numAlternatives, setNumAlternatives] = useState(3);
  const [wantNavigation, setWantNavigation] = useState(true);

  // Routes state
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clickMode, setClickMode] = useState(null);
  const [showDirections, setShowDirections] = useState(true);
  const [backendOnline, setBackendOnline] = useState(null);

  // Track if route needs recalculation (dirty state)
  const [isDirty, setIsDirty] = useState(true);

  // Check backend on mount
  useEffect(() => {
    const checkBackend = async () => {
      const available = await isBackendAvailable();
      setBackendOnline(available);
    };
    checkBackend();
  }, []);

  // Mark as dirty when inputs change
  useEffect(() => {
    setIsDirty(true);
  }, [startCoords, endCoords, balance, numAlternatives, wantNavigation]);

  /**
   * Calculate routes - ONLY triggered by button click
   */
  const handleCalculateRoute = async () => {
    if (!startCoords || !endCoords) {
      setError('Please select both start and end locations');
      return;
    }

    // Check if same location
    const distance = Math.sqrt(
      Math.pow(startCoords[0] - endCoords[0], 2) +
      Math.pow(startCoords[1] - endCoords[1], 2)
    );
    if (distance < 0.0001) {
      setError('Start and end locations are too close');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const origin = { lat: startCoords[0], lng: startCoords[1] };
      const destination = { lat: endCoords[0], lng: endCoords[1] };

      let response;
      
      if (wantNavigation) {
        // Use detailed endpoint for turn-by-turn navigation
        response = await getDetailedRoute(origin, destination, balance);
        
        if (response && response.route_id) {
          // Single detailed route
          const route = convertDetailedRoute(response, 0);
          setRoutes([route]);
          setSelectedRouteIndex(0);
        } else {
          throw new Error('No route returned from server');
        }
      } else {
        // Use regular endpoint for multiple alternatives
        response = await calculateRoute(origin, destination, balance, numAlternatives);
        
        if (response && response.routes && response.routes.length > 0) {
          const processedRoutes = response.routes.map((route, index) => 
            convertBackendRoute(route, index)
          );
          
          // Sort by weighted cost and assign colors
          processedRoutes.sort((a, b) => a.weightedCost - b.weightedCost);
          const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
          const labels = ['Best Route', 'Alternative 1', 'Alternative 2', 'Alternative 3', 'Alternative 4'];
          
          processedRoutes.forEach((route, idx) => {
            route.color = colors[idx] || '#6b7280';
            route.label = labels[idx] || `Alternative ${idx}`;
            route.isBest = idx === 0;
          });

          setRoutes(processedRoutes);
          setSelectedRouteIndex(0);
        } else {
          throw new Error('No routes found between these locations');
        }
      }

      setIsDirty(false);
    } catch (err) {
      console.error('Route calculation error:', err);
      setError(err.message || 'Failed to calculate route. Is the backend running?');
      setRoutes([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Convert backend route format to frontend format
   */
  const convertBackendRoute = (backendRoute, index) => {
    // Coordinates are [lng, lat] from backend, need [lat, lng] for Leaflet
    const coordinates = backendRoute.coordinates.map(coord => [coord[1], coord[0]]);
    
    return {
      index,
      route_id: backendRoute.route_id,
      geometry: coordinates,
      coordinates: coordinates,
      distance: backendRoute.total_distance_m,
      duration: backendRoute.total_duration_s,
      averageAQI: backendRoute.average_aqi,
      maxAQI: backendRoute.max_aqi,
      weightedCost: backendRoute.weighted_cost,
      steps: backendRoute.steps || [],
      metadata: backendRoute.metadata || {},
      source: 'backend',
    };
  };

  /**
   * Convert detailed route (with navigation) to frontend format
   */
  const convertDetailedRoute = (detailedRoute, index) => {
    const coordinates = detailedRoute.coordinates.map(coord => [coord[1], coord[0]]);
    
    // Process navigation steps if available
    let steps = [];
    if (detailedRoute.navigation && detailedRoute.navigation.steps) {
      steps = detailedRoute.navigation.steps.map(step => ({
        instruction: step.instruction,
        distance: step.distance_m,
        duration: step.duration_s,
        type: step.maneuver_type,
        name: step.road_name,
      }));
    }

    return {
      index,
      route_id: detailedRoute.route_id,
      geometry: coordinates,
      coordinates: coordinates,
      distance: detailedRoute.total_distance_m,
      duration: detailedRoute.total_duration_s,
      averageAQI: detailedRoute.average_aqi,
      maxAQI: detailedRoute.max_aqi,
      weightedCost: detailedRoute.weighted_cost,
      steps: steps,
      hasNavigation: !!detailedRoute.navigation,
      navigationWarnings: detailedRoute.navigation?.warnings || [],
      metadata: detailedRoute.metadata || {},
      source: 'backend',
      color: '#22c55e',
      label: 'Optimal Route',
      isBest: true,
    };
  };

  /**
   * Handle map click for setting locations
   */
  const handleMapClick = async (coords, mode) => {
    const activeMode = mode || clickMode;
    if (!activeMode || !coords) return;

    const name = await reverseGeocode(coords[0], coords[1]);

    if (activeMode === 'start') {
      setStartCoords(coords);
      setStartName(name);
    } else if (activeMode === 'end') {
      setEndCoords(coords);
      setEndName(name);
    }

    // Reset click mode after map click (not after drag)
    if (!mode) {
      setClickMode(null);
    }
  };

  /**
   * Swap start and end locations
   */
  const handleSwapLocations = () => {
    const tempCoords = startCoords;
    const tempName = startName;
    setStartCoords(endCoords);
    setStartName(endName);
    setEndCoords(tempCoords);
    setEndName(tempName);
  };

  /**
   * Clear all routes
   */
  const handleClearRoutes = () => {
    setRoutes([]);
    setSelectedRouteIndex(0);
    setError(null);
    setIsDirty(true);
  };

  // Get balance label
  const getBalanceLabel = (val) => {
    if (val <= 0.2) return 'Fastest';
    if (val <= 0.4) return 'Speed Priority';
    if (val <= 0.6) return 'Balanced';
    if (val <= 0.8) return 'Air Quality Priority';
    return 'Cleanest Air';
  };

  // Format helpers
  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  };

  const formatDistance = (meters) => {
    if (!meters) return '--';
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  const getAQIClass = (aqi) => {
    if (!aqi) return '';
    if (aqi <= 50) return 'aqi-good';
    if (aqi <= 100) return 'aqi-moderate';
    if (aqi <= 150) return 'aqi-unhealthy-sensitive';
    return 'aqi-unhealthy';
  };

  const selectedRoute = routes[selectedRouteIndex];

  return (
    <div className="page route-planner-page">
      <div className="planner-layout">
        {/* Left Panel - Controls */}
        <aside className="planner-controls">
          {/* Backend Status */}
          {backendOnline === false && (
            <div className="warning-banner">
              ⚠️ Backend offline. Route calculation unavailable.
            </div>
          )}

          {/* Location Inputs */}
          <section className="control-section">
            <h3>📍 Locations</h3>
            
            <LocationSearch
              label="Start"
              placeholder="Select starting point..."
              value={startName}
              onChange={setStartName}
              onCoordinateChange={setStartCoords}
              icon="A"
              iconColor="#22c55e"
              onClickModeChange={setClickMode}
              currentClickMode={clickMode}
              clickMode="start"
            />

            <button 
              className="btn btn-icon swap-btn"
              onClick={handleSwapLocations}
              title="Swap locations"
            >
              ⇅
            </button>

            <LocationSearch
              label="End"
              placeholder="Select destination..."
              value={endName}
              onChange={setEndName}
              onCoordinateChange={setEndCoords}
              icon="B"
              iconColor="#ef4444"
              onClickModeChange={setClickMode}
              currentClickMode={clickMode}
              clickMode="end"
            />

            {clickMode && (
              <div className="click-hint">
                👆 Click on the map to set {clickMode === 'start' ? 'starting point' : 'destination'}
                <button className="btn-link" onClick={() => setClickMode(null)}>Cancel</button>
              </div>
            )}
          </section>

          {/* Route Preferences */}
          <section className="control-section">
            <h3>⚙️ Preferences</h3>

            {/* Balance Slider */}
            <div className="preference-item">
              <label>
                Route Priority
                <span className="preference-value">{getBalanceLabel(balance)}</span>
              </label>
              <div className="balance-slider-container">
                <span className="slider-label-left">⏱️ Fast</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={balance}
                  onChange={(e) => setBalance(parseFloat(e.target.value))}
                  className="slider balance-slider"
                />
                <span className="slider-label-right">🌿 Clean</span>
              </div>
              <div className="balance-presets">
                <button 
                  className={`preset-btn ${balance === 0 ? 'active' : ''}`}
                  onClick={() => setBalance(0)}
                >
                  Fastest
                </button>
                <button 
                  className={`preset-btn ${balance === 0.5 ? 'active' : ''}`}
                  onClick={() => setBalance(0.5)}
                >
                  Balanced
                </button>
                <button 
                  className={`preset-btn ${balance === 1 ? 'active' : ''}`}
                  onClick={() => setBalance(1)}
                >
                  Greenest
                </button>
              </div>
            </div>

            {/* Turn-by-turn Navigation Toggle */}
            <div className="preference-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={wantNavigation}
                  onChange={(e) => setWantNavigation(e.target.checked)}
                />
                <span>Include turn-by-turn navigation</span>
              </label>
              <p className="preference-hint">
                {wantNavigation 
                  ? 'Returns 1 detailed route with directions'
                  : `Returns up to ${numAlternatives} route alternatives`}
              </p>
            </div>

            {/* Alternatives (only when not wanting navigation) */}
            {!wantNavigation && (
              <div className="preference-item">
                <label>
                  Alternatives
                  <span className="preference-value">{numAlternatives}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={numAlternatives}
                  onChange={(e) => setNumAlternatives(parseInt(e.target.value))}
                  className="slider"
                />
              </div>
            )}
          </section>

          {/* Action Buttons */}
          <section className="control-section actions-section">
            <button
              className={`btn btn-primary btn-large ${isDirty ? 'pulse' : ''}`}
              onClick={handleCalculateRoute}
              disabled={isLoading || !backendOnline}
            >
              {isLoading ? (
                <>
                  <span className="spinner-sm"></span>
                  Calculating...
                </>
              ) : (
                <>🧭 Calculate Route</>
              )}
            </button>

            {routes.length > 0 && (
              <button 
                className="btn btn-secondary"
                onClick={handleClearRoutes}
              >
                ✕ Clear Routes
              </button>
            )}
          </section>

          {/* Error Display */}
          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Route Results */}
          {routes.length > 0 && (
            <section className="control-section routes-section">
              <h3>🛣️ Routes ({routes.length})</h3>
              <div className="route-list">
                {routes.map((route, idx) => (
                  <div
                    key={route.route_id || idx}
                    className={`route-card ${selectedRouteIndex === idx ? 'selected' : ''}`}
                    onClick={() => setSelectedRouteIndex(idx)}
                  >
                    <div 
                      className="route-color-bar"
                      style={{ backgroundColor: route.color }}
                    />
                    <div className="route-card-content">
                      <div className="route-card-header">
                        <span className="route-label">
                          {route.isBest && '⭐ '}{route.label}
                        </span>
                        {route.hasNavigation && <span className="nav-badge">📍</span>}
                      </div>
                      <div className="route-stats">
                        <span>📏 {formatDistance(route.distance)}</span>
                        <span>⏱️ {formatDuration(route.duration)}</span>
                        <span className={getAQIClass(route.averageAQI)}>
                          💨 {Math.round(route.averageAQI)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* Map Area */}
        <main className="planner-map">
          {isLoading && (
            <div className="map-loading-overlay">
              <div className="spinner"></div>
              <span>Finding optimal routes...</span>
            </div>
          )}

          <MapComponent
            startCoords={startCoords}
            endCoords={endCoords}
            routes={routes}
            selectedRouteIndex={selectedRouteIndex}
            onRouteSelect={setSelectedRouteIndex}
            clickMode={clickMode}
            onMapClick={handleMapClick}
          />

          {/* Floating Directions Panel */}
          {selectedRoute && selectedRoute.steps && selectedRoute.steps.length > 0 && (
            <div className={`floating-panel ${showDirections ? 'open' : 'collapsed'}`}>
              <button
                className="panel-toggle"
                onClick={() => setShowDirections(!showDirections)}
              >
                {showDirections ? '◀ Hide' : '▶ Directions'}
              </button>
              {showDirections && (
                <DirectionsPanel
                  steps={selectedRoute.steps}
                  totalDistance={selectedRoute.distance}
                  totalDuration={selectedRoute.duration}
                  averageAQI={selectedRoute.averageAQI}
                  routeColor={selectedRoute.color}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* AQI Legend */}
      <div className="aqi-legend-bar">
        <span className="legend-title">Air Quality:</span>
        <span className="legend-item aqi-good">● Good (0-50)</span>
        <span className="legend-item aqi-moderate">● Moderate (51-100)</span>
        <span className="legend-item aqi-unhealthy-sensitive">● Sensitive (101-150)</span>
        <span className="legend-item aqi-unhealthy">● Unhealthy (151+)</span>
      </div>
    </div>
  );
};

export default RoutePlanner;
