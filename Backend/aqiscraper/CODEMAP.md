# AQI Scraper Code Map

This service scrapes station AQI (aqi.in + WAQI), maps stations to H3 cells, and caches results in Redis.

## Where to Look

- Entrypoint + HTTP routes: [main.go](main.go)
- Config/env vars: [config.go](config.go)
- Core service + scheduler + Redis persistence: [service.go](service.go)
- HTTP handlers (API responses): [handlers.go](handlers.go)
- aqi.in scraping (India): [aqiin_scraper.go](aqiin_scraper.go)
- WAQI client (international): [waqi_client.go](waqi_client.go)
- Shared types/constants: [types.go](types.go)
- Indian city list (data): [indian_cities.go](indian_cities.go)
- Distance helper: [util.go](util.go)

## Runtime Contract

- In-memory caches:
  - `stations` (all stations)
  - `h3ToStation` (fast lookup by H3)
- Redis keys (prefixes):
  - `station:aqi:{h3}` and `station:h3:{h3}` (station JSON)
  - `stations:all` (JSON array)
  - `stations:last_fetch`

## Useful Debug Starts

- “Why did a station disappear?” → [service.go](service.go) `FetchAllStations()` then `storeAllStationsInRedis()`
- “aqi.in parsing broke” → [aqiin_scraper.go](aqiin_scraper.go) `parseAQIInScript()`
- “WAQI fetch failing” → [waqi_client.go](waqi_client.go) `fetchWAQIStationsInBounds()`
