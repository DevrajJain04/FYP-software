//go:build ignore
// +build ignore

// This file is deprecated. Use entrypoint.go instead.
// Kept for reference but excluded from build.

package main

import (
	"log"
	"net/http"
	"time"
)

// CORS middleware to allow cross-origin requests from frontend
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Allow requests from any origin (for development)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight OPTIONS request
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// startBackgroundFetcher loads any cached data and keeps the station dataset refreshed.
func startBackgroundFetcher() {
	if err := service.LoadFromRedis(); err != nil {
		log.Printf("📭 No cached data in Redis, will fetch fresh data")
	}

	service.FetchAllStations()

	ticker := time.NewTicker(config.FetchInterval)
	go func() {
		for range ticker.C {
			log.Printf("⏰ Scheduled fetch triggered (every %v)", config.FetchInterval)
			service.FetchAllStations()
		}
	}()
}

func main() {
	config = loadConfig()
	log.Printf("🚀 Starting Global AQI Service on port %s", config.Port)
	log.Printf("📊 Fetch interval: %v", config.FetchInterval)
	log.Printf("🇮🇳 Indian cities configured: %d", len(indianCities))

	var err error
	service, err = NewScraperService(config)
	if err != nil {
		log.Fatalf("Failed to initialize service: %v", err)
	}

	// Start background fetcher in a goroutine so server can start immediately
	go startBackgroundFetcher()

	// Wrap all handlers with CORS middleware
	http.HandleFunc("/health", corsMiddleware(healthHandler))
	http.HandleFunc("/stations", corsMiddleware(stationsHandler))
	http.HandleFunc("/stats", corsMiddleware(statsHandler))
	http.HandleFunc("/h3", corsMiddleware(h3LookupHandler))
	http.HandleFunc("/nearest", corsMiddleware(nearestHandler))
	http.HandleFunc("/radius", corsMiddleware(radiusHandler))
	http.HandleFunc("/fetch", corsMiddleware(fetchHandler))

	log.Printf("🌐 Server listening on :%s", config.Port)
	log.Printf("📡 Endpoints: /health, /stations, /stats, /h3, /nearest, /radius, /fetch")
	log.Printf("🔓 CORS enabled for all origins")

	if err := http.ListenAndServe(":"+config.Port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
