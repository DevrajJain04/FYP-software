/**
 * @deprecated LEGACY FILE - This file is no longer used for main routing.
 * 
 * The app now uses OpenRouteService (ORS) for routing instead of this Dijkstra implementation.
 * The only functions still in use are formatTime and formatDistance, which have been
 * moved to utils/formatters.js
 * 
 * For routing, see: services/routingService.js
 * For formatting utilities, see: utils/formatters.js
 * 
 * Consider removing this file if no longer needed.
 */

import { buildGraph, getNormalizationFactors, nodes, calculateBearing, getTurnDirection, getEdges } from '../data/graphData';

/**
 * Priority Queue implementation for Dijkstra's algorithm
 */
class PriorityQueue {
  constructor() {
    this.values = [];
  }

  enqueue(val, priority) {
    this.values.push({ val, priority });
    this.sort();
  }

  dequeue() {
    return this.values.shift();
  }

  sort() {
    this.values.sort((a, b) => a.priority - b.priority);
  }

  isEmpty() {
    return this.values.length === 0;
  }
}

/**
 * Calculate edge cost based on weighted parameters
 */
export const calculateEdgeCost = (edge, weights, normFactors) => {
  const { w1, w2, w3 } = weights;
  const { maxDistance, maxTravelTime, maxAQI } = normFactors;
  
  const normalizedDistance = edge.distance / maxDistance;
  const normalizedTime = edge.travelTime / maxTravelTime;
  const normalizedAQI = edge.averageAQI / maxAQI;
  
  const cost = (w1 * normalizedDistance) + (w2 * normalizedTime) + (w3 * normalizedAQI);
  
  return cost;
};

/**
 * Generate turn-by-turn directions
 */
