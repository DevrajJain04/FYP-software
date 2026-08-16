// AQI Zone data - defines air quality across different areas
// NOTE: This file provides zone-based AQI data for real-time simulation.
// For route-based AQI fetching, use services/aqiService.js which supports
// real API integration (OpenWeather, WAQI, etc.)

import { fetchRouteAQI, fetchLocationAQI, getAQICategory } from '../services/aqiService';

// Re-export the new service functions for backward compatibility
export { fetchRouteAQI, fetchLocationAQI, getAQICategory };

// AQI zones around Mumbai, India - each zone has a center point, radius, and AQI value
// This data is used for real-time simulation display on the map
export const aqiZones = [
  // Green areas - Parks and open spaces (LOW AQI - Good air)
  { id: 'sanjay-gandhi', name: 'Sanjay Gandhi National Park', lat: 19.2147, lng: 72.9107, radius: 0.030, aqi: 45, type: 'park' },
  { id: 'aarey-forest', name: 'Aarey Colony Forest', lat: 19.1550, lng: 72.8671, radius: 0.020, aqi: 52, type: 'park' },
  { id: 'powai-lake', name: 'Powai Lake Area', lat: 19.1273, lng: 72.9050, radius: 0.012, aqi: 58, type: 'park' },
  { id: 'juhu-beach', name: 'Juhu Beach', lat: 19.0948, lng: 72.8267, radius: 0.010, aqi: 65, type: 'park' },
  { id: 'versova-beach', name: 'Versova Beach', lat: 19.1329, lng: 72.8175, radius: 0.008, aqi: 68, type: 'park' },
  { id: 'marine-drive', name: 'Marine Drive Promenade', lat: 18.9432, lng: 72.8235, radius: 0.012, aqi: 75, type: 'riverside' },
  { id: 'shivaji-park', name: 'Shivaji Park', lat: 19.0283, lng: 72.8386, radius: 0.008, aqi: 70, type: 'park' },
  { id: 'bandra-fort', name: 'Bandra Fort Area', lat: 19.0425, lng: 72.8203, radius: 0.006, aqi: 72, type: 'park' },
  
  // Residential areas (MODERATE AQI)
  { id: 'bandra-west', name: 'Bandra West', lat: 19.0544, lng: 72.8261, radius: 0.012, aqi: 85, type: 'residential' },
  { id: 'andheri-west', name: 'Andheri West', lat: 19.1197, lng: 72.8464, radius: 0.015, aqi: 92, type: 'residential' },
  { id: 'juhu', name: 'Juhu', lat: 19.1075, lng: 72.8263, radius: 0.012, aqi: 78, type: 'residential' },
  { id: 'malad-west', name: 'Malad West', lat: 19.1872, lng: 72.8334, radius: 0.012, aqi: 88, type: 'residential' },
  { id: 'goregaon', name: 'Goregaon', lat: 19.1663, lng: 72.8526, radius: 0.015, aqi: 95, type: 'residential' },
  { id: 'borivali', name: 'Borivali', lat: 19.2307, lng: 72.8567, radius: 0.015, aqi: 80, type: 'residential' },
  { id: 'chembur', name: 'Chembur', lat: 19.0522, lng: 72.8994, radius: 0.012, aqi: 115, type: 'residential' },
  { id: 'mulund', name: 'Mulund', lat: 19.1726, lng: 72.9566, radius: 0.012, aqi: 98, type: 'residential' },
  
  // Commercial/Urban centers (HIGH AQI)
  { id: 'bkc', name: 'Bandra Kurla Complex', lat: 19.0655, lng: 72.8692, radius: 0.015, aqi: 105, type: 'commercial' },
  { id: 'lower-parel', name: 'Lower Parel', lat: 19.0000, lng: 72.8305, radius: 0.012, aqi: 110, type: 'commercial' },
  { id: 'andheri-east', name: 'Andheri East', lat: 19.1136, lng: 72.8850, radius: 0.015, aqi: 115, type: 'commercial' },
  { id: 'churchgate', name: 'Churchgate', lat: 18.9352, lng: 72.8273, radius: 0.008, aqi: 102, type: 'commercial' },
  { id: 'colaba', name: 'Colaba', lat: 18.9067, lng: 72.8147, radius: 0.010, aqi: 95, type: 'commercial' },
  { id: 'fort', name: 'Fort Area', lat: 18.9322, lng: 72.8353, radius: 0.012, aqi: 108, type: 'commercial' },
  { id: 'nariman-point', name: 'Nariman Point', lat: 18.9256, lng: 72.8242, radius: 0.008, aqi: 98, type: 'commercial' },
  
  // Major roads and junctions (VERY HIGH AQI)
  { id: 'dadar', name: 'Dadar Junction', lat: 19.0178, lng: 72.8478, radius: 0.010, aqi: 125, type: 'traffic' },
  { id: 'kurla', name: 'Kurla Junction', lat: 19.0726, lng: 72.8845, radius: 0.012, aqi: 130, type: 'traffic' },
  { id: 'ghatkopar', name: 'Ghatkopar', lat: 19.0858, lng: 72.9081, radius: 0.012, aqi: 128, type: 'traffic' },
  { id: 'sion', name: 'Sion', lat: 19.0404, lng: 72.8619, radius: 0.010, aqi: 122, type: 'traffic' },
  { id: 'worli', name: 'Worli', lat: 19.0176, lng: 72.8150, radius: 0.012, aqi: 118, type: 'traffic' },
  { id: 'santacruz', name: 'Santacruz Junction', lat: 19.0809, lng: 72.8382, radius: 0.010, aqi: 115, type: 'traffic' },
  { id: 'vile-parle', name: 'Vile Parle', lat: 19.0990, lng: 72.8432, radius: 0.010, aqi: 112, type: 'traffic' },
  { id: 'western-express', name: 'Western Express Highway', lat: 19.1200, lng: 72.8550, radius: 0.025, aqi: 135, type: 'traffic' },
  
  // Industrial/Heavy traffic zones (UNHEALTHY AQI)
  { id: 'mahul', name: 'Mahul Industrial Area', lat: 19.0236, lng: 72.9139, radius: 0.015, aqi: 180, type: 'industrial' },
  { id: 'trombay', name: 'Trombay', lat: 19.0069, lng: 72.9243, radius: 0.020, aqi: 165, type: 'industrial' },
  { id: 'eastern-freeway', name: 'Eastern Freeway', lat: 19.0300, lng: 72.8700, radius: 0.020, aqi: 140, type: 'traffic' },
  { id: 'sewri', name: 'Sewri', lat: 19.0022, lng: 72.8567, radius: 0.012, aqi: 145, type: 'industrial' },
  { id: 'wadala', name: 'Wadala', lat: 19.0180, lng: 72.8681, radius: 0.012, aqi: 138, type: 'industrial' },
  { id: 'mumbai-port', name: 'Mumbai Port Area', lat: 18.9553, lng: 72.8478, radius: 0.015, aqi: 155, type: 'industrial' },
  
  // Coastal areas (Generally better air)
  { id: 'worli-sea-face', name: 'Worli Sea Face', lat: 19.0145, lng: 72.8145, radius: 0.010, aqi: 82, type: 'riverside' },
  { id: 'haji-ali', name: 'Haji Ali', lat: 18.9827, lng: 72.8089, radius: 0.008, aqi: 78, type: 'riverside' },
  { id: 'nariman-point-sea', name: 'Nariman Point Seaface', lat: 18.9220, lng: 72.8200, radius: 0.010, aqi: 85, type: 'riverside' },
];

