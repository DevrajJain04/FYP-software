GREEN CORRIDOR - EXTENDED BACKEND MASTER DOCUMENTATION
======================================================
Generated: January 9, 2026
Version: 1.2
Status: Active

1. SYSTEM ARCHITECTURE & INTERNALS
======================================================
The Green Corridor backend is a sophisticated, distributed IoT system designed for real-time vehicular telemetry ingestion and pollution-aware route optimization. It combines high-throughput ingestion with graph-based algorithmic processing.

1.1. Service Mesh Overview
------------------------------------------------------
The system operates on a dedicated Docker bridge network (`green-corridor-network`) enabling service discovery via container names.

[External World]
      |
      +---(HTTP:8080)---> [Ingestion Service (Go)]
      |                        |
      +---(HTTP:8000)---> [Routing Service (Python)]
      |                        |
      +---(HTTP:8082)---> [AQI Scraper (Go)]
                               |
                               v
                       [Redis v7 (Hot State)]
                       [TimescaleDB v15 (Cold Storage)]

- **Ingestion Service**: High-concurrency Go application for receiving sensor data.
- **Routing Service**: FastAPI Python application using NetworkX and OSMnx for graph operations, now integrated with OpenRouteService (ORS) for detailed turn-by-turn navigation.
- **AQI Scraper**: Go background service aggregating data from WAQI and local sources.
- **Data Persistence**: Hybrid approach using Redis for real-time routing decisions and TimescaleDB for historical data analytics.

1.2. New Integration: OpenRouteService (ORS)
------------------------------------------------------
The Routing Service now includes a dedicated `OpenRouteServiceClient` (`ors_service.py`) to provide professional-grade turn-by-turn navigation while maintaining our custom "Green Routing" logic.

- **Role**: Fallback & Detail Provider.
- **Flow**:
  1. The custom A* algorithm finds the optimal *path* (sequence of nodes) based on pollution weights.
  2. If detailed instructions are needed, the path geometry can be matched against ORS.
  3. Alternatively, if the graph Service fails, ORS calculates the base route, which we then overlay with AQI data.
- **Features**: Maneuver decoding (Turn Left, Keep Right), Roundabout handling, and specific road warnings.

2. DETAILED MODULE SPECIFICATIONS
======================================================

2.1. Ingestion Service (Go)
--------------------------
**Design Principle**: "Fire and Forget" for speed, "One Vehicle One Vote" for accuracy.

**Core Processing (`telemetry.go`)**:
1. **Request Validation**: Strictly validates Lat (-90 to 90), Lng (-180 to 180), and AQI (0 to 500).
2. **Geospatial Indexing**: Converts coordinates to H3 Index (Resolution 9).
   - Res 9 Area: ~0.1 km² (Neighborhood block size).
   - Res 9 Edge: ~174 m.
3. **Data Debouncing (Redis)**:
   - Uses `HSET aqi:h3:{hex_id} {vehicle_id} {aqi}`.
   - This prevents stationary vehicles from skewing average pollution data for a hexagon. A vehicle only updates its *own* entry in the hash.
   - TTL (Time To Live): 5 minutes. Data expires if no updates occur.
4. **Persistence (Postgres)**:
   - Spawns a non-blocking goroutine to write to TimescaleDB.
   - Writes to `vehicle_telemetry` hypertable for long-term storage.

2.2. Routing Service (Python)
--------------------------
**Design Principle**: Weighted Graph Traversal.

**Graph Engine (`graph_service.py`)**:
- Uses `OSMnx` to fetch "drive" network graphs from OpenStreetMap.
- **Caching**: Implements `TTLCache` (1 hour) keyed by the MD5 hash of the bounding box coordinates. This prevents frequent slow calls to Overpass API.
- **Enrichment**:
  - Iterates every edge in the graph.
  - Interpolates points along the edge (every 50m).
  - Fetches AQI for each point's H3 hexagon from Redis.
  - `Edge_AQI = Average(Hexagon_AQIs)`.

**Routing Algorithm (`routing_service.py`)**:
- **Algorithm**: A* (A-Star).
- **Heuristic**: Haversine Distance / Max Speed (50m/s).
- **Cost Function**:
  ```python
  # balance: 0.0 (Fast) ... 1.0 (Clean)
  Cost = (Time * (1 - balance)) + (AQI * 0.6 * balance)
  ```
- **Alternative Routes**: Uses a "Penalty Method". After finding the best route, edges used in that route are penalized (cost * 1.5), and the search runs again.

2.3. AQI Scraper (Go)
--------------------------
**Design Principle**: Parallel Aggregation.

- **Aggregation**: Fetches from:
  1. **AQI.in**: Scrapes Indian city lists and specific station pages.
  2. **WAQI**: Uses Bounding Box approach for international regions.
- **Concurrency**: Uses `sync.WaitGroup` to fetch different world regions (Americas, Europe, Asia) in parallel.
- **Redis Strategy**:
  - `station:h3:{hex_id}`: Optimized for O(1) geospatial lookup.
  - `stations:all`: Optimized for "Show all stations on map" feature.

3. DATA SCHEMA & PERSISTENCE
======================================================

3.1. PostgreSQL Schema (TimescaleDB)
-----------------------------------
Stored in `vehicle_telemetry` Hypertable:
- `timestamp` (Primary Partition Key)
- `vehicle_id`
- `latitude`, `longitude`
- `aqi`
- `hexagon_id` (H3 string)

Indexes:
- `idx_telemetry_vehicle_id`: Track specific car history.
- `idx_telemetry_hexagon_id`: Analyze pollution hotspots history.
- `idx_telemetry_time_hex`: Spatio-temporal queries.

3.2. Redis Key Namespace
-----------------------------------
| Type   | Key Pattern              | Value Structure                                  | Purpose |
|:-------|:-------------------------|:-------------------------------------------------|:--------|
| Hash   | `aqi:h3:{hex_id}`        | `{ "{vid}": "{aqi}", ... }`                      | Real-time aggregated pollution per hex. |
| String | `vehicle:{vid}`          | `"{hex_id}"`                                     | Track last known vehicle location. |
| String | `station:h3:{hex_id}`    | `JSONString(StationAQIData)`                     | Fallback static station data. |
| String | `stations:all`           | `JSONString([Station...])`                       | Bulk fetch for frontend map pins. |
| String | `stats:ingestions`       | `Int`                                            | System health metric. |

4. API CONTRACTS
======================================================

4.1. Routing API (Port 8000)
---------------------------
**POST /api/v1/route**
- Input: `{ "origin": {lat,lng}, "destination": {lat,lng}, "balance": 0.5 }`
- Output: Returns list of routes with `coordinates` (GeoJSON LineString), `average_aqi`, `total_distance`, `steps` (Turn-by-turn).

**GET /api/v1/aqi/hexagon/{hex_id}**
- Output: `{ "hexagon_id": "...", "median_aqi": 85.5, "vehicle_count": 12 }`

4.2. Ingestion API (Port 8080)
---------------------------
**POST /api/v1/telemetry**
- Input: `{ "vehicle_id": "car-1", "latitude": 19.x, "longitude": 72.x, "aqi": 150 }`
- Output: `202 Accepted`

5. DEPLOYMENT & OPERATIONS
======================================================
- **Hot Reload**: Python services use `uvicorn --reload`. Go services use air (if configured) or rebuilds.
- **Health Checks**: All services expose `/health` endpoints. Docker Compose uses these for dependency ordering (`service_healthy`).
- **Scalability**: Stateless architecture allows horizontal scaling of Ingestion and Routing components behind a load balancer (Nginx/Traefik - future scope).
