/**
 * AQI Service - Air Quality Index data fetching
 * 
 * This service handles fetching AQI data for route coordinates.
 * 
 * Data Sources (in priority order):
 * 1. Green Corridor Backend (real-time vehicle telemetry + scraped station data)
 * 2. External APIs (OpenWeather, WAQI, etc.)
 * 3. Sample/simulated data (for development)
 * 
 * Backend Integration:
 * - AQI Scraper Service: http://localhost:8082 (monitoring station data)
 * - Routing Service: http://localhost:8000 (hexagon AQI data)
 */

import { 
  getAreaAQI as backendGetAreaAQI,
  getHexagonAQI as backendGetHexagonAQI,
  getNearestStation,
  getScrapedStations,
  isBackendAvailable 
} from './backendService';

// Configuration - Set your API key here when integrating with a real service
const AQI_CONFIG = {
  // Set to 'backend' for Green Corridor, 'sample' for development, 
  // or 'openweather', 'iqair', 'waqi', 'google' for external APIs
  provider: process.env.REACT_APP_AQI_PROVIDER || 'backend',
  
  // API keys - add your keys here
  apiKeys: {
    openweather: process.env.REACT_APP_OPENWEATHER_API_KEY || '',
    iqair: process.env.REACT_APP_IQAIR_API_KEY || '',
    waqi: process.env.REACT_APP_WAQI_API_KEY || '',
    google: process.env.REACT_APP_GOOGLE_AQI_API_KEY || '',
  },
  
  // How many points to sample along a route (more = more accurate but more API calls)
  samplePointsPerRoute: 10,
  
  // Cache duration in milliseconds (5 minutes)
  cacheDuration: 5 * 60 * 1000,
};

// Simple cache for AQI data
const aqiCache = new Map();

/**
 * Sample AQI data for different area types
 * Represents typical AQI values for various urban zones
 */
const SAMPLE_AQI_DATA = {
  // Parks and green spaces - Good air quality (0-50)
  parks: {
    baseAQI: 25,
    variance: 15,
    keywords: ['park', 'garden', 'heath', 'green', 'common', 'hill', 'meadow'],
  },
  
  // Riverside areas - Good to Moderate (30-60)
  riverside: {
    baseAQI: 45,
    variance: 15,
    keywords: ['river', 'thames', 'embankment', 'bank', 'waterfront', 'canal'],
  },
  
  // Residential areas - Moderate (40-70)
  residential: {
    baseAQI: 55,
    variance: 15,
    keywords: ['residential', 'village', 'estate', 'suburb'],
  },
  
  // Commercial/Shopping areas - Moderate to Unhealthy for Sensitive (70-100)
  commercial: {
    baseAQI: 85,
    variance: 15,
    keywords: ['shopping', 'market', 'circus', 'square', 'mall', 'centre', 'center'],
  },
  
  // Main roads and junctions - Unhealthy for Sensitive (90-130)
  traffic: {
    baseAQI: 110,
    variance: 20,
    keywords: ['road', 'street', 'highway', 'junction', 'roundabout', 'bridge', 'tunnel', 'a1', 'a2', 'a3', 'a4', 'a5', 'm1', 'm25'],
  },
  
  // Industrial zones - Unhealthy (120-160)
  industrial: {
    baseAQI: 140,
    variance: 20,
    keywords: ['industrial', 'factory', 'dock', 'port', 'warehouse', 'depot'],
  },
  
  // Default for unknown areas
  default: {
    baseAQI: 60,
    variance: 20,
  },
};

/**
 * AQI categories with colors and health implications
 */
export const AQI_CATEGORIES = [
  { max: 50, label: 'Good', color: '#22c55e', bgColor: '#dcfce7', description: 'Air quality is satisfactory' },
  { max: 100, label: 'Moderate', color: '#84cc16', bgColor: '#ecfccb', description: 'Acceptable air quality' },
  { max: 150, label: 'Unhealthy for Sensitive Groups', color: '#f59e0b', bgColor: '#fef3c7', description: 'Sensitive groups may experience effects' },
  { max: 200, label: 'Unhealthy', color: '#ef4444', bgColor: '#fee2e2', description: 'Everyone may begin to experience effects' },
  { max: 300, label: 'Very Unhealthy', color: '#7c2d12', bgColor: '#fecaca', description: 'Health alert: everyone may experience effects' },
  { max: 500, label: 'Hazardous', color: '#4a044e', bgColor: '#fae8ff', description: 'Health emergency conditions' },
];

/**
 * Get AQI category info for a given AQI value
 */
export const getAQICategory = (aqi) => {
  for (const category of AQI_CATEGORIES) {
    if (aqi <= category.max) {
      return category;
    }
  }
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
};

/**
 * Generate a cache key for coordinates
 */
const getCacheKey = (lat, lng) => {
  // Round to 3 decimal places (~100m precision) for caching
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
};

/**
 * Check if cached data is still valid
 */
