# Frontend Integration Guide - Green Corridor Backend Services

This guide explains how to integrate the React frontend (`weighted-routing-app`) with the Green Corridor backend microservices.

## 📍 Service Overview

| Service | URL | Purpose |
|---------|-----|---------|
| **Routing Service** | `http://localhost:8000` | Route calculation with AQI weighting |
| **Ingestion Service** | `http://localhost:8080` | Vehicle telemetry data ingestion |
| **AQI Scraper Service** | `http://localhost:8082` | Fallback AQI data from monitoring stations |
| **Redis Commander** | `http://localhost:8081` | Debug UI for Redis (optional) |

---

## 🚀 Quick Setup

### 1. Start Backend Services

```bash
cd Backend
docker compose up --build -d
```

### 2. Verify Services Are Running

```bash
# Check all containers are healthy
docker compose ps

# Test health endpoints
curl http://localhost:8000/health      # Routing Service
curl http://localhost:8080/api/v1/health  # Ingestion Service
curl http://localhost:8082/health      # AQI Scraper
```

### 3. Configure Frontend Environment

Create or update `.env` in `weighted-routing-app/`:

```env
# Backend API URLs
REACT_APP_ROUTING_API_URL=http://localhost:8000
REACT_APP_INGESTION_API_URL=http://localhost:8080
REACT_APP_AQI_SCRAPER_URL=http://localhost:8082

# Optional: OpenRouteService for comparison
REACT_APP_ORS_API_KEY=your_ors_api_key_here
```

### 4. Start Frontend

```bash
cd weighted-routing-app
npm install
npm start
```

---

## 🔌 API Integration

### Routing Service (`http://localhost:8000`)

#### Calculate Route

**POST** `/api/v1/route`

Calculate an optimal route balancing travel time and air quality.

```javascript
// routingService.js

const ROUTING_API = process.env.REACT_APP_ROUTING_API_URL || 'http://localhost:8000';

/**
 * Calculate route with AQI-aware pathfinding
 * @param {Object} origin - { lat: number, lng: number }
 * @param {Object} destination - { lat: number, lng: number }
 * @param {number} balance - 0 (fastest) to 1 (cleanest air), default 0.5
 * @param {number} alternatives - Number of alternative routes (1-5)
 * @returns {Promise<Object>} Route response with alternatives
 */
export async function calculateGreenRoute(origin, destination, balance = 0.5, alternatives = 3) {
  const response = await fetch(`${ROUTING_API}/api/v1/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      balance,
      alternatives,
    }),
  });

  if (!response.ok) {
    throw new Error(`Routing failed: ${response.status}`);
  }

  return response.json();
}
```

**Request Schema:**
```json
{
  "origin": { "lat": 19.0760, "lng": 72.8777 },
  "destination": { "lat": 19.0178, "lng": 72.8478 },
  "balance": 0.5,
  "alternatives": 3
}
```

**Response Schema:**
```json
{
  "routes": [
    {
      "route_id": "uuid",
      "coordinates": [[lng, lat], [lng, lat], ...],
      "total_distance_m": 5420.5,
      "total_duration_s": 845.2,
      "average_aqi": 67.3,
      "max_aqi": 125.0,
      "weighted_cost": 0.42,
      "steps": [],
      "metadata": {
        "node_count": 45,
        "aqi_data_coverage": 0.85
      }
    }
  ],
  "origin": { "lat": 19.0760, "lng": 72.8777 },
  "destination": { "lat": 19.0178, "lng": 72.8478 },
  "balance": 0.5,
  "calculated_at": "2026-01-09T12:00:00Z"
}
```

#### Get Hexagon AQI

**GET** `/api/v1/aqi/hexagon/{hex_id}`

```javascript
export async function getHexagonAQI(hexId) {
  const response = await fetch(`${ROUTING_API}/api/v1/aqi/hexagon/${hexId}`);
  if (!response.ok) throw new Error(`Failed to get AQI: ${response.status}`);
  return response.json();
}
```

#### Get Area AQI Heatmap

**POST** `/api/v1/aqi/area`

Get AQI data for all hexagons within a bounding box (for heatmap visualization).

```javascript
export async function getAreaAQI(bounds) {
  const response = await fetch(`${ROUTING_API}/api/v1/aqi/area`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
    }),
  });
  return response.json();
}
```

---

### Ingestion Service (`http://localhost:8080`)

#### Submit Vehicle Telemetry

**POST** `/api/v1/telemetry`

Submit real-time AQI readings from a vehicle sensor.

