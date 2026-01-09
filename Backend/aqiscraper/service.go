package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

func NewScraperService(cfg Config) (*ScraperService, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         cfg.RedisURL,
		Password:     "",
		DB:           0,
		PoolSize:     10,
		MinIdleConns: 2,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &ScraperService{
		stations:      make(map[string]*StationAQIData),
		h3ToStation:   make(map[string]*StationAQIData),
		redisClient:   client,
		h3Resolution:  cfg.H3Resolution,
		fetchInterval: cfg.FetchInterval,
		waqiAPIKey:    cfg.WAQIAPIKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// FetchAllStations fetches AQI data from all sources.
func (s *ScraperService) FetchAllStations() error {
	log.Println("🌍 Starting AQI fetch from all sources...")
	startTime := time.Now()

	newStations := make(map[string]*StationAQIData)
	newH3ToStation := make(map[string]*StationAQIData)
	var mu sync.Mutex

	var wg sync.WaitGroup

	// 1. Fetch Indian cities from aqi.in (primary source for India)
	wg.Add(1)
	go func() {
		defer wg.Done()
		indianStations := s.scrapeAllIndianCities()
		mu.Lock()
		for _, station := range indianStations {
			stationKey := fmt.Sprintf("%s_%f_%f", station.Location, station.Latitude, station.Longitude)
			newStations[stationKey] = station
			newH3ToStation[station.H3Index] = station
		}
		mu.Unlock()
		log.Printf("🇮🇳 India (aqi.in): %d stations", len(indianStations))
	}()

	// 2. Fetch international regions from WAQI API
	internationalRegions := []struct {
		name                           string
		latMin, lngMin, latMax, lngMax float64
	}{
		// Southeast Asia (includes Singapore)
		{"Southeast Asia", -11.0, 95.0, 24.0, 142.0},
		// East Asia
		{"East Asia", 18.0, 100.0, 54.0, 146.0},
		// Middle East
		{"Middle East", 12.0, 34.0, 42.0, 63.0},
		// Europe
		{"Western Europe", 35.0, -11.0, 60.0, 20.0},
		{"Eastern Europe", 42.0, 20.0, 72.0, 60.0},
		// Americas
		{"North America", 24.0, -130.0, 50.0, -65.0},
		{"South America", -56.0, -82.0, 13.0, -34.0},
		// Africa
		{"Africa", -35.0, -18.0, 38.0, 52.0},
		// Oceania
		{"Oceania", -48.0, 112.0, -10.0, 180.0},
	}

	for _, region := range internationalRegions {
		wg.Add(1)
		go func(r struct {
			name                           string
			latMin, lngMin, latMax, lngMax float64
		}) {
			defer wg.Done()
			stations, err := s.fetchWAQIStationsInBounds(r.latMin, r.lngMin, r.latMax, r.lngMax)
			if err != nil {
				log.Printf("⚠️  Error fetching %s: %v", r.name, err)
				return
			}
			mu.Lock()
			for _, station := range stations {
				stationKey := fmt.Sprintf("%s_%f_%f", station.Location, station.Latitude, station.Longitude)
				newStations[stationKey] = station
				newH3ToStation[station.H3Index] = station
			}
			mu.Unlock()
			log.Printf("✓ %s (WAQI): %d stations", r.name, len(stations))
		}(region)
	}

	wg.Wait()

	// Update in-memory cache atomically
	s.mu.Lock()
	s.stations = newStations
	s.h3ToStation = newH3ToStation
	s.lastFetchTime = time.Now()
	s.mu.Unlock()

	// Store in Redis
	s.storeAllStationsInRedis()

	elapsed := time.Since(startTime)
	log.Printf("🎉 Fetch complete. %d total stations collected in %v", len(newStations), elapsed)

	return nil
}

// storeAllStationsInRedis stores all station data in Redis.
func (s *ScraperService) storeAllStationsInRedis() error {
	ctx := context.Background()
	pipe := s.redisClient.Pipeline()

	s.mu.RLock()
	stations := make([]*StationAQIData, 0, len(s.stations))
	for _, station := range s.stations {
		stations = append(stations, station)

		stationJSON, _ := json.Marshal(station)

		// Store individual station by H3
		stationKey := StationKeyPrefix + station.H3Index
		pipe.Set(ctx, stationKey, stationJSON, config.StationTTL)

		// Map H3 index to station
		h3Key := H3StationPrefix + station.H3Index
		pipe.Set(ctx, h3Key, stationJSON, config.StationTTL)
	}
	s.mu.RUnlock()

	// Store all stations as JSON array
	allStationsJSON, _ := json.Marshal(stations)
	pipe.Set(ctx, AllStationsKey, allStationsJSON, config.StationTTL)
	pipe.Set(ctx, LastFetchKey, time.Now().Format(time.RFC3339), config.StationTTL)

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("⚠️  Redis pipeline error: %v", err)
	}
	return err
}

// GetStationByH3 retrieves station data for an H3 hexagon.
func (s *ScraperService) GetStationByH3(h3Index string) *StationAQIData {
	s.mu.RLock()
	if station, ok := s.h3ToStation[h3Index]; ok {
		s.mu.RUnlock()
		return station
	}
	s.mu.RUnlock()

	// Check Redis
	ctx := context.Background()
	h3Key := H3StationPrefix + h3Index
	result, err := s.redisClient.Get(ctx, h3Key).Result()
	if err == nil {
		var station StationAQIData
		if json.Unmarshal([]byte(result), &station) == nil {
			return &station
		}
	}

	return nil
}

// GetNearestStation finds the nearest station to given coordinates.
func (s *ScraperService) GetNearestStation(lat, lng float64) *StationAQIData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var nearest *StationAQIData
	minDist := float64(1e9)

	for _, station := range s.stations {
		dist := haversineDistance(lat, lng, station.Latitude, station.Longitude)
		if dist < minDist {
			minDist = dist
			nearest = station
		}
	}

	return nearest
}