export const generateDirections = (path, pathEdges) => {
  if (!path || path.length < 2) return [];
  
  const directions = [];
  let cumulativeDistance = 0;
  let cumulativeTime = 0;
  
  // Start direction
  directions.push({
    type: 'start',
    instruction: `Start at ${nodes[path[0]].name}`,
    streetName: nodes[path[0]].address,
    distance: 0,
    time: 0,
    cumulativeDistance: 0,
    cumulativeTime: 0,
    nodeId: path[0],
    icon: '🚗'
  });
  
  let prevBearing = null;
  
  for (let i = 0; i < path.length - 1; i++) {
    const fromNode = nodes[path[i]];
    const toNode = nodes[path[i + 1]];
    const edge = pathEdges[i];
    
    // Calculate bearing for this segment
    const bearing = calculateBearing(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
    
    // Determine turn direction
    let turnType = 'straight';
    let icon = '⬆️';
    
    if (prevBearing !== null) {
      turnType = getTurnDirection(prevBearing, bearing);
      
      switch (turnType) {
        case 'slight-right':
          icon = '↗️';
          break;
        case 'right':
          icon = '➡️';
          break;
        case 'sharp-right':
          icon = '↪️';
          break;
        case 'slight-left':
          icon = '↖️';
          break;
        case 'left':
          icon = '⬅️';
          break;
        case 'sharp-left':
          icon = '↩️';
          break;
        default:
          icon = '⬆️';
      }
    }
    
    cumulativeDistance += edge.distance;
    cumulativeTime += edge.travelTime;
    
    // Generate instruction
    let instruction = '';
    const turnWord = {
      'straight': 'Continue straight',
      'slight-right': 'Turn slightly right',
      'right': 'Turn right',
      'sharp-right': 'Make a sharp right',
      'slight-left': 'Turn slightly left',
      'left': 'Turn left',
      'sharp-left': 'Make a sharp left'
    }[turnType] || 'Continue';
    
    instruction = `${turnWord} onto ${edge.streetName}`;
    
    // Add AQI indicator
    let aqiIndicator = '';
    if (edge.averageAQI < 50) {
      aqiIndicator = ' 🌿 (Excellent air quality)';
    } else if (edge.averageAQI < 100) {
      aqiIndicator = ' 🍃 (Good air quality)';
    } else if (edge.averageAQI > 120) {
      aqiIndicator = ' ⚠️ (Poor air quality)';
    }
    
    directions.push({
      type: 'turn',
      turnType,
      instruction: instruction + aqiIndicator,
      streetName: edge.streetName,
      distance: edge.distance,
      time: edge.travelTime,
      cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
      cumulativeTime: Math.round(cumulativeTime),
      aqi: Math.round(edge.averageAQI),
      nodeId: path[i + 1],
      icon
    });
    
    prevBearing = bearing;
  }
  
  // End direction
  directions.push({
    type: 'end',
    instruction: `Arrive at ${nodes[path[path.length - 1]].name}`,
    streetName: nodes[path[path.length - 1]].address,
    distance: 0,
    time: 0,
    cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
    cumulativeTime: Math.round(cumulativeTime),
    nodeId: path[path.length - 1],
    icon: '🏁'
  });
  
  return directions;
};

/**
 * Dijkstra's algorithm implementation with weighted cost function
 */
export const dijkstra = (start, end, weights, currentEdges = null) => {
  const edgesToUse = currentEdges || getEdges();
  const graph = buildGraph(edgesToUse);
  const normFactors = getNormalizationFactors(edgesToUse);
  
  const distances = {};
  const previous = {};
  const edgeDetails = {};
  const pq = new PriorityQueue();
  
  Object.keys(graph).forEach(node => {
    distances[node] = node === start ? 0 : Infinity;
    previous[node] = null;
    edgeDetails[node] = null;
  });
  
  pq.enqueue(start, 0);
  
  while (!pq.isEmpty()) {
    const { val: currentNode } = pq.dequeue();
    
    if (currentNode === end) break;
    if (distances[currentNode] === Infinity) continue;
    
    graph[currentNode].forEach(neighbor => {
      const cost = calculateEdgeCost(neighbor, weights, normFactors);
      const newDist = distances[currentNode] + cost;
      
      if (newDist < distances[neighbor.to]) {
        distances[neighbor.to] = newDist;
        previous[neighbor.to] = currentNode;
        edgeDetails[neighbor.to] = {
          distance: neighbor.distance,
          travelTime: neighbor.travelTime,
          averageAQI: neighbor.averageAQI,
          streetName: neighbor.streetName,
        };
        pq.enqueue(neighbor.to, newDist);
      }
    });
  }
  
  // Reconstruct path
  const path = [];
  const pathEdges = [];
  let current = end;
  
  if (previous[end] === null && start !== end) {
    return {
      path: [],
      pathEdges: [],
      directions: [],
      totalCost: Infinity,
      totalDistance: 0,
      totalTime: 0,
      averageAQI: 0,
      found: false,
    };
  }
  
  while (current !== null) {
    path.unshift(current);
    if (edgeDetails[current]) {
      pathEdges.unshift(edgeDetails[current]);
    }
    current = previous[current];
  }
  
  // Calculate totals
  let totalDistance = 0;
  let totalTime = 0;
  let totalAQI = 0;
  
  pathEdges.forEach(edge => {
    totalDistance += edge.distance;
    totalTime += edge.travelTime;
    totalAQI += edge.averageAQI;
  });
  
  const avgAQI = pathEdges.length > 0 ? totalAQI / pathEdges.length : 0;
  
  // Generate turn-by-turn directions
  const directions = generateDirections(path, pathEdges);
  
  return {
    path,
    pathEdges,
    directions,
    totalCost: distances[end],
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalTime: Math.round(totalTime),
    averageAQI: Math.round(avgAQI),
    found: true,
  };
};

/**
 * Calculate shortest distance route (ignore time and AQI)
 */
export const getShortestRoute = (start, end, currentEdges = null) => {
  return dijkstra(start, end, { w1: 1, w2: 0, w3: 0 }, currentEdges);
};

/**
 * Calculate fastest time route (ignore distance and AQI)
 */
export const getFastestRoute = (start, end, currentEdges = null) => {
  return dijkstra(start, end, { w1: 0, w2: 1, w3: 0 }, currentEdges);
};

/**
 * Calculate cleanest air route (ignore distance and time)
 */
export const getCleanestRoute = (start, end, currentEdges = null) => {
  return dijkstra(start, end, { w1: 0, w2: 0, w3: 1 }, currentEdges);
};

/**
 * Get all route alternatives
 */
export const getAllRouteAlternatives = (start, end, weights, currentEdges = null) => {
  const customRoute = dijkstra(start, end, weights, currentEdges);
  const shortestRoute = getShortestRoute(start, end, currentEdges);
  const fastestRoute = getFastestRoute(start, end, currentEdges);
  const cleanestRoute = getCleanestRoute(start, end, currentEdges);
  
  return {
    custom: { ...customRoute, label: 'Custom Route', color: getPathColor(weights) },
    shortest: { ...shortestRoute, label: 'Shortest Route', color: '#3b82f6' },
    fastest: { ...fastestRoute, label: 'Fastest Route', color: '#f59e0b' },
    cleanest: { ...cleanestRoute, label: 'Cleanest Air Route', color: '#10b981' },
  };
};

/**
 * Determine path color based on dominant weight
 */
export const getPathColor = (weights) => {
  const { w1, w2, w3 } = weights;
  const total = w1 + w2 + w3;
  
  if (total === 0) return '#667eea';
  
  const nw1 = w1 / total;
  const nw2 = w2 / total;
  const nw3 = w3 / total;
  
  if (nw3 > 0.5) return '#10b981'; // Green for AQI
  if (nw1 > 0.5) return '#3b82f6'; // Blue for distance
  if (nw2 > 0.5) return '#f59e0b'; // Orange for time
  
  // Blend colors for mixed weights
  const r = Math.round(59 + (nw2 * 150));
  const g = Math.round(130 + (nw3 * 100));
  const b = Math.round(100 + (nw1 * 100));
  
  return `rgb(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)})`;
};

/**
 * Get route preference label
 */
export const getRoutePreferenceLabel = (weights) => {
  const { w1, w2, w3 } = weights;
  const total = w1 + w2 + w3;
  
  if (total === 0) return 'No preference set';
  
  const nw1 = w1 / total;
  const nw2 = w2 / total;
  const nw3 = w3 / total;
  
  const preferences = [];
  if (nw1 > 0.3) preferences.push('Shortest');
  if (nw2 > 0.3) preferences.push('Fastest');
  if (nw3 > 0.3) preferences.push('Cleanest Air');
  
  if (preferences.length === 0) return 'Balanced Route';
  return preferences.join(' & ') + ' Route';
};

/**
 * Format time for display
 */
export const formatTime = (minutes) => {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours} hr ${mins} min`;
};

/**
 * Format distance for display
 */
export const formatDistance = (km) => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
};
