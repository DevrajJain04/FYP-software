/**
 * @deprecated LEGACY FILE - This file is no longer used by the application.
 * 
 * The app now uses OpenRouteService (ORS) for routing instead of this static graph.
 * This file is kept for reference and potential fallback scenarios.
 * 
 * For routing, see: services/routingService.js
 * For location data, the app now uses dynamic geocoding via LocationSearch.js
 * 
 * Consider removing this file if no longer needed.
 */

// Expanded graph data for routing with more nodes for distinct path options
// Nodes represent locations with coordinates around London area

/** @deprecated Use LocationSearch.js for dynamic location search */
export const nodes = {
  // Central Area
  A: { id: 'A', name: 'City Center', lat: 51.5074, lng: -0.1278, address: '1 City Square' },
  B: { id: 'B', name: 'Train Station', lat: 51.5152, lng: -0.0889, address: 'Liverpool Street' },
  C: { id: 'C', name: 'Shopping District', lat: 51.5135, lng: -0.1375, address: 'Oxford Circus' },
  D: { id: 'D', name: 'University Campus', lat: 51.5246, lng: -0.1340, address: 'UCL Campus' },
  E: { id: 'E', name: 'Hospital', lat: 51.4994, lng: -0.0999, address: 'St Thomas Hospital' },
  F: { id: 'F', name: 'Hyde Park', lat: 51.5073, lng: -0.1657, address: 'Hyde Park Corner' },
  G: { id: 'G', name: 'Business District', lat: 51.5155, lng: -0.0922, address: 'Bank Station' },
  H: { id: 'H', name: 'Stadium', lat: 51.4869, lng: -0.1063, address: 'The Oval' },
  I: { id: 'I', name: 'Museum Quarter', lat: 51.4966, lng: -0.1764, address: 'Natural History Museum' },
  J: { id: 'J', name: 'Riverside Walk', lat: 51.5076, lng: -0.0994, address: 'South Bank' },
  
  // Northern Green Route
  K: { id: 'K', name: 'Regents Park', lat: 51.5313, lng: -0.1570, address: 'Regents Park' },
  L: { id: 'L', name: 'Primrose Hill', lat: 51.5396, lng: -0.1615, address: 'Primrose Hill' },
  M: { id: 'M', name: 'Camden Gardens', lat: 51.5390, lng: -0.1426, address: 'Camden Town' },
  N: { id: 'N', name: 'Kings Cross Green', lat: 51.5320, lng: -0.1240, address: 'Kings Cross' },
  
  // Southern Green Route  
  O: { id: 'O', name: 'Battersea Park', lat: 51.4791, lng: -0.1560, address: 'Battersea Park' },
  P: { id: 'P', name: 'Clapham Common', lat: 51.4615, lng: -0.1380, address: 'Clapham Common' },
  Q: { id: 'Q', name: 'Brockwell Park', lat: 51.4500, lng: -0.1100, address: 'Brockwell Park' },
  R: { id: 'R', name: 'Dulwich Village', lat: 51.4450, lng: -0.0850, address: 'Dulwich' },
  
  // Eastern Industrial (High AQI)
  S: { id: 'S', name: 'Industrial Zone', lat: 51.5100, lng: -0.0600, address: 'Canary Wharf' },
  T: { id: 'T', name: 'Docklands', lat: 51.5000, lng: -0.0400, address: 'Royal Docks' },
  U: { id: 'U', name: 'Highway Junction', lat: 51.4900, lng: -0.0700, address: 'A13 Junction' },
  
  // Western Residential
  V: { id: 'V', name: 'Kensington Gardens', lat: 51.5069, lng: -0.1795, address: 'Kensington' },
  W: { id: 'W', name: 'Notting Hill', lat: 51.5139, lng: -0.2050, address: 'Notting Hill Gate' },
  X: { id: 'X', name: 'Holland Park', lat: 51.5028, lng: -0.2040, address: 'Holland Park' },
};

