/**
 * Green Corridor Backend Service
 * Unified API client for all backend microservices
 * 
 * This service handles communication with the Green Corridor backend:
 * - Routing Service (8000): AQI-aware route calculation
 * - Ingestion Service (8080): Vehicle telemetry data submission
 * - AQI Scraper Service (8082): Fallback AQI data from monitoring stations
 * 
 * NOTE: This service does NOT fallback to ORS. All routing goes through
 * the backend which internally uses ORS for detailed navigation.
 */

const ROUTING_API = process.env.REACT_APP_ROUTING_API_URL || 'http://localhost:8000';
const INGESTION_API = process.env.REACT_APP_INGESTION_API_URL || 'http://localhost:8080';
const SCRAPER_API = process.env.REACT_APP_AQI_SCRAPER_URL || 'http://localhost:8082';

// Request timeout in ms
const REQUEST_TIMEOUT = 30000;

/**
 * Helper to create fetch with timeout
 */
const fetchWithTimeout = async (url, options = {}, timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

// ============ ROUTING SERVICE ============

/**
 * Calculate route with AQI-aware pathfinding
 * @param {Object} origin - { lat: number, lng: number }
 * @param {Object} destination - { lat: number, lng: number }
 * @param {number} balance - 0 (fastest) to 1 (cleanest air), default 0.5
 * @param {number} alternatives - Number of alternative routes (1-5)
 * @returns {Promise<Object>} Route response with alternatives
 */
export async function calculateRoute(origin, destination, balance = 0.5, alternatives = 3) {
  const response = await fetchWithTimeout(`${ROUTING_API}/api/v1/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      balance,
      alternatives,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Route calculation failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Calculate route with turn-by-turn navigation (detailed endpoint)
 * Uses backend's ORS integration for navigation instructions
 * @param {Object} origin - { lat: number, lng: number }
 * @param {Object} destination - { lat: number, lng: number }
 * @param {number} balance - 0 (fastest) to 1 (cleanest air)
 * @returns {Promise<Object>} Detailed route with navigation steps
 */
export async function getDetailedRoute(origin, destination, balance = 0.5) {
  const response = await fetchWithTimeout(`${ROUTING_API}/api/v1/route/detailed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      balance,
      alternatives: 1, // Detailed endpoint returns single best route
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Detailed route calculation failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get navigation for an existing route
 * @param {Array} routeCoordinates - Route coordinates [lng, lat]
 * @param {Object} origin - { lat, lng }
 * @param {Object} destination - { lat, lng }
 * @param {string} profile - 'driving-car', 'cycling-regular', 'foot-walking'
 * @returns {Promise<Object>} Navigation response with turn-by-turn steps
 */
export async function getNavigation(routeCoordinates, origin, destination, profile = 'driving-car') {
  const response = await fetchWithTimeout(`${ROUTING_API}/api/v1/navigation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      route_coordinates: routeCoordinates,
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      profile,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Navigation failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get AQI data for a specific H3 hexagon
 * @param {string} hexId - H3 hexagon ID
 * @returns {Promise<Object>} Hexagon AQI data
 */
export async function getHexagonAQI(hexId) {
  const response = await fetchWithTimeout(`${ROUTING_API}/api/v1/aqi/hexagon/${hexId}`);
  if (!response.ok) {
    throw new Error(`Hexagon AQI fetch failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Get AQI data for all hexagons within a bounding box (for heatmap visualization)
 * @param {Object} bounds - { north, south, east, west }
 * @returns {Promise<Object>} Area AQI data with hexagons
 */
export async function getAreaAQI(bounds) {
  const response = await fetchWithTimeout(`${ROUTING_API}/api/v1/aqi/area`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
    }),
  });

  if (!response.ok) {
    console.warn('Area AQI fetch failed, returning empty data');
    return { hexagons: [] };
  }

  return response.json();
}

/**
 * Get routing service statistics
 * @returns {Promise<Object>} Service stats
 */
export async function getServiceStats() {
  const response = await fetchWithTimeout(`${ROUTING_API}/api/v1/stats`);
  if (!response.ok) {
    throw new Error(`Stats fetch failed: ${response.status}`);
  }
  return response.json();
}

// ============ INGESTION SERVICE ============

/**
 * Submit single vehicle telemetry reading
 * @param {string} vehicleId - Vehicle identifier
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} aqi - AQI reading from sensor
 * @returns {Promise<Object>} Ingestion response with hexagon_id
 */
export async function submitTelemetry(vehicleId, lat, lng, aqi) {
  const response = await fetchWithTimeout(`${INGESTION_API}/api/v1/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicle_id: vehicleId,
      latitude: lat,
      longitude: lng,
      aqi,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Telemetry submission failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Submit batch of telemetry readings
 * @param {Array} dataArray - Array of telemetry objects
 * @returns {Promise<Object>} Batch ingestion response
 */
export async function submitBatchTelemetry(dataArray) {
  const response = await fetchWithTimeout(`${INGESTION_API}/api/v1/telemetry/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: dataArray }),
  });

  if (!response.ok) {
    throw new Error(`Batch telemetry submission failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get ingestion service statistics
 * @returns {Promise<Object>} Ingestion statistics
 */
export async function getIngestionStats() {
  const response = await fetchWithTimeout(`${INGESTION_API}/api/v1/stats`);
  if (!response.ok) {
    throw new Error(`Stats fetch failed: ${response.status}`);
  }
  return response.json();
}

// ============ SCRAPER SERVICE ============

/**
 * Get all AQI monitoring stations
 * @returns {Promise<Array>} Array of station objects
 */
export async function getScrapedStations() {
  const response = await fetchWithTimeout(`${SCRAPER_API}/stations`);
  if (!response.ok) {
    throw new Error(`Stations fetch failed: ${response.status}`);
  }
  const data = await response.json();
  // API returns { count, stations, last_fetch } - extract the stations array
  return data.stations || [];
}

/**
 * Find nearest AQI monitoring station
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Nearest station data
 */
export async function getNearestStation(lat, lng) {
  const response = await fetchWithTimeout(`${SCRAPER_API}/nearest?lat=${lat}&lng=${lng}`);
  if (!response.ok) {
    throw new Error(`Nearest station fetch failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Trigger manual AQI data fetch from scraper
 * @returns {Promise<Object>} Fetch response
 */
export async function triggerAQIFetch() {
  const response = await fetchWithTimeout(`${SCRAPER_API}/fetch`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`AQI fetch trigger failed: ${response.status}`);
  }
  return response.json();
}

// ============ HEALTH CHECKS ============

/**
 * Check health status of all backend services
 * @returns {Promise<Object>} Health status for each service
 */
export async function checkBackendHealth() {
  const results = {
    routing: { healthy: false, error: null },
    ingestion: { healthy: false, error: null },
    scraper: { healthy: false, error: null },
  };

  // Check routing service
  try {
    const r1 = await fetchWithTimeout(`${ROUTING_API}/health`, {}, 5000);
    results.routing.healthy = r1.ok;
  } catch (err) {
    results.routing.error = err.name === 'AbortError' ? 'Timeout' : err.message;
  }

  // Check ingestion service
  try {
    const r2 = await fetchWithTimeout(`${INGESTION_API}/api/v1/health`, {}, 5000);
    results.ingestion.healthy = r2.ok;
  } catch (err) {
    results.ingestion.error = err.name === 'AbortError' ? 'Timeout' : err.message;
  }

  // Check scraper service
  try {
    const r3 = await fetchWithTimeout(`${SCRAPER_API}/health`, {}, 5000);
    results.scraper.healthy = r3.ok;
  } catch (err) {
    results.scraper.error = err.name === 'AbortError' ? 'Timeout' : err.message;
  }

  return results;
}

/**
 * Check if backend routing service is available
 * @returns {Promise<boolean>} True if backend is available
 */
export async function isBackendAvailable() {
  try {
    const response = await fetchWithTimeout(`${ROUTING_API}/health`, {}, 3000);
    return response.ok;
  } catch {
    return false;
  }
}

// ============ UTILITY FUNCTIONS ============

/**
 * Convert backend route format to frontend format
 * @param {Object} backendRoute - Route from backend API
 * @param {number} index - Route index
 * @returns {Object} Route in frontend format
 */
export function convertBackendRoute(backendRoute, index = 0) {
  // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
  const geometry = backendRoute.coordinates.map(coord => [coord[1], coord[0]]);

  return {
    index,
    route_id: backendRoute.route_id,
    geometry,
    coordinates: geometry,
    distance: backendRoute.total_distance_m,
    duration: backendRoute.total_duration_s,
    averageAQI: backendRoute.average_aqi,
    maxAQI: backendRoute.max_aqi,
    weightedCost: backendRoute.weighted_cost,
    steps: backendRoute.steps || [],
    metadata: backendRoute.metadata || {},
    found: true,
    source: 'backend',
    // Enhanced AQI fields
    avgAqiWeighted: backendRoute.avg_aqi_weighted,
    exposureScore: backendRoute.exposure_score,
    timeInAqiBands: backendRoute.time_in_aqi_bands,
    aqiMetadata: backendRoute.aqi_metadata,
    explanation: backendRoute.explanation,
  };
}

/**
 * Get AQI color based on value
 * @param {number} aqi - AQI value
 * @returns {string} Color hex code
 */
export function getAQIColor(aqi) {
  if (aqi <= 50) return '#22c55e';   // Good - Green
  if (aqi <= 100) return '#84cc16';  // Moderate - Yellow-green
  if (aqi <= 150) return '#f59e0b';  // USG - Orange
  if (aqi <= 200) return '#ef4444';  // Unhealthy - Red
  if (aqi <= 300) return '#7c2d12';  // Very Unhealthy - Brown
  return '#4a044e';                   // Hazardous - Purple
}

// Export API URLs for debugging
export const API_URLS = {
  routing: ROUTING_API,
  ingestion: INGESTION_API,
  scraper: SCRAPER_API,
};

export default {
  // Routing
  calculateRoute,
  getDetailedRoute,
  getNavigation,
  getHexagonAQI,
  getAreaAQI,
  getServiceStats,

  // Ingestion
  submitTelemetry,
  submitBatchTelemetry,
  getIngestionStats,

  // Scraper
  getScrapedStations,
  getNearestStation,
  triggerAQIFetch,

  // Health
  checkBackendHealth,
  isBackendAvailable,

  // Utilities
  convertBackendRoute,
  getAQIColor,
  API_URLS,
};
