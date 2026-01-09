# Backend Code Map

This file is a quick index to help humans (and Copilot) jump to the right entrypoints when adding features or debugging.

## Service Entry Points

- **Ingestion service (Go)**
  - Entrypoint: [ingestion-service/cmd/server/main.go](ingestion-service/cmd/server/main.go)
  - HTTP handlers: [ingestion-service/internal/handler](ingestion-service/internal/handler)
  - Core logic: [ingestion-service/internal/service/telemetry.go](ingestion-service/internal/service/telemetry.go)
  - Storage: [ingestion-service/internal/repository](ingestion-service/internal/repository)

- **Routing service (Python / FastAPI)**
  - Entrypoint: [routing-service/app/main.py](routing-service/app/main.py)
  - Routes: [routing-service/app/api/routes.py](routing-service/app/api/routes.py)
  - Routing logic: [routing-service/app/services/routing_service.py](routing-service/app/services/routing_service.py)
  - Graph building/caching: [routing-service/app/services/graph_service.py](routing-service/app/services/graph_service.py)
  - Redis access: [routing-service/app/services/redis_service.py](routing-service/app/services/redis_service.py)
  - Config: [routing-service/app/core/config.py](routing-service/app/core/config.py)

- **AQI scraper service (Go)**
  - Entrypoint: [aqiscraper/main.go](aqiscraper/main.go)
  - Code map: [aqiscraper/CODEMAP.md](aqiscraper/CODEMAP.md)

- **Local scripts (Python)**
  - Vehicle simulator: [scripts/vehicle_simulator.py](scripts/vehicle_simulator.py)
  - System test: [scripts/test_system.py](scripts/test_system.py)

## Cross-Service Data Flow (mental model)

- Vehicles send telemetry → Ingestion service writes to Redis keyed by H3.
- Routing service reads edge + AQI info from Redis and computes routes.
- AQI scraper populates fallback “station AQI” values in Redis keyed by H3.

## If You’re Debugging…

- **Route result seems wrong** → start at [routing-service/app/api/routes.py](routing-service/app/api/routes.py) then into [routing-service/app/services/routing_service.py](routing-service/app/services/routing_service.py)
- **AQI values missing** → check Redis keys written by ingestion: [ingestion-service/internal/repository/redis.go](ingestion-service/internal/repository/redis.go)
- **Station fallback not working** → check scraper handlers: [aqiscraper/handlers.go](aqiscraper/handlers.go) and fetch pipeline: [aqiscraper/service.go](aqiscraper/service.go)