// Initial edges - will be updated with real-time AQI
// distance in km, travelTime in minutes, averageAQI (0-500 scale)
let edges = [
  // Central connections - moderate traffic
  { from: 'A', to: 'B', distance: 2.8, travelTime: 12, averageAQI: 95, streetName: 'Cheapside' },
  { from: 'A', to: 'C', distance: 1.5, travelTime: 8, averageAQI: 110, streetName: 'Regent Street' },
  { from: 'A', to: 'E', distance: 1.2, travelTime: 6, averageAQI: 85, streetName: 'Westminster Bridge Rd' },
  { from: 'A', to: 'J', distance: 0.8, travelTime: 4, averageAQI: 75, streetName: 'Embankment' },
  { from: 'A', to: 'G', distance: 2.5, travelTime: 15, averageAQI: 120, streetName: 'Threadneedle St' },
  
  { from: 'B', to: 'A', distance: 2.8, travelTime: 12, averageAQI: 95, streetName: 'Cheapside' },
  { from: 'B', to: 'G', distance: 0.4, travelTime: 3, averageAQI: 105, streetName: 'Bishopsgate' },
  { from: 'B', to: 'D', distance: 3.2, travelTime: 18, averageAQI: 88, streetName: 'City Road' },
  { from: 'B', to: 'S', distance: 4.5, travelTime: 20, averageAQI: 135, streetName: 'Commercial Road' },
  
  { from: 'C', to: 'A', distance: 1.5, travelTime: 8, averageAQI: 110, streetName: 'Regent Street' },
  { from: 'C', to: 'D', distance: 1.8, travelTime: 10, averageAQI: 92, streetName: 'Tottenham Court Rd' },
  { from: 'C', to: 'F', distance: 1.2, travelTime: 7, averageAQI: 65, streetName: 'Park Lane' },
  { from: 'C', to: 'K', distance: 2.0, travelTime: 12, averageAQI: 55, streetName: 'Portland Place' },
  
  { from: 'D', to: 'B', distance: 3.2, travelTime: 18, averageAQI: 88, streetName: 'City Road' },
  { from: 'D', to: 'C', distance: 1.8, travelTime: 10, averageAQI: 92, streetName: 'Tottenham Court Rd' },
  { from: 'D', to: 'K', distance: 1.5, travelTime: 8, averageAQI: 45, streetName: 'Albany Street' },
  { from: 'D', to: 'N', distance: 1.0, travelTime: 5, averageAQI: 52, streetName: 'Euston Road' },
  
  { from: 'E', to: 'A', distance: 1.2, travelTime: 6, averageAQI: 85, streetName: 'Westminster Bridge Rd' },
  { from: 'E', to: 'H', distance: 2.0, travelTime: 10, averageAQI: 78, streetName: 'Kennington Road' },
  { from: 'E', to: 'J', distance: 0.5, travelTime: 3, averageAQI: 60, streetName: 'South Bank' },
  
  // Park routes - LOW AQI (green corridors)
  { from: 'F', to: 'C', distance: 1.2, travelTime: 7, averageAQI: 65, streetName: 'Park Lane' },
  { from: 'F', to: 'I', distance: 1.5, travelTime: 8, averageAQI: 35, streetName: 'Kensington Road' },
  { from: 'F', to: 'V', distance: 0.8, travelTime: 5, averageAQI: 30, streetName: 'Kensington Gardens' },
  { from: 'F', to: 'K', distance: 2.5, travelTime: 15, averageAQI: 40, streetName: 'Park Connector' },
  
  { from: 'G', to: 'A', distance: 2.5, travelTime: 15, averageAQI: 120, streetName: 'Threadneedle St' },
  { from: 'G', to: 'B', distance: 0.4, travelTime: 3, averageAQI: 105, streetName: 'Bishopsgate' },
  { from: 'G', to: 'S', distance: 5.0, travelTime: 22, averageAQI: 145, streetName: 'A1261' },
  { from: 'G', to: 'J', distance: 1.8, travelTime: 9, averageAQI: 90, streetName: 'London Bridge' },
  
  { from: 'H', to: 'E', distance: 2.0, travelTime: 10, averageAQI: 78, streetName: 'Kennington Road' },
  { from: 'H', to: 'O', distance: 3.5, travelTime: 18, averageAQI: 42, streetName: 'Battersea Bridge Rd' },
  { from: 'H', to: 'P', distance: 2.8, travelTime: 14, averageAQI: 38, streetName: 'Clapham Road' },
  
  { from: 'I', to: 'F', distance: 1.5, travelTime: 8, averageAQI: 35, streetName: 'Kensington Road' },
  { from: 'I', to: 'V', distance: 0.6, travelTime: 4, averageAQI: 32, streetName: 'Exhibition Road' },
  { from: 'I', to: 'X', distance: 1.8, travelTime: 10, averageAQI: 38, streetName: 'Holland Walk' },
  
  { from: 'J', to: 'A', distance: 0.8, travelTime: 4, averageAQI: 75, streetName: 'Embankment' },
  { from: 'J', to: 'E', distance: 0.5, travelTime: 3, averageAQI: 60, streetName: 'South Bank' },
  { from: 'J', to: 'G', distance: 1.8, travelTime: 9, averageAQI: 90, streetName: 'London Bridge' },
  
  // Northern Green Route - LOW AQI
  { from: 'K', to: 'C', distance: 2.0, travelTime: 12, averageAQI: 55, streetName: 'Portland Place' },
  { from: 'K', to: 'D', distance: 1.5, travelTime: 8, averageAQI: 45, streetName: 'Albany Street' },
  { from: 'K', to: 'F', distance: 2.5, travelTime: 15, averageAQI: 40, streetName: 'Park Connector' },
  { from: 'K', to: 'L', distance: 1.2, travelTime: 7, averageAQI: 28, streetName: 'Primrose Hill Road' },
  { from: 'K', to: 'M', distance: 1.5, travelTime: 9, averageAQI: 35, streetName: 'Parkway' },
  
  { from: 'L', to: 'K', distance: 1.2, travelTime: 7, averageAQI: 28, streetName: 'Primrose Hill Road' },
  { from: 'L', to: 'M', distance: 1.0, travelTime: 6, averageAQI: 25, streetName: "Regent's Park Road" },
  { from: 'L', to: 'W', distance: 3.5, travelTime: 20, averageAQI: 42, streetName: 'Prince Albert Road' },
  
  { from: 'M', to: 'K', distance: 1.5, travelTime: 9, averageAQI: 35, streetName: 'Parkway' },
  { from: 'M', to: 'L', distance: 1.0, travelTime: 6, averageAQI: 25, streetName: "Regent's Park Road" },
  { from: 'M', to: 'N', distance: 1.8, travelTime: 10, averageAQI: 48, streetName: 'Camden Road' },
  
  { from: 'N', to: 'D', distance: 1.0, travelTime: 5, averageAQI: 52, streetName: 'Euston Road' },
  { from: 'N', to: 'M', distance: 1.8, travelTime: 10, averageAQI: 48, streetName: 'Camden Road' },
  { from: 'N', to: 'B', distance: 2.5, travelTime: 14, averageAQI: 82, streetName: 'Pentonville Road' },
  
  // Southern Green Route - LOW AQI
  { from: 'O', to: 'H', distance: 3.5, travelTime: 18, averageAQI: 42, streetName: 'Battersea Bridge Rd' },
  { from: 'O', to: 'P', distance: 2.2, travelTime: 12, averageAQI: 32, streetName: 'Battersea Park Road' },
  { from: 'O', to: 'I', distance: 3.0, travelTime: 16, averageAQI: 38, streetName: 'Chelsea Bridge Road' },
  
  { from: 'P', to: 'H', distance: 2.8, travelTime: 14, averageAQI: 38, streetName: 'Clapham Road' },
  { from: 'P', to: 'O', distance: 2.2, travelTime: 12, averageAQI: 32, streetName: 'Battersea Park Road' },
  { from: 'P', to: 'Q', distance: 2.5, travelTime: 14, averageAQI: 28, streetName: 'Brixton Hill' },
  
  { from: 'Q', to: 'P', distance: 2.5, travelTime: 14, averageAQI: 28, streetName: 'Brixton Hill' },
  { from: 'Q', to: 'R', distance: 2.0, travelTime: 11, averageAQI: 25, streetName: 'Dulwich Road' },
  { from: 'Q', to: 'U', distance: 4.5, travelTime: 22, averageAQI: 95, streetName: 'A2' },
  
  { from: 'R', to: 'Q', distance: 2.0, travelTime: 11, averageAQI: 25, streetName: 'Dulwich Road' },
  { from: 'R', to: 'U', distance: 3.8, travelTime: 18, averageAQI: 88, streetName: 'A205' },
  
  // Eastern Industrial - HIGH AQI (faster but polluted)
  { from: 'S', to: 'B', distance: 4.5, travelTime: 20, averageAQI: 135, streetName: 'Commercial Road' },
  { from: 'S', to: 'G', distance: 5.0, travelTime: 22, averageAQI: 145, streetName: 'A1261' },
  { from: 'S', to: 'T', distance: 2.5, travelTime: 8, averageAQI: 160, streetName: 'Aspen Way' },
  { from: 'S', to: 'U', distance: 3.0, travelTime: 10, averageAQI: 150, streetName: 'A1020' },
  
  { from: 'T', to: 'S', distance: 2.5, travelTime: 8, averageAQI: 160, streetName: 'Aspen Way' },
  { from: 'T', to: 'U', distance: 2.0, travelTime: 7, averageAQI: 155, streetName: 'Royal Albert Way' },
  
  { from: 'U', to: 'S', distance: 3.0, travelTime: 10, averageAQI: 150, streetName: 'A1020' },
  { from: 'U', to: 'T', distance: 2.0, travelTime: 7, averageAQI: 155, streetName: 'Royal Albert Way' },
  { from: 'U', to: 'Q', distance: 4.5, travelTime: 22, averageAQI: 95, streetName: 'A2' },
  { from: 'U', to: 'R', distance: 3.8, travelTime: 18, averageAQI: 88, streetName: 'A205' },
  { from: 'U', to: 'E', distance: 5.5, travelTime: 25, averageAQI: 110, streetName: 'Old Kent Road' },
  
  // Western Residential - LOW AQI
  { from: 'V', to: 'F', distance: 0.8, travelTime: 5, averageAQI: 30, streetName: 'Kensington Gardens' },
  { from: 'V', to: 'I', distance: 0.6, travelTime: 4, averageAQI: 32, streetName: 'Exhibition Road' },
  { from: 'V', to: 'W', distance: 2.0, travelTime: 12, averageAQI: 38, streetName: 'Kensington Church St' },
  { from: 'V', to: 'X', distance: 1.2, travelTime: 7, averageAQI: 35, streetName: 'Kensington High St' },
  
  { from: 'W', to: 'V', distance: 2.0, travelTime: 12, averageAQI: 38, streetName: 'Kensington Church St' },
  { from: 'W', to: 'L', distance: 3.5, travelTime: 20, averageAQI: 42, streetName: 'Prince Albert Road' },
  { from: 'W', to: 'X', distance: 1.5, travelTime: 8, averageAQI: 36, streetName: 'Holland Park Ave' },
  
  { from: 'X', to: 'I', distance: 1.8, travelTime: 10, averageAQI: 38, streetName: 'Holland Walk' },
  { from: 'X', to: 'V', distance: 1.2, travelTime: 7, averageAQI: 35, streetName: 'Kensington High St' },
  { from: 'X', to: 'W', distance: 1.5, travelTime: 8, averageAQI: 36, streetName: 'Holland Park Ave' },
  { from: 'X', to: 'O', distance: 4.0, travelTime: 22, averageAQI: 45, streetName: 'Fulham Road' },
];

