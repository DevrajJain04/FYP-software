# 🗺️ Smart Route Planner

A React application with Leaflet.js that finds optimal routes based on **distance**, **travel time**, and **air quality (AQI)**.

![Smart Route Planner](https://img.shields.io/badge/React-18.2-blue) ![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-green)

## Features

- **Green Corridor Backend Integration** - AQI-aware routing using real-time vehicle telemetry data
  - Automatic fallback to OpenRouteService when backend is unavailable
  - Real-time backend health monitoring
  
- **Weighted Routing Algorithm** - Calculate routes using customizable weights:
  - Backend Mode: `Balance slider (0=Fastest → 1=Cleanest Air)`
  - Legacy Mode: `Cost = (w1 × distance) + (w2 × travelTime) + (w3 × AQI)`
  
- **Google Maps-Style Interface**
  - Draggable start/end markers
  - Click-to-pin locations
  - Turn-by-turn directions with street names
  
- **Route Alternatives**
  - Shortest distance route
  - Fastest time route
  - Cleanest air route
  - Custom weighted route

- **Real-Time AQI Updates** - Live air quality data from vehicle sensors and monitoring stations

- **Visual Path Coloring**
  - 🟢 Green = Best route
  - 🔵 Blue = Alternative 1
  - 🟠 Orange = Alternative 2

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm
- (Optional) Green Corridor Backend services running

### Backend Setup (Recommended)

For full AQI-aware routing functionality, start the backend services:

```bash
cd Backend
docker compose up --build -d
```

See [Backend Integration Guide](./docs/BACKEND_INTEGRATION_GUIDE.md) for detailed setup instructions.

### Installation

```bash
# Clone the monorepo
git clone https://github.com/YOUR_USERNAME/FYP-software.git

# Navigate to repository root
cd FYP-software

# Navigate to frontend app
cd weighted-routing-app

# Copy environment file and configure
cp .env.example .env
# Edit .env to set your API keys and backend URLs

# Install dependencies
npm install

# Start development server
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## Environment Configuration

```env
# Backend API URLs
REACT_APP_ROUTING_API_URL=http://localhost:8000
REACT_APP_INGESTION_API_URL=http://localhost:8080
REACT_APP_AQI_SCRAPER_URL=http://localhost:8082

# Routing Mode: 'backend' or 'ors'
REACT_APP_ROUTING_MODE=backend

# OpenRouteService API Key (fallback)
REACT_APP_ORS_API_KEY=your_api_key_here
```

## Usage

1. **Select Locations**: Use dropdowns or click the 📍 button to pin locations on the map
2. **Adjust Route Priority**: 
   - Use the Balance slider to prioritize speed vs air quality
   - Expand "Advanced Settings" for fine-grained weight control
3. **View Routes**: See route alternatives and click to compare
4. **Follow Directions**: Expand the directions panel for turn-by-turn navigation

## Project Structure

```
src/
├── components/
│   ├── MapComponent.js      # Leaflet map with markers
│   ├── WeightSliders.js     # Weight adjustment controls
│   ├── NodeSelector.js      # Location selection
│   ├── DirectionsPanel.js   # Turn-by-turn directions
│   ├── RouteAlternatives.js # Route comparison
│   └── AQIStatus.js         # Real-time AQI indicator
├── services/
│   ├── backendService.js    # Green Corridor backend API client
│   ├── routingService.js    # Smart routing (backend + ORS)
│   └── aqiService.js        # AQI data fetching
├── data/
│   └── graphData.js         # Nodes, edges, and graph utilities
├── utils/
│   └── dijkstra.js          # Weighted routing algorithm
└── App.js                   # Main application
```

## Algorithm

### Backend Mode (Recommended)
The Green Corridor backend uses H3 hexagons with real-time AQI data:

```
Cost = (Time × (1 - balance)) + (AQI × balance)
```

### Legacy ORS Mode
Falls back to OpenRouteService with client-side AQI weighting:

```
Cost = (w1 × normalized_distance) + (w2 × normalized_time) + (w3 × normalized_AQI)
```

## Technologies

- **React** - UI framework
- **Leaflet.js** - Interactive maps
- **React-Leaflet** - React components for Leaflet
- **Green Corridor Backend** - Microservices for AQI-aware routing

## Documentation

- [Backend Integration Guide](./docs/BACKEND_INTEGRATION_GUIDE.md)
- [Hardware Interface](./docs/HARDWARE_INTERFACE.md)
- [Project Implementation](./docs/PROJECT_IMPLEMENTATION.md)

## License

MIT License