```javascript
const INGESTION_API = process.env.REACT_APP_INGESTION_API_URL || 'http://localhost:8080';

/**
 * Submit single vehicle telemetry reading
 * @param {Object} telemetry - Vehicle sensor data
 */
export async function submitTelemetry(telemetry) {
  const response = await fetch(`${INGESTION_API}/api/v1/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicle_id: telemetry.vehicleId,
      latitude: telemetry.lat,
      longitude: telemetry.lng,
      aqi: telemetry.aqi,
      timestamp: new Date().toISOString(),
    }),
  });
  return response.json();
}
```

**Request Schema:**
```json
{
  "vehicle_id": "car_001",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "aqi": 85.5,
  "timestamp": "2026-01-09T12:00:00Z"
}
```

**Response Schema:**
```json
{
  "success": true,
  "message": "Telemetry ingested successfully",
  "hexagon_id": "8928308280fffff"
}
```

#### Submit Batch Telemetry

**POST** `/api/v1/telemetry/batch`

```javascript
export async function submitBatchTelemetry(readings) {
  const response = await fetch(`${INGESTION_API}/api/v1/telemetry/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: readings }),
  });
  return response.json();
}
```

---

### AQI Scraper Service (`http://localhost:8082`)

#### Get All Stations

**GET** `/stations`

```javascript
const SCRAPER_API = process.env.REACT_APP_AQI_SCRAPER_URL || 'http://localhost:8082';

export async function getAllStations() {
  const response = await fetch(`${SCRAPER_API}/stations`);
  return response.json();
}
```

#### Find Nearest Station

**GET** `/nearest?lat={lat}&lng={lng}`

```javascript
export async function getNearestStation(lat, lng) {
  const response = await fetch(`${SCRAPER_API}/nearest?lat=${lat}&lng=${lng}`);
  return response.json();
}
```

---

## 🎨 React Component Integration

### Example: Route Calculator Component

```jsx
import React, { useState } from 'react';
import { calculateGreenRoute } from '../services/routingService';

function RouteCalculator({ origin, destination }) {
  const [routes, setRoutes] = useState([]);
  const [balance, setBalance] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await calculateGreenRoute(origin, destination, balance, 3);
      setRoutes(result.routes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Route Options</h3>
      
      <label>
        Balance: {balance === 0 ? 'Fastest' : balance === 1 ? 'Cleanest Air' : 'Balanced'}
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={balance}
          onChange={(e) => setBalance(parseFloat(e.target.value))}
        />
      </label>

      <button onClick={handleCalculate} disabled={loading}>
        {loading ? 'Calculating...' : 'Find Route'}
      </button>

      {error && <p className="error">{error}</p>}

      {routes.map((route, idx) => (
        <div key={route.route_id} className="route-option">
          <h4>Route {idx + 1}</h4>
          <p>Distance: {(route.total_distance_m / 1000).toFixed(2)} km</p>
          <p>Duration: {Math.round(route.total_duration_s / 60)} min</p>
          <p>Average AQI: {route.average_aqi.toFixed(1)}</p>
          <p>Max AQI: {route.max_aqi.toFixed(1)}</p>
        </div>
      ))}
    </div>
  );
}

export default RouteCalculator;
```

### Example: AQI Heatmap Layer

```jsx
import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { getAreaAQI } from '../services/routingService';

function AQIHeatmapLayer() {
  const map = useMap();
  const [hexagons, setHexagons] = useState([]);

  useEffect(() => {
    const fetchAQI = async () => {
      const bounds = map.getBounds();
      const data = await getAreaAQI({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
      setHexagons(data.hexagons);
    };

    map.on('moveend', fetchAQI);
    fetchAQI();

    return () => map.off('moveend', fetchAQI);
  }, [map]);

  return (
    <>
      {hexagons.map((hex) => (
        <Circle
          key={hex.hexagon_id}
          center={[hex.center.lat, hex.center.lng]}
          radius={200}
          pathOptions={{
            color: getAQIColor(hex.median_aqi),
            fillOpacity: 0.5,
          }}
        />
      ))}
    </>
  );
}

function getAQIColor(aqi) {
  if (aqi <= 50) return '#22c55e';   // Good - Green
  if (aqi <= 100) return '#84cc16';  // Moderate - Yellow-green
  if (aqi <= 150) return '#f59e0b';  // USG - Orange
  if (aqi <= 200) return '#ef4444';  // Unhealthy - Red
  return '#7c2d12';                   // Very Unhealthy - Brown
}
```

---

## 📊 Balance Parameter Explained

The `balance` parameter controls the routing algorithm's priority:

| Balance | Behavior | Use Case |
|---------|----------|----------|
| `0.0` | Fastest route (ignore AQI) | Emergency, time-critical |
| `0.25` | Slight AQI preference | Normal commute |
| `0.5` | Equal weight (default) | Balanced routing |
| `0.75` | Strong AQI preference | Health-conscious |
| `1.0` | Cleanest air (ignore time) | Leisure walk, exercise |

**Cost Formula:**
```
Cost = (Time × (1 - balance)) + (AQI × balance)
```

---

## 🐛 Troubleshooting

### Backend Not Reachable

```bash
# Check containers are running
docker compose ps

# Check logs for errors
docker compose logs routing-service
docker compose logs ingestion-service
docker compose logs aqiscraper
```

### CORS Errors

The backend services include CORS middleware for `localhost:3000`. If you're on a different port, update the service configurations.

### No AQI Data

If routes show `average_aqi: 0`:

1. The scraper needs time to fetch initial data
2. Manually trigger a fetch: `curl -X POST http://localhost:8082/fetch`
3. Or submit test telemetry data via the ingestion service

### Redis Connection Issues

```bash
# Test Redis is running
docker exec green-corridor-redis redis-cli ping
# Should return: PONG
```

---

## 📁 Recommended Project Structure

```
src/
├── services/
│   ├── backendService.js      # All backend API calls
│   ├── routingService.js      # External routing (ORS fallback)
│   └── aqiService.js          # AQI utilities and categories
├── hooks/
│   ├── useRouting.js          # Route calculation hook
│   └── useAQIHeatmap.js       # AQI data fetching hook
├── components/
│   ├── MapComponent.js        # Leaflet map with routes
│   ├── RouteAlternatives.js   # Route comparison UI
│   └── AQIHeatmap.js          # H3 hexagon visualization
└── utils/
    └── aqiColors.js           # AQI category colors/labels
```

---

## 🔗 Full Backend Service File

Create `src/services/backendService.js`:

```javascript
/**
 * Green Corridor Backend Service
 * Unified API client for all backend microservices
 */

const ROUTING_API = process.env.REACT_APP_ROUTING_API_URL || 'http://localhost:8000';
const INGESTION_API = process.env.REACT_APP_INGESTION_API_URL || 'http://localhost:8080';
const SCRAPER_API = process.env.REACT_APP_AQI_SCRAPER_URL || 'http://localhost:8082';

// ============ ROUTING SERVICE ============

export async function calculateRoute(origin, destination, balance = 0.5, alternatives = 3) {
  const response = await fetch(`${ROUTING_API}/api/v1/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, balance, alternatives }),
  });
  if (!response.ok) throw new Error(`Route calculation failed: ${response.status}`);
  return response.json();
}

