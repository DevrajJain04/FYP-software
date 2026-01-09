package main

import (
	"log"
	"os"
	"strconv"
	"time"
)

func loadConfig() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	h3Res := 9
	if h3ResStr := os.Getenv("H3_RESOLUTION"); h3ResStr != "" {
		if res, err := strconv.Atoi(h3ResStr); err == nil {
			h3Res = res
		}
	}

	// Default to 2 hours (120 minutes)
	fetchInterval := DefaultFetchMinutes * time.Minute
	intervalStr := os.Getenv("FETCH_INTERVAL_MINUTES")
	if intervalStr == "" {
		// Backward-compatible alias (used by docker-compose.yml)
		intervalStr = os.Getenv("SCRAPE_INTERVAL_MINUTES")
	}
	if intervalStr != "" {
		if interval, err := strconv.Atoi(intervalStr); err == nil {
			fetchInterval = time.Duration(interval) * time.Minute
		}
	}

	// Station TTL should be longer than fetch interval
	stationTTL := 180 * time.Minute // 3 hours default
	if ttlStr := os.Getenv("STATION_TTL_MINUTES"); ttlStr != "" {
		if ttl, err := strconv.Atoi(ttlStr); err == nil {
			stationTTL = time.Duration(ttl) * time.Minute
		}
	}

	// WAQI API key for international stations
	waqiAPIKey := os.Getenv("WAQI_API_KEY")
	if waqiAPIKey == "" {
		waqiAPIKey = "demo"
		log.Println("⚠️  Using demo WAQI API key. Set WAQI_API_KEY for production use.")
	}

	return Config{
		Port:          port,
		RedisURL:      redisURL,
		H3Resolution:  h3Res,
		FetchInterval: fetchInterval,
		StationTTL:    stationTTL,
		WAQIAPIKey:    waqiAPIKey,
	}
}