const isCacheValid = (cacheEntry) => {
  return cacheEntry && (Date.now() - cacheEntry.timestamp < AQI_CONFIG.cacheDuration);
};

/**
 * Fetch AQI for a single coordinate using sample data
 * In production, replace this with actual API calls
 */
const fetchSampleAQI = async (lat, lng) => {
  // Simulate network delay (remove in production)
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Base AQI varies by location (simple geographic simulation)
  // Central London tends to have higher AQI
  const distanceFromCenter = Math.sqrt(
    Math.pow(lat - 51.5074, 2) + Math.pow(lng - (-0.1278), 2)
  );
  
  // Further from center = generally cleaner air
  const distanceFactor = Math.min(distanceFromCenter * 100, 30);
  
  // Time-based variation (rush hours have worse air quality)
  const hour = new Date().getHours();
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const timeFactor = isRushHour ? 20 : 0;
  
  // Random variation
  const randomFactor = (Math.random() - 0.5) * 30;
  
  // Base urban AQI
  let baseAQI = 70 - distanceFactor + timeFactor + randomFactor;
  
  // Ensure AQI is within valid range
  return Math.max(15, Math.min(200, Math.round(baseAQI)));
};

/**
 * Fetch AQI from OpenWeather Air Pollution API
 * API Docs: https://openweathermap.org/api/air-pollution
 */