// Store for real-time AQI updates
let aqiUpdateCallbacks = [];

// Subscribe to AQI updates
export const subscribeToAQIUpdates = (callback) => {
  aqiUpdateCallbacks.push(callback);
  return () => {
    aqiUpdateCallbacks = aqiUpdateCallbacks.filter(cb => cb !== callback);
  };
};

// Simulate real-time AQI updates from server
export const startAQISimulation = () => {
  const updateInterval = setInterval(() => {
    edges = edges.map(edge => ({
      ...edge,
      // Fluctuate AQI by ±10% to simulate real-time changes
      averageAQI: Math.max(15, Math.min(200, 
        edge.averageAQI + (Math.random() - 0.5) * edge.averageAQI * 0.1
      ))
    }));
    
    // Notify all subscribers
    aqiUpdateCallbacks.forEach(callback => callback(edges));
  }, 5000); // Update every 5 seconds
  
  return () => clearInterval(updateInterval);
};

// Get current edges
export const getEdges = () => edges;

// Update edges from server (simulated)
export const updateEdgesFromServer = (newEdges) => {
  edges = newEdges;
  aqiUpdateCallbacks.forEach(callback => callback(edges));
};

// Build adjacency list for the graph
export const buildGraph = (currentEdges = edges) => {
  const graph = {};
  
  Object.keys(nodes).forEach(nodeId => {
    graph[nodeId] = [];
  });
  
  currentEdges.forEach(edge => {
    graph[edge.from].push({
      to: edge.to,
      distance: edge.distance,
      travelTime: edge.travelTime,
      averageAQI: edge.averageAQI,
      streetName: edge.streetName,
    });
  });
  
  return graph;
};

