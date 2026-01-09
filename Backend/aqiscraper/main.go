package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gocolly/colly/v2"
	"github.com/redis/go-redis/v9"
	h3 "github.com/uber/h3-go/v4"
)

// StationAQIData represents the AQI information for a station with coordinates
type StationAQIData struct {
	Location    string    `json:"location"`
	Latitude    float64   `json:"latitude"`
	Longitude   float64   `json:"longitude"`
	AQI         float64   `json:"aqi"`
	H3Index     string    `json:"h3_index"`
	LastUpdated string    `json:"last_updated"`
	URL         string    `json:"url"`
	ScrapedAt   time.Time `json:"scraped_at"`
}

// ScraperService handles AQI scraping and caching
type ScraperService struct {
	stations       map[string]*StationAQIData // keyed by location slug
	h3ToStation    map[string]*StationAQIData // keyed by H3 index
	mu             sync.RWMutex
	redisClient    *redis.Client
	h3Resolution   int
	lastScrapeTime time.Time
	scrapeInterval time.Duration
}

// Config from environment
type Config struct {
	Port           string
	RedisURL       string
	H3Resolution   int
	ScrapeInterval time.Duration
	StationTTL     time.Duration
}

const (
	StationKeyPrefix = "station:aqi:"
	H3StationPrefix  = "station:h3:"
)

var (
	config  Config
	service *ScraperService
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

	scrapeInterval := 30 * time.Minute
	if intervalStr := os.Getenv("SCRAPE_INTERVAL_MINUTES"); intervalStr != "" {
		if interval, err := strconv.Atoi(intervalStr); err == nil {
			scrapeInterval = time.Duration(interval) * time.Minute
		}
	}

	stationTTL := 60 * time.Minute
	if ttlStr := os.Getenv("STATION_TTL_MINUTES"); ttlStr != "" {
		if ttl, err := strconv.Atoi(ttlStr); err == nil {
			stationTTL = time.Duration(ttl) * time.Minute
		}
	}

	return Config{
		Port:           port,
		RedisURL:       redisURL,
		H3Resolution:   h3Res,
		ScrapeInterval: scrapeInterval,
		StationTTL:     stationTTL,
	}
}

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
		stations:       make(map[string]*StationAQIData),
		h3ToStation:    make(map[string]*StationAQIData),
		redisClient:    client,
		h3Resolution:   cfg.H3Resolution,
		scrapeInterval: cfg.ScrapeInterval,
	}, nil
}

// ScrapeAllStations scrapes all Mumbai AQI stations
func (s *ScraperService) ScrapeAllStations() error {
	log.Println("Starting AQI scrape for Mumbai stations...")

	discoveredURLs := make(map[string]bool)
	var discoveredMu sync.Mutex

	// Step 1: Discover all Mumbai location URLs
	discoverCollector := colly.NewCollector(
		colly.AllowedDomains("www.aqi.in", "aqi.in"),
		colly.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)
	discoverCollector.SetRequestTimeout(30 * time.Second)

	discoverCollector.OnHTML("a[href*='/dashboard/india/maharashtra/mumbai/']", func(e *colly.HTMLElement) {
		link := e.Attr("href")
		if strings.Contains(link, "/pm") || strings.Contains(link, "/co") ||
			strings.Contains(link, "/so2") || strings.Contains(link, "/no2") ||
			strings.Contains(link, "/o3") || strings.Contains(link, "/historical") {
			return
		}

		if !strings.HasPrefix(link, "http") {
			link = "https://www.aqi.in" + link
		}

		discoveredMu.Lock()
		discoveredURLs[link] = true
		discoveredMu.Unlock()
	})

	discoverCollector.Visit("https://www.aqi.in/dashboard/india/maharashtra/mumbai")
	discoveredURLs["https://www.aqi.in/dashboard/india/maharashtra/mumbai"] = true

	log.Printf("Discovered %d locations. Fetching AQI data...\n", len(discoveredURLs))

	// Step 2: Scrape each location for AQI and coordinates
	scrapeCollector := colly.NewCollector(
		colly.AllowedDomains("www.aqi.in", "aqi.in"),
		colly.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)
	scrapeCollector.SetRequestTimeout(30 * time.Second)

	scrapeCollector.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Delay:       1 * time.Second,
		RandomDelay: 500 * time.Millisecond,
	})

	processedURLs := make(map[string]bool)
	var processedMu sync.Mutex

	// Parse the JSON data from script tags to get lat/lng and AQI
	scrapeCollector.OnHTML("script", func(e *colly.HTMLElement) {
		scriptContent := e.Text
		if !strings.Contains(scriptContent, "self.__next_f.push") {
			return
		}

		url := e.Request.URL.String()
		processedMu.Lock()
		if processedURLs[url] {
			processedMu.Unlock()
			return
		}
		processedURLs[url] = true
		processedMu.Unlock()

		// Extract location data from the script tag
		stationData := s.parseScriptForLocationData(scriptContent, url)
		if stationData != nil {
			s.mu.Lock()
			s.stations[stationData.Location] = stationData
			s.h3ToStation[stationData.H3Index] = stationData
			s.mu.Unlock()

			// Store in Redis
			s.storeStationInRedis(stationData)

			log.Printf("✓ %s: AQI=%.0f, Lat=%.5f, Lng=%.5f, H3=%s\n",
				stationData.Location, stationData.AQI, stationData.Latitude, stationData.Longitude, stationData.H3Index)
		}
	})

	for url := range discoveredURLs {
		scrapeCollector.Visit(url)
	}

	s.mu.Lock()
	s.lastScrapeTime = time.Now()
	s.mu.Unlock()

	log.Printf("Scrape complete. %d stations collected.\n", len(s.stations))
	return nil
}