// Store for real-time AQI updates
let currentAQIData = {
  zones: [...aqiZones],
  lastUpdate: Date.now()
};

let updateCallbacks = [];

/**
 * Subscribe to AQI updates
 */
export const subscribeToAQIUpdates = (callback) => {
  updateCallbacks.push(callback);
  return () => {
    updateCallbacks = updateCallbacks.filter(cb => cb !== callback);
  };
};

/**
 * Get current AQI data
 */
export const getAQIData = () => currentAQIData;

/**
 * Simulate real-time AQI updates
 */
export const startAQISimulation = () => {
  const updateInterval = setInterval(() => {
    currentAQIData = {
      zones: currentAQIData.zones.map(zone => ({
        ...zone,
        // Fluctuate AQI by ±15% to simulate real-time changes
        aqi: Math.max(15, Math.min(200, 
          zone.aqi + (Math.random() - 0.5) * zone.aqi * 0.15
        ))
      })),
      lastUpdate: Date.now()
    };
    
    updateCallbacks.forEach(callback => callback(currentAQIData));
  }, 8000); // Update every 8 seconds
  
  return () => clearInterval(updateInterval);
};

/**
 * Get AQI at a specific coordinate
 */
export const getAQIAtLocation = (lat, lng) => {
  let weightedAQI = 0;
  let totalWeight = 0;

  for (const zone of currentAQIData.zones) {
    const distance = Math.sqrt(
      Math.pow(zone.lat - lat, 2) + Math.pow(zone.lng - lng, 2)
    );
    
    // Use inverse distance weighting
    if (distance < zone.radius * 3) {
      const weight = 1 / (distance + 0.001);
      weightedAQI += zone.aqi * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round(weightedAQI / totalWeight) : 50;
};

/**
 * Calculate AQI along a route (array of [lat, lng] coordinates)
 * Uses local zone-based data for real-time simulation display.
 * 
 * For production use with real API data, use fetchRouteAQI from aqiService.js instead.
 * 
 * @param {Array<[number, number]>} coordinates - Array of [lat, lng] points
 * @returns {Object} AQI data with average, min, max, and segments
 */
export const calculateRouteAQI = (coordinates) => {
  if (!coordinates || coordinates.length === 0) {
    return {
      average: 50,
      max: 50,
      min: 50,
      segments: [],
      source: 'default'
    };
  }

  let totalAQI = 0;
  let sampleCount = 0;
  let maxAQI = 0;
  let minAQI = 500;
  const segmentAQIs = [];

  // Sample points along the route
  const sampleInterval = Math.max(1, Math.floor(coordinates.length / 30));
  
  for (let i = 0; i < coordinates.length; i += sampleInterval) {
    const [lat, lng] = coordinates[i];
    const aqi = getAQIAtLocation(lat, lng);
    totalAQI += aqi;
    sampleCount++;
    maxAQI = Math.max(maxAQI, aqi);
    minAQI = Math.min(minAQI, aqi);
    
    segmentAQIs.push({
      index: i,
      lat,
      lng,
      aqi
    });
  }

  return {
    average: sampleCount > 0 ? Math.round(totalAQI / sampleCount) : 50,
    max: maxAQI,
    min: minAQI,
    segments: segmentAQIs,
    source: 'zone-simulation'
  };
};

/**
 * Async version that can use real API data via aqiService
 * Call this when you want to use real AQI API data instead of zone simulation
 * 
 * @param {Array<[number, number]>} coordinates - Array of [lat, lng] points
 * @returns {Promise<Object>} AQI data with average, min, max, and segments
 */
export const calculateRouteAQIAsync = async (coordinates) => {
  try {
    const result = await fetchRouteAQI(coordinates);
    return {
      average: result.average,
      max: result.max,
      min: result.min,
      segments: result.segments,
      source: result.provider,
      fetchedAt: result.fetchedAt
    };
  } catch (error) {
    console.error('Error fetching route AQI from service:', error);
    // Fallback to zone-based calculation
    return calculateRouteAQI(coordinates);
  }
};

/**
 * Get AQI category and color
 */
export const getAQIInfo = (aqi) => {
  if (aqi <= 50) return { category: 'Good', color: '#22c55e', bgColor: '#dcfce7' };
  if (aqi <= 100) return { category: 'Moderate', color: '#84cc16', bgColor: '#ecfccb' };
  if (aqi <= 150) return { category: 'Unhealthy for Sensitive', color: '#f59e0b', bgColor: '#fef3c7' };
  if (aqi <= 200) return { category: 'Unhealthy', color: '#ef4444', bgColor: '#fee2e2' };
  return { category: 'Very Unhealthy', color: '#7c2d12', bgColor: '#fecaca' };
};

export default {
  aqiZones,
  getAQIData,
  subscribeToAQIUpdates,
  startAQISimulation,
  getAQIAtLocation,
  calculateRouteAQI,
  calculateRouteAQIAsync,
  getAQIInfo,
  // Re-exported from aqiService for convenience
  fetchRouteAQI,
  fetchLocationAQI,
  getAQICategory
};
