/**
 * Green Corridor Routing Service
 * 
 * This service provides routing functionality through the backend API.
 * NO ORS FALLBACK - If the backend fails, we show an error to the user.
 * 
 * The backend already integrates with ORS internally for detailed navigation,
 * so there's no need for client-side ORS calls.
 * 
 * CACHING: Routes are cached in memory to avoid redundant API calls.
 * Cache is keyed by origin, destination, balance, and alternatives.
 */

import { 
  calculateRoute, 
  getDetailedRoute,
  getNavigation,
  convertBackendRoute, 
  isBackendAvailable 
} from './backendService';

// ============ ROUTE CACHE ============

/**
 * In-memory route cache
 * Key format: "lat1,lng1|lat2,lng2|balance|alternatives|navigation"
 */
const routeCache = new Map();

// Cache configuration
const CACHE_MAX_SIZE = 50;      // Maximum cached routes
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL (AQI data can change)

/**
 * Generate cache key from route parameters
 */
const generateCacheKey = (start, end, balance, alternatives, withNavigation = false) => {
  // Round coordinates to 5 decimal places (~1m precision) for cache key
  const startKey = `${start[0].toFixed(5)},${start[1].toFixed(5)}`;
  const endKey = `${end[0].toFixed(5)},${end[1].toFixed(5)}`;
  const balanceKey = balance.toFixed(2);
  const navKey = withNavigation ? 'nav' : 'simple';
  return `${startKey}|${endKey}|${balanceKey}|${alternatives}|${navKey}`;
};

/**
 * Get cached route if available and not expired
 */
const getCachedRoute = (key) => {
  const cached = routeCache.get(key);
  if (!cached) return null;
  
  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    routeCache.delete(key);
    return null;
  }
  
  console.log('🎯 Route cache hit:', key);
  return cached.data;
};

/**
 * Store route in cache
 */
const setCachedRoute = (key, data) => {
  // Enforce max cache size (LRU-style: remove oldest entries)
  if (routeCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = routeCache.keys().next().value;
    routeCache.delete(oldestKey);
  }
  
  routeCache.set(key, {
    data,
    timestamp: Date.now(),
  });
  console.log('💾 Route cached:', key, `(${routeCache.size}/${CACHE_MAX_SIZE})`);
};

/**
 * Clear the entire route cache
 */