// parseScriptForLocationData extracts lat, lng, and AQI from Next.js script content
func (s *ScraperService) parseScriptForLocationData(scriptContent, url string) *StationAQIData {
	// Pattern to find location JSON data in Next.js hydration scripts
	// Looking for patterns like: "lat":"19.2324","long":"72.8689" or "latitude":19.23241,"longitude":72.86895

	var lat, lng, aqi float64
	var location, lastUpdated string
	found := false

	// Try to extract latitude
	latPatterns := []string{
		`"lat"\s*:\s*"([0-9.-]+)"`,
		`"latitude"\s*:\s*([0-9.-]+)`,
	}
	for _, pattern := range latPatterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(scriptContent)
		if len(matches) > 1 {
			if val, err := strconv.ParseFloat(matches[1], 64); err == nil {
				lat = val
				break
			}
		}
	}

	// Try to extract longitude
	lngPatterns := []string{
		`"long"\s*:\s*"([0-9.-]+)"`,
		`"lon"\s*:\s*"([0-9.-]+)"`,
		`"longitude"\s*:\s*([0-9.-]+)`,
	}
	for _, pattern := range lngPatterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(scriptContent)
		if len(matches) > 1 {
			if val, err := strconv.ParseFloat(matches[1], 64); err == nil {
				lng = val
				break
			}
		}
	}

	// Try to extract AQI value from airquality object
	// Pattern: "aqi":123 or "aqi":"123"
	aqiPatterns := []string{
		`"aqi"\s*:\s*"?([0-9]+)"?`,
	}
	for _, pattern := range aqiPatterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindAllStringSubmatch(scriptContent, -1)
		for _, match := range matches {
			if len(match) > 1 {
				if val, err := strconv.ParseFloat(match[1], 64); err == nil && val > 0 && val < 1000 {
					aqi = val
					found = true
					break
				}
			}
		}
		if found {
			break
		}
	}

	// Extract location name
	locationPatterns := []string{
		`"location"\s*:\s*"([^"]+)"`,
		`"station"\s*:\s*"([^"]+)"`,
	}
	for _, pattern := range locationPatterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(scriptContent)
		if len(matches) > 1 {
			location = matches[1]
			break
		}
	}

	// Extract last updated
	lastUpdatedRe := regexp.MustCompile(`"last_updated"\s*:\s*"([^"]+)"`)
	if matches := lastUpdatedRe.FindStringSubmatch(scriptContent); len(matches) > 1 {
		lastUpdated = matches[1]
	}

	// Validate we have necessary data
	if lat == 0 || lng == 0 || aqi == 0 {
		return nil
	}

	// Use location from URL if not found in script
	if location == "" {
		location = extractLocationFromURL(url)
	}

	// Calculate H3 index
	latLng := h3.NewLatLng(lat, lng)
	h3Index := h3.LatLngToCell(latLng, s.h3Resolution)

	return &StationAQIData{
		Location:    location,
		Latitude:    lat,
		Longitude:   lng,
		AQI:         aqi,
		H3Index:     h3Index.String(),
		LastUpdated: lastUpdated,
		URL:         url,
		ScrapedAt:   time.Now(),
	}
}