const fetchOpenWeatherAQI = async (lat, lng) => {
  const apiKey = AQI_CONFIG.apiKeys.openweather;
  if (!apiKey) {
    console.warn('OpenWeather API key not configured');
    return fetchSampleAQI(lat, lng);
  }
  
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${apiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`OpenWeather API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // OpenWeather returns AQI on 1-5 scale, convert to EPA 0-500 scale
    // Also provides individual pollutant concentrations we could use for more accurate conversion
    const owAQI = data.list?.[0]?.main?.aqi || 2;
    const components = data.list?.[0]?.components || {};
    
    // Simple conversion: OW 1=Good(25), 2=Fair(60), 3=Moderate(100), 4=Poor(150), 5=VeryPoor(200)
    const aqiMap = { 1: 25, 2: 60, 3: 100, 4: 150, 5: 200 };
    return aqiMap[owAQI] || 60;
    
  } catch (error) {
    console.error('Error fetching OpenWeather AQI:', error);
    return fetchSampleAQI(lat, lng);
  }
};

/**
 * Fetch AQI from WAQI (World Air Quality Index) API
 * API Docs: https://aqicn.org/json-api/doc/
 * @deprecated Consider using fetchBackendAQI for real-time vehicle telemetry data
 */
const fetchWAQIAQI = async (lat, lng) => {
  const apiKey = AQI_CONFIG.apiKeys.waqi;
  if (!apiKey) {
    console.warn('WAQI API key not configured');
    return fetchSampleAQI(lat, lng);
  }
  
  try {
    const response = await fetch(
      `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${apiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`WAQI API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'ok' && data.data?.aqi) {
      // WAQI already uses US EPA AQI scale (0-500)
      return Math.round(data.data.aqi);
    }
    
    return fetchSampleAQI(lat, lng);
    
  } catch (error) {
    console.error('Error fetching WAQI AQI:', error);
    return fetchSampleAQI(lat, lng);
  }
};

/**
 * Fetch AQI from Green Corridor Backend (vehicle telemetry + scraped data)
 * This is the primary data source when backend is available
 */
const fetchBackendAQI = async (lat, lng) => {
  try {
    const station = await getNearestStation(lat, lng);
    if (station && station.aqi !== undefined) {
      return Math.round(station.aqi);
    }
    // Fallback to sample if no station data
    return fetchSampleAQI(lat, lng);
  } catch (error) {
    console.warn('Backend AQI fetch failed, using sample data:', error.message);
    return fetchSampleAQI(lat, lng);
  }
};

/**
 * Get AQI heatmap data for a map bounding box from backend
 * @param {Object} bounds - { north, south, east, west }
 * @returns {Promise<Object>} Hexagon AQI data for heatmap visualization
 */
export const fetchAreaAQIFromBackend = async (bounds) => {
  try {
    const data = await backendGetAreaAQI(bounds);
    return data;
  } catch (error) {
    console.error('Error fetching area AQI from backend:', error);
    return { hexagons: [] };
  }
};

/**
 * Get all scraped AQI monitoring stations from backend
 * @returns {Promise<Array>} Array of station objects with AQI data
 */
export const fetchScrapedStations = async () => {
  try {
    const backendUp = await isBackendAvailable();
    if (!backendUp) {
      console.warn('Backend not available for scraped stations');
      return [];
    }
    return await getScrapedStations();
  } catch (error) {
    console.error('Error fetching scraped stations:', error);
    return [];
  }
};

/**
 * Main AQI fetching function - routes to appropriate provider
 */
const fetchAQIForCoordinate = async (lat, lng) => {
  const cacheKey = getCacheKey(lat, lng);
  const cached = aqiCache.get(cacheKey);
  
  if (isCacheValid(cached)) {
    return cached.aqi;
  }
  
  let aqi;
  
  switch (AQI_CONFIG.provider) {
    case 'backend':
      aqi = await fetchBackendAQI(lat, lng);
      break;
    case 'openweather':
      aqi = await fetchOpenWeatherAQI(lat, lng);
      break;
    case 'waqi':
      aqi = await fetchWAQIAQI(lat, lng);
      break;
    case 'sample':
    default:
      aqi = await fetchSampleAQI(lat, lng);
  }
  
  // Cache the result
  aqiCache.set(cacheKey, { aqi, timestamp: Date.now() });
  
  return aqi;
};

/**
 * Fetch AQI data for a route (array of [lat, lng] coordinates)
 * 
 * @param {Array<[number, number]>} coordinates - Array of [lat, lng] points along the route
 * @returns {Promise<Object>} AQI data including average, min, max, and per-segment values
 */
export const fetchRouteAQI = async (coordinates) => {
  if (!coordinates || coordinates.length === 0) {
    return {
      average: 50,
      min: 50,
      max: 50,
      segments: [],
      fetchedAt: Date.now(),
      provider: AQI_CONFIG.provider,
    };
  }
  
  // Sample points along the route to reduce API calls
  const numSamples = Math.min(AQI_CONFIG.samplePointsPerRoute, coordinates.length);
  const sampleInterval = Math.max(1, Math.floor(coordinates.length / numSamples));
  
  const samplePoints = [];
  for (let i = 0; i < coordinates.length; i += sampleInterval) {
    samplePoints.push({
      index: i,
      lat: coordinates[i][0],
      lng: coordinates[i][1],
    });
  }
  
  // Fetch AQI for all sample points (in parallel for better performance)
  const aqiPromises = samplePoints.map(async (point) => {
    const aqi = await fetchAQIForCoordinate(point.lat, point.lng);
    return { ...point, aqi };
  });
  
  const segments = await Promise.all(aqiPromises);
  
  // Calculate statistics
  const aqiValues = segments.map(s => s.aqi);
  const sum = aqiValues.reduce((a, b) => a + b, 0);
  const average = Math.round(sum / aqiValues.length);
  const min = Math.min(...aqiValues);
  const max = Math.max(...aqiValues);
  
  return {
    average,
    min,
    max,
    segments,
    fetchedAt: Date.now(),
    provider: AQI_CONFIG.provider,
    sampleCount: segments.length,
  };
};

/**
 * Fetch AQI for a single location
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} AQI data for the location
 */
export const fetchLocationAQI = async (lat, lng) => {
  const aqi = await fetchAQIForCoordinate(lat, lng);
  const category = getAQICategory(aqi);
  
  return {
    aqi,
    category: category.label,
    color: category.color,
    bgColor: category.bgColor,
    description: category.description,
    fetchedAt: Date.now(),
    provider: AQI_CONFIG.provider,
  };
};

/**
 * Clear the AQI cache (useful when switching providers or for testing)
 */
export const clearAQICache = () => {
  aqiCache.clear();
};

/**
 * Update AQI configuration
 * 
 * @param {Object} config - Configuration options
 * @param {string} config.provider - AQI data provider ('sample', 'openweather', 'waqi')
 * @param {number} config.samplePointsPerRoute - Number of sample points per route
 * @param {number} config.cacheDuration - Cache duration in milliseconds
 */
export const configureAQIService = (config) => {
  if (config.provider) {
    AQI_CONFIG.provider = config.provider;
  }
  if (config.samplePointsPerRoute) {
    AQI_CONFIG.samplePointsPerRoute = config.samplePointsPerRoute;
  }
  if (config.cacheDuration) {
    AQI_CONFIG.cacheDuration = config.cacheDuration;
  }
  if (config.apiKeys) {
    Object.assign(AQI_CONFIG.apiKeys, config.apiKeys);
  }
  
  // Clear cache when config changes
  clearAQICache();
};

/**
 * Get current AQI service configuration
 */
export const getAQIServiceConfig = () => ({
  provider: AQI_CONFIG.provider,
  samplePointsPerRoute: AQI_CONFIG.samplePointsPerRoute,
  cacheDuration: AQI_CONFIG.cacheDuration,
  hasOpenWeatherKey: !!AQI_CONFIG.apiKeys.openweather,
  hasWAQIKey: !!AQI_CONFIG.apiKeys.waqi,
  hasBackend: AQI_CONFIG.provider === 'backend',
});

export default {
  // Primary methods
  fetchRouteAQI,
  fetchLocationAQI,
  getAQICategory,
  AQI_CATEGORIES,
  
  // Backend integration
  fetchAreaAQIFromBackend,
  fetchScrapedStations,
  
  // Configuration
  clearAQICache,
  configureAQIService,
  getAQIServiceConfig,
};
