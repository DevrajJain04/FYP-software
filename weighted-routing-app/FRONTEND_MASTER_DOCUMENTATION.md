GREEN CORRIDOR - FRONTEND MASTER DOCUMENTATION
======================================================
Generated: January 9, 2026
Version: 1.0
Status: Active

1. APP ARCHITECTURE & OVERVIEW
======================================================
The "Weighted Routing App" is a React-based Single Page Application (SPA) that serves as the user interface for the Green Corridor system. It visualizes pollution-aware routing, real-time AQI heatmaps, and allows users to customize their routing preferences based on health vs. speed trade-offs.

**Tech Stack**:
- **Framework**: React 18
- **Maps**: Leaflet (via `react-leaflet`)
- **State**: React Hooks (`useState`, `useEffect`, `useCallback`)
- **Styling**: CSS Modules / Standard CSS
- **Build Tool**: Create React App (Webpack)

2. CORE MODULES & SERVICES
======================================================

2.1. Unified Backend Service (`services/backendService.js`)
------------------------------------------------------
Acts as the bridge between the UI and the microservices backend.
- **Routing**: `calculateRoute(origin, dest, balance)` - Calls Python Routing Service.
- **Ingestion**: `submitTelemetry(id, lat, lng, aqi)` - Calls Go Ingestion Service (for simulation).
- **AQI**: `getHexagonAQI(h3Index)` & `getAreaAQI(bounds)` - Fetches pollution context.

2.2. Smart Routing Logic (`services/routingService.js`)
------------------------------------------------------
Implements a failover strategy:
1. **Primary**: Attempt to fetch route from own Backend (Python/A*).
   - This returns routes with *server-calculated* AQI metrics.
2. **Fallback**: If backend fails or returns no path, fall back to OpenRouteService (ORS) or internal heuristic routing.
   - In this case, the frontend must *overlay* AQI data onto the geometry itself using `calculateRouteAQI`.

2.3. AQI Data Mananger (`data/aqiData.js`)
------------------------------------------------------
- **Simulation**: Can generate fake pollution clouds (`aqiZones`) moving across the map for demo purposes.
- **Interpolation**: Provides utilities to estimate AQI at any verify coordinate based on known zones or backend data.

3. COMPONENT ARCHITECTURE
======================================================

3.1. Main Orchestrator (`App.js`)
------------------------------------------------------
The root component handling global state:
- **State**:
  - `startCoords` / `endCoords`: Route endpoints.
  - `balance`: The user's preference sliding from 0.0 (Fastest) to 1.0 (Cleanest).
  - `weights`: Legacy weights for local calculation (w1=dist, w2=time, w3=aqi).
  - `routes`: Array of calculated route objects.
- **Effects**:
  - Monitors `balance` changes to trigger re-calculation.
  - Subscribes to Real-time AQI updates to refresh route scores.

3.2. Map Visualization (`components/MapComponent.js`)
------------------------------------------------------
A sophisticated Leaflet implementation.
- **Features**:
  - **Draggable Markers**: Custom SVG icons for Start (Green A) and End (Red B).
  - **AQI Heatmap**: Renders `Circle` overlays for pollution zones.
  - **Polyline Rendering**: Draws routes.
    - *Color Coding*: Green (<50), Yellow (50-100), Orange (100-150), Red (>150).
    - *Interaction*: Click to select alternative routes.
  - **Dynamic Bounds**: Auto-zooms (`fitBounds`) to show the entire route.

3.3. UI Control Panels
------------------------------------------------------
- **LocationSearch.js**: Auto-complete for Indian cities + Geocoding utility.
- **WeightSliders.js**: Visual sliders for adjusting the "Health vs Time" balance.
- **DirectionsPanel.js**: Displays turn-by-turn instructions and route summary (Distance, Duration, Avg AQI).
- **AQIStatus.js**: Shows current environment status (clean/hazardous).

4. DATA FLOWS
======================================================

Flow 1: User Calculates a Route
------------------------------------------------------
1. User drags markers or inputs text in `LocationSearch`.
2. `App.js` updates `startCoords` / `endCoords`.
3. `calculateRoutes` is triggered (debounced).
4. `backendService.calculateRoute` is called with `balance` param.
5. **Success**: Backend returns 3 route alternatives with geometry and pre-calculated AQI.
6. `App.js` sorts them by `weightedCost` and passes them to `MapComponent`.

Flow 2: Real-time Simulation
------------------------------------------------------
1. `App.js` mounts -> `startAQISimulation()` starts.
2. An interval updates the positions of "Pollution Clouds" in `aqiData.js`.
3. `subscribeToAQIUpdates` callback fires in `App.js`.
4. Routes are re-evaluated against the new pollution positions.
5. Note: Ideally, this triggers a backend re-fetch, but for simulation performance, it often recalculates metrics locally.

5. INTEGRATION CONFIGURATION
======================================================
Environment variables control the API endpoints (see `.env`):
- `REACT_APP_ROUTING_API_URL`: defaults to `http://localhost:8000`
- `REACT_APP_INGESTION_API_URL`: defaults to `http://localhost:8080`
- `REACT_APP_AQI_SCRAPER_URL`: defaults to `http://localhost:8082`

6. FOLDER STRUCTURE
======================================================
```
src/
├── components/         # Reusable UI widgets
│   ├── MapComponent.js # Leaflet wrapper
│   ├── NodeSelector.js # Debug tool for graph nodes
│   └── ...
├── data/              # Static data & Simulation logic
│   ├── aqiData.js     # Pollution cloud simulation
│   └── graphData.js   # Fallback static graph
├── services/          # API Clients
│   ├── backendService.js # Main API wrapper
│   └── routingService.js # Logic for smart failover
├── utils/             # Helpers
│   └── formatters.js  # Time/Distance formatting
└── App.js             # Application Entry & State
```