// Get normalization factors
export const getNormalizationFactors = (currentEdges = edges) => {
  let maxDistance = 0;
  let maxTravelTime = 0;
  let maxAQI = 0;
  
  currentEdges.forEach(edge => {
    if (edge.distance > maxDistance) maxDistance = edge.distance;
    if (edge.travelTime > maxTravelTime) maxTravelTime = edge.travelTime;
    if (edge.averageAQI > maxAQI) maxAQI = edge.averageAQI;
  });
  
  return { maxDistance, maxTravelTime, maxAQI };
};

// Find nearest node to a given lat/lng
export const findNearestNode = (lat, lng) => {
  let nearestNode = null;
  let minDistance = Infinity;
  
  Object.values(nodes).forEach(node => {
    const distance = Math.sqrt(
      Math.pow(node.lat - lat, 2) + Math.pow(node.lng - lng, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestNode = node;
    }
  });
  
  return nearestNode;
};

// Calculate bearing between two points
export const calculateBearing = (lat1, lng1, lat2, lng2) => {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;
  
  return bearing;
};

// Get turn direction
export const getTurnDirection = (prevBearing, newBearing) => {
  let diff = newBearing - prevBearing;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  if (Math.abs(diff) < 20) return 'straight';
  if (diff > 0 && diff < 70) return 'slight-right';
  if (diff >= 70 && diff < 120) return 'right';
  if (diff >= 120) return 'sharp-right';
  if (diff < 0 && diff > -70) return 'slight-left';
  if (diff <= -70 && diff > -120) return 'left';
  if (diff <= -120) return 'sharp-left';
  
  return 'straight';
};