export const clearRouteCache = () => {
  const size = routeCache.size;
  routeCache.clear();
  console.log(`🗑️ Route cache cleared (${size} entries removed)`);
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => ({
  size: routeCache.size,
  maxSize: CACHE_MAX_SIZE,
  ttlMs: CACHE_TTL_MS,
});

// ============ MAIN ROUTING FUNCTIONS ============

/**
 * Get AQI-aware routes from the backend (with caching)
 * @param {Array} start - [lat, lng] of start point
 * @param {Array} end - [lat, lng] of end point
 * @param {number} balance - 0 (fastest) to 1 (cleanest air), default 0.5
 * @param {number} alternatives - Number of alternative routes (1-5)
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<Object>} { routes: Array, source: 'backend', error: null, cached: boolean }
 */
export const getRoutes = async (start, end, balance = 0.5, alternatives = 3, forceRefresh = false) => {
  // Generate cache key
  const cacheKey = generateCacheKey(start, end, balance, alternatives, false);
  
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedRoute(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  try {
    // Check backend availability first
    const available = await isBackendAvailable();
    if (!available) {
      return {
        routes: [],
        source: null,
        error: 'Backend service is unavailable. Please check if the routing service is running.',
        cached: false,
      };
    }

    const origin = { lat: start[0], lng: start[1] };
    const destination = { lat: end[0], lng: end[1] };
    
    const response = await calculateRoute(origin, destination, balance, alternatives);
    
    if (!response.routes || response.routes.length === 0) {
      return {
        routes: [],
        source: 'backend',
        error: 'No routes found between these locations.',
        cached: false,
      };
    }
    
    // Convert backend routes to frontend format
    const routes = response.routes.map((route, index) => {
      const converted = convertBackendRoute(route, index);
      return {
        ...converted,
        // Add AQI data for UI display
        aqiData: {
          average: route.average_aqi,
          max: route.max_aqi,
          min: route.average_aqi, // Use average as approximation
          segments: [],
        },
      };
    });
    
    const result = { 
      routes, 
      source: 'backend',
      error: null,
      metadata: response.metadata || {},
      cached: false,
    };
    
    // Cache the successful result
    setCachedRoute(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching routes:', error);
    return {
      routes: [],
      source: null,
      error: `Route calculation failed: ${error.message}`,
      cached: false,
    };
  }
};

/**
 * Get a single route with turn-by-turn navigation (with caching)
 * @param {Array} start - [lat, lng] of start point
 * @param {Array} end - [lat, lng] of end point
 * @param {number} balance - 0 (fastest) to 1 (cleanest air)
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<Object>} Route with navigation steps
 */
export const getRouteWithNavigation = async (start, end, balance = 0.5, forceRefresh = false) => {
  // Generate cache key for navigation routes
  const cacheKey = generateCacheKey(start, end, balance, 1, true);
  
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedRoute(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  try {
    const available = await isBackendAvailable();
    if (!available) {
      return {
        route: null,
        error: 'Backend service is unavailable.',
        cached: false,
      };
    }

    const origin = { lat: start[0], lng: start[1] };
    const destination = { lat: end[0], lng: end[1] };
    
    const response = await getDetailedRoute(origin, destination, balance);
    
    if (!response.route) {
      return {
        route: null,
        error: 'No route found with navigation.',
        cached: false,
      };
    }
    
    const route = convertBackendRoute(response.route, 0);
    
    const result = {
      route: {
        ...route,
        navigation: response.navigation || [],
        steps: response.navigation?.steps || [],
      },
      error: null,
      cached: false,
    };
    
    // Cache the successful result
    setCachedRoute(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching detailed route:', error);
    return {
      route: null,
      error: `Navigation request failed: ${error.message}`,
      cached: false,
    };
  }
};

/**
 * Get navigation instructions for an existing route
 * @param {Array} routeCoordinates - [[lng, lat], ...] coordinates
 * @param {Array} start - [lat, lng] of start
 * @param {Array} end - [lat, lng] of end
 * @param {string} profile - Transport mode
 * @returns {Promise<Object>} Navigation instructions
 */
export const getRouteNavigation = async (routeCoordinates, start, end, profile = 'driving-car') => {
  try {
    const origin = { lat: start[0], lng: start[1] };
    const destination = { lat: end[0], lng: end[1] };
    
    const response = await getNavigation(routeCoordinates, origin, destination, profile);
    
    return {
      steps: response.steps || [],
      totalDuration: response.duration,
      totalDistance: response.distance,
      error: null,
    };
  } catch (error) {
    console.error('Error fetching navigation:', error);
    return {
      steps: [],
      error: `Navigation failed: ${error.message}`,
    };
  }
};

// ============ UTILITY FUNCTIONS ============

/**
 * Check if routing service is available
 * @returns {Promise<boolean>}
 */
export const checkRouteAvailability = async () => {
  return await isBackendAvailable();
};

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance
 */
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours} hr ${mins} min`;
};

/**
 * Get route type label based on AQI/time tradeoff
 * @param {number} index - Route index
 * @param {Object} route - Route object
 * @returns {string} Label
 */
export const getRouteLabel = (index, route) => {
  if (index === 0) {
    return 'Recommended Route';
  }
  
  const baseRoute = route;
  if (baseRoute.averageAQI <= 50) {
    return 'Clean Air Route';
  }
  if (baseRoute.duration === Math.min(baseRoute.duration)) {
    return 'Fastest Route';
  }
  
  return `Alternative ${index}`;
};

/**
 * Get AQI category info
 * @param {number} aqi - AQI value
 * @returns {Object} { label, color, textColor }
 */
export const getAQICategory = (aqi) => {
  if (aqi <= 50) {
    return { label: 'Good', color: '#22c55e', textColor: '#166534' };
  }
  if (aqi <= 100) {
    return { label: 'Moderate', color: '#84cc16', textColor: '#3f6212' };
  }
  if (aqi <= 150) {
    return { label: 'Unhealthy (SG)', color: '#f59e0b', textColor: '#92400e' };
  }
  if (aqi <= 200) {
    return { label: 'Unhealthy', color: '#ef4444', textColor: '#991b1b' };
  }
  if (aqi <= 300) {
    return { label: 'Very Unhealthy', color: '#991b1b', textColor: '#ffffff' };
  }
  return { label: 'Hazardous', color: '#4a044e', textColor: '#ffffff' };
};

/**
 * Sort routes by criteria
 * @param {Array} routes - Array of routes
 * @param {string} criteria - 'aqi', 'time', 'distance', 'balanced'
 * @returns {Array} Sorted routes
 */
export const sortRoutes = (routes, criteria = 'balanced') => {
  const sorted = [...routes];
  
  switch (criteria) {
    case 'aqi':
      return sorted.sort((a, b) => (a.averageAQI || 0) - (b.averageAQI || 0));
    case 'time':
      return sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    case 'distance':
      return sorted.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    case 'balanced':
    default:
      return sorted.sort((a, b) => (a.weightedCost || 0) - (b.weightedCost || 0));
  }
};

// ============ EXPORT ============

export default {
  getRoutes,
  getRouteWithNavigation,
  getRouteNavigation,
  checkRouteAvailability,
  formatDistance,
  formatDuration,
  getRouteLabel,
  getAQICategory,
  sortRoutes,
};