// storeStationInRedis stores station data in Redis
func (s *ScraperService) storeStationInRedis(station *StationAQIData) error {
	ctx := context.Background()
	pipe := s.redisClient.Pipeline()

	// Store station data as JSON
	stationKey := StationKeyPrefix + station.Location
	stationJSON, _ := json.Marshal(station)
	pipe.Set(ctx, stationKey, stationJSON, config.StationTTL)

	// Map H3 index to station (for fallback lookup)
	h3Key := H3StationPrefix + station.H3Index
	pipe.Set(ctx, h3Key, stationJSON, config.StationTTL)

	_, err := pipe.Exec(ctx)
	return err
}

// GetStationByH3 retrieves station data for an H3 hexagon
func (s *ScraperService) GetStationByH3(h3Index string) *StationAQIData {
	// Check in-memory cache first
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

// GetNearestStation finds the nearest station to given coordinates
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

// GetAllStations returns all cached stations
func (s *ScraperService) GetAllStations() []*StationAQIData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stations := make([]*StationAQIData, 0, len(s.stations))
	for _, station := range s.stations {
		stations = append(stations, station)
	}
	return stations
}

// HTTP Handlers

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"stations":  len(service.stations),
		"timestamp": time.Now(),
	})
}

func stationsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	stations := service.GetAllStations()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":    len(stations),
		"stations": stations,
	})
}

func h3LookupHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	h3Index := r.URL.Query().Get("h3")
	if h3Index == "" {
		http.Error(w, `{"error": "h3 parameter required"}`, http.StatusBadRequest)
		return
	}

	station := service.GetStationByH3(h3Index)
	if station == nil {
		// Try to find nearest station
		// Parse h3 to get center coordinates
		cell := h3.Cell(h3.IndexFromString(h3Index))
		if !cell.IsValid() {
			http.Error(w, `{"error": "invalid h3 index"}`, http.StatusBadRequest)
			return
		}
		latLng := cell.LatLng()
		station = service.GetNearestStation(latLng.Lat, latLng.Lng)
	}

	if station == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"found":    false,
			"h3_index": h3Index,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"found":   true,
		"station": station,
	})
}

func nearestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")

	if latStr == "" || lngStr == "" {
		http.Error(w, `{"error": "lat and lng parameters required"}`, http.StatusBadRequest)
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		http.Error(w, `{"error": "invalid lat parameter"}`, http.StatusBadRequest)
		return
	}

	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		http.Error(w, `{"error": "invalid lng parameter"}`, http.StatusBadRequest)
		return
	}

	station := service.GetNearestStation(lat, lng)
	if station == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"found": false,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"found":   true,
		"station": station,
	})
}

func scrapeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "POST method required"}`, http.StatusMethodNotAllowed)
		return
	}

	go service.ScrapeAllStations()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "scrape initiated",
		"message": "Check /health for progress",
	})
}

// Utility functions

func extractLocationFromURL(url string) string {
	parts := strings.Split(url, "/")
	if len(parts) == 0 {
		return "Unknown"
	}
	location := parts[len(parts)-1]
	if location == "mumbai" {
		return "Mumbai (City)"
	}
	return formatLocationName(location)
}

func formatLocationName(location string) string {
	name := strings.ReplaceAll(location, "-", " ")
	words := strings.Fields(name)
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
		}
	}
	return strings.Join(words, " ")
}

func haversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000 // Earth's radius in meters
	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	deltaLat := (lat2 - lat1) * math.Pi / 180
	deltaLng := (lng2 - lng1) * math.Pi / 180

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(deltaLng/2)*math.Sin(deltaLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// Background scrape scheduler
func startBackgroundScraper() {
	// Initial scrape
	service.ScrapeAllStations()

	// Periodic scraping
	ticker := time.NewTicker(config.ScrapeInterval)
	go func() {
		for range ticker.C {
			service.ScrapeAllStations()
		}
	}()
}

func main() {
	config = loadConfig()
	log.Printf("Starting AQI Scraper Service on port %s\n", config.Port)

	var err error
	service, err = NewScraperService(config)
	if err != nil {
		log.Fatalf("Failed to initialize service: %v", err)
	}

	// Start background scraper
	startBackgroundScraper()

	// HTTP routes
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/stations", stationsHandler)
	http.HandleFunc("/h3", h3LookupHandler)
	http.HandleFunc("/nearest", nearestHandler)
	http.HandleFunc("/scrape", scrapeHandler)

	log.Printf("Server listening on :%s\n", config.Port)
	if err := http.ListenAndServe(":"+config.Port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