// GetNearestStationWithDistance finds the nearest station and returns distance in km.
func (s *ScraperService) GetNearestStationWithDistance(lat, lng float64) (*StationAQIData, float64) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var nearest *StationAQIData
	minDist := float64(1e9)

	for _, station := range s.stations {
		dist := haversineDistance(lat, lng, station.Latitude, station.Longitude)
		if dist < minDist {
			minDist = dist
			nearest = station
		}
	}

	return nearest, minDist / 1000
}

// GetStationsInRadius returns all stations within a given radius (km).
func (s *ScraperService) GetStationsInRadius(lat, lng, radiusKm float64) []*StationAQIData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var stations []*StationAQIData
	radiusM := radiusKm * 1000

	for _, station := range s.stations {
		dist := haversineDistance(lat, lng, station.Latitude, station.Longitude)
		if dist <= radiusM {
			stations = append(stations, station)
		}
	}

	return stations
}

// GetAllStations returns all cached stations.
func (s *ScraperService) GetAllStations() []*StationAQIData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stations := make([]*StationAQIData, 0, len(s.stations))
	for _, station := range s.stations {
		stations = append(stations, station)
	}
	return stations
}

// GetStationStats returns statistics about cached stations.
func (s *ScraperService) GetStationStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	countryCounts := make(map[string]int)
	sourceCounts := make(map[string]int)
	var totalAQI float64
	var count int

	for _, station := range s.stations {
		countryCounts[station.Country]++
		sourceCounts[station.Source]++
		totalAQI += station.AQI
		count++
	}

	avgAQI := 0.0
	if count > 0 {
		avgAQI = totalAQI / float64(count)
	}

	return map[string]interface{}{
		"total_stations": count,
		"countries":      len(countryCounts),
		"average_aqi":    avgAQI,
		"last_fetch":     s.lastFetchTime,
		"country_counts": countryCounts,
		"source_counts":  sourceCounts,
	}
}

// LoadFromRedis loads cached stations from Redis on startup.
func (s *ScraperService) LoadFromRedis() error {
	ctx := context.Background()

	result, err := s.redisClient.Get(ctx, AllStationsKey).Result()
	if err != nil {
		return err
	}

	var stations []*StationAQIData
	if err := json.Unmarshal([]byte(result), &stations); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, station := range stations {
		stationKey := fmt.Sprintf("%s_%f_%f", station.Location, station.Latitude, station.Longitude)
		s.stations[stationKey] = station
		s.h3ToStation[station.H3Index] = station
	}

	log.Printf("📦 Loaded %d stations from Redis cache", len(stations))
	return nil
}