export async function getHexagonAQI(hexId) {
  const response = await fetch(`${ROUTING_API}/api/v1/aqi/hexagon/${hexId}`);
  if (!response.ok) throw new Error(`Hexagon AQI fetch failed: ${response.status}`);
  return response.json();
}

export async function getAreaAQI(bounds) {
  const response = await fetch(`${ROUTING_API}/api/v1/aqi/area`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bounds),
  });
  return response.json();
}

// ============ INGESTION SERVICE ============

export async function submitTelemetry(vehicleId, lat, lng, aqi) {
  const response = await fetch(`${INGESTION_API}/api/v1/telemetry`, {
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
  return response.json();
}

export async function submitBatchTelemetry(dataArray) {
  const response = await fetch(`${INGESTION_API}/api/v1/telemetry/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: dataArray }),
  });
  return response.json();
}

export async function getIngestionStats() {
  const response = await fetch(`${INGESTION_API}/api/v1/stats`);
  return response.json();
}

// ============ SCRAPER SERVICE ============

export async function getScrapedStations() {
  const response = await fetch(`${SCRAPER_API}/stations`);
  return response.json();
}

export async function getNearestStation(lat, lng) {
  const response = await fetch(`${SCRAPER_API}/nearest?lat=${lat}&lng=${lng}`);
  return response.json();
}

export async function triggerAQIFetch() {
  const response = await fetch(`${SCRAPER_API}/fetch`, { method: 'POST' });
  return response.json();
}

// ============ HEALTH CHECKS ============

export async function checkBackendHealth() {
  const results = { routing: false, ingestion: false, scraper: false };

  try {
    const r1 = await fetch(`${ROUTING_API}/health`);
    results.routing = r1.ok;
  } catch {}

  try {
    const r2 = await fetch(`${INGESTION_API}/api/v1/health`);
    results.ingestion = r2.ok;
  } catch {}

  try {
    const r3 = await fetch(`${SCRAPER_API}/health`);
    results.scraper = r3.ok;
  } catch {}

  return results;
}
```

---

## ✅ Checklist Before Production

- [ ] Set proper CORS origins in backend services
- [ ] Configure HTTPS for all services
- [ ] Set up proper API rate limiting
- [ ] Add authentication if needed
- [ ] Update `.env` with production URLs
- [ ] Test with real AQI data sources
