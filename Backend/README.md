# Green Corridor Backend - Microservices Architecture

A high-performance routing engine that balances **Travel Time** and **Air Quality (AQI)** to find optimal "green corridors" through urban areas.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Moving Cars   │────▶│ Ingestion (Go)  │────▶│     Redis       │
│  (Telemetry)    │     │  Port: 8080     │     │  Port: 6379     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
┌─────────────────┐     ┌─────────────────┐              │
│   AQI Scraper   │────▶│                 │              │
│  Port: 8082     │     │                 │              │
└─────────────────┘     │                 │              │
                        │                 │              │
┌─────────────────┐     │ Routing (Python)│◀─────────────┘
│  Frontend App   │◀───▶│  Port: 8000     │
│                 │     │                 │
└─────────────────┘     └─────────────────┘
```

## Services

### 1. Ingestion Service (Go) - `/ingestion-service`
- **Purpose**: High-concurrency data ingestion from thousands of vehicles
- **Tech**: Go, Fiber, H3-Go, Redis
- **Port**: 8080
- **Features**:
  - Receives vehicle telemetry (Lat, Long, AQI, Vehicle_ID)
  - Converts coordinates to H3 Hexagon Index (Resolution 9)
  - Implements "debounce" strategy - one car = one vote per hexagon

### 2. Routing Service (Python) - `/routing-service`
- **Purpose**: Complex graph-based pathfinding with AQI-aware routing
- **Tech**: Python, FastAPI, OSMnx, NetworkX, H3
- **Port**: 8000
- **Features**:
  - Fetches road graphs via OSMnx
  - Enriches edges with real-time AQI from Redis
  - Custom A* algorithm: `Cost = (Time * (1-balance)) + (AQI * balance)`
  - **Falls back to scraped station AQI when no vehicle data available**

### 3. AQI Scraper Service (Go) - `/aqiscraper`
- **Purpose**: Scrapes official AQI monitoring station data as fallback
- **Tech**: Go, Colly, H3-Go, Redis
- **Port**: 8082
- **Features**:
  - Scrapes Mumbai AQI data from aqi.in
  - Extracts station coordinates (lat/lng) from page data
  - Maps stations to H3 hexagons for spatial lookup
  - Provides nearest-station lookup API
  - Auto-refreshes data every 30 minutes

### 4. Redis - Shared State
- **Purpose**: High-speed shared memory between services
- **Data Structure**: Hash Maps keyed by H3 Hexagon ID
- **Schema**: 
  - Vehicle AQI: `aqi:h3:{hex_id}` → `{vehicle_id: aqi_value, ...}`
  - Station AQI: `station:h3:{hex_id}` → `{station_json}`

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Go 1.21+
- Python 3.11+

### Using Docker Compose (Recommended)
```bash
cd Backend
docker-compose up --build
```

### Manual Setup

**1. Start Redis:**
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

**2. Start Ingestion Service:**
```bash
cd ingestion-service
go mod download
go run cmd/server/main.go
```

**3. Start AQI Scraper Service:**
```bash
cd aqiscraper
go mod download
go run main.go
```

**4. Start Routing Service:**
```bash
cd routing-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

### Ingestion Service (Port 8080)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/telemetry` | Submit vehicle telemetry |
| POST | `/api/v1/telemetry/batch` | Submit batch telemetry |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/stats` | Get ingestion statistics |

### Routing Service (Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/route` | Calculate optimal route |
| GET | `/api/v1/aqi/hexagon/{hex_id}` | Get AQI for hexagon |
| GET | `/api/v1/aqi/area` | Get AQI heatmap for area |
| GET | `/health` | Health check |

### AQI Scraper Service (Port 8082)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with station count |
| GET | `/stations` | List all scraped stations |
| GET | `/h3?h3={index}` | Get station for H3 hexagon |
| GET | `/nearest?lat={lat}&lng={lng}` | Find nearest station |
| POST | `/scrape` | Trigger manual scrape |

## Example Usage

### Submit Vehicle Telemetry
```bash
curl -X POST http://localhost:8080/api/v1/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "car_001",
    "latitude": 1.3521,
    "longitude": 103.8198,
    "aqi": 45.5,
    "timestamp": "2026-01-07T10:00:00Z"
  }'
```

### Request Optimal Route
```bash
curl -X POST http://localhost:8000/api/v1/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 1.3521, "lng": 103.8198},
    "destination": {"lat": 1.2966, "lng": 103.7764},
    "balance": 0.5
  }'
```

## Environment Variables

### Ingestion Service
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | Server port |
| REDIS_URL | localhost:6379 | Redis connection URL |
| H3_RESOLUTION | 9 | H3 hexagon resolution |
| AQI_TTL_SECONDS | 300 | TTL for AQI data (5 min) |

### Routing Service
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8000 | Server port |
| REDIS_URL | redis://localhost:6379 | Redis connection URL |
| H3_RESOLUTION | 9 | H3 hexagon resolution |
| GRAPH_CACHE_TTL | 3600 | Graph cache TTL (1 hour) |
| USE_STATION_FALLBACK | true | Enable fallback to scraped station data |
| SCRAPER_SERVICE_URL | http://aqiscraper:8082 | AQI scraper service URL |

### AQI Scraper Service
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8082 | Server port |
| REDIS_URL | localhost:6379 | Redis connection URL |
| H3_RESOLUTION | 9 | H3 hexagon resolution |
| SCRAPE_INTERVAL_MINUTES | 30 | Auto-scrape interval |
| STATION_TTL_MINUTES | 60 | TTL for station data |

## License
MIT License - Final Year Project 2026
