//go:build ignore
// +build ignore

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	City        string    `json:"city"`
	State       string    `json:"state"`
	Country     string    `json:"country"`
	Latitude    float64   `json:"latitude"`
	Longitude   float64   `json:"longitude"`
	AQI         float64   `json:"aqi"`
	H3Index     string    `json:"h3_index"`
	LastUpdated string    `json:"last_updated"`
	Source      string    `json:"source"`
	ScrapedAt   time.Time `json:"scraped_at"`
}

// WAQIMapBoundsResponse represents stations within map bounds from WAQI API
type WAQIMapBoundsResponse struct {
	Status string `json:"status"`
	Data   []struct {
		Lat  float64 `json:"lat"`
		Lon  float64 `json:"lon"`
		UID  int     `json:"uid"`
		AQI  string  `json:"aqi"`
		Name string  `json:"name"`
	} `json:"data"`
}

// IndianCity represents a city to scrape from aqi.in
type IndianCity struct {
	State string
	City  string
	Slug  string // URL slug
}

// ScraperService handles AQI fetching and caching
type ScraperService struct {
	stations      map[string]*StationAQIData // keyed by unique station ID
	h3ToStation   map[string]*StationAQIData // keyed by H3 index
	mu            sync.RWMutex
	redisClient   *redis.Client
	h3Resolution  int
	lastFetchTime time.Time
	fetchInterval time.Duration
	waqiAPIKey    string
	httpClient    *http.Client
}

// Config from environment
type Config struct {
	Port          string
	RedisURL      string
	H3Resolution  int
	FetchInterval time.Duration
	StationTTL    time.Duration
	WAQIAPIKey    string
}

const (
	StationKeyPrefix    = "station:aqi:"
	H3StationPrefix     = "station:h3:"
	AllStationsKey      = "stations:all"
	LastFetchKey        = "stations:last_fetch"
	WAQIBaseURL         = "https://api.waqi.info"
	AQIInBaseURL        = "https://www.aqi.in"
	DefaultFetchMinutes = 120 // 2 hours
)

var (
	config  Config
	service *ScraperService
)

// Major Indian cities organized by state for aqi.in scraping
var indianCities = []IndianCity{
	// Maharashtra
	{"Maharashtra", "Mumbai", "mumbai"},
	{"Maharashtra", "Pune", "pune"},
	{"Maharashtra", "Nagpur", "nagpur"},
	{"Maharashtra", "Thane", "thane"},
	{"Maharashtra", "Nashik", "nashik"},
	{"Maharashtra", "Aurangabad", "aurangabad"},
	{"Maharashtra", "Solapur", "solapur"},
	{"Maharashtra", "Kolhapur", "kolhapur"},
	{"Maharashtra", "Navi Mumbai", "navi-mumbai"},

	// Delhi NCR
	{"Delhi", "Delhi", "delhi"},
	{"Delhi", "New Delhi", "new-delhi"},
	{"Haryana", "Gurgaon", "gurgaon"},
	{"Haryana", "Faridabad", "faridabad"},
	{"Uttar Pradesh", "Noida", "noida"},
	{"Uttar Pradesh", "Ghaziabad", "ghaziabad"},
	{"Uttar Pradesh", "Greater Noida", "greater-noida"},

	// Uttar Pradesh
	{"Uttar Pradesh", "Lucknow", "lucknow"},
	{"Uttar Pradesh", "Kanpur", "kanpur"},
	{"Uttar Pradesh", "Varanasi", "varanasi"},
	{"Uttar Pradesh", "Agra", "agra"},
	{"Uttar Pradesh", "Prayagraj", "prayagraj"},
	{"Uttar Pradesh", "Meerut", "meerut"},

	// Karnataka
	{"Karnataka", "Bengaluru", "bengaluru"},
	{"Karnataka", "Mysuru", "mysuru"},
	{"Karnataka", "Hubli", "hubli"},
	{"Karnataka", "Mangaluru", "mangaluru"},

	// Tamil Nadu
	{"Tamil Nadu", "Chennai", "chennai"},
	{"Tamil Nadu", "Coimbatore", "coimbatore"},
	{"Tamil Nadu", "Madurai", "madurai"},
	{"Tamil Nadu", "Tiruchirappalli", "tiruchirappalli"},
	{"Tamil Nadu", "Salem", "salem"},

	// Telangana
	{"Telangana", "Hyderabad", "hyderabad"},
	{"Telangana", "Warangal", "warangal"},
	{"Telangana", "Nizamabad", "nizamabad"},

	// Andhra Pradesh
	{"Andhra Pradesh", "Visakhapatnam", "visakhapatnam"},
	{"Andhra Pradesh", "Vijayawada", "vijayawada"},
	{"Andhra Pradesh", "Guntur", "guntur"},
	{"Andhra Pradesh", "Tirupati", "tirupati"},

	// West Bengal
	{"West Bengal", "Kolkata", "kolkata"},
	{"West Bengal", "Howrah", "howrah"},
	{"West Bengal", "Durgapur", "durgapur"},
	{"West Bengal", "Asansol", "asansol"},
	{"West Bengal", "Siliguri", "siliguri"},

	// Gujarat
	{"Gujarat", "Ahmedabad", "ahmedabad"},
	{"Gujarat", "Surat", "surat"},
	{"Gujarat", "Vadodara", "vadodara"},
	{"Gujarat", "Rajkot", "rajkot"},
	{"Gujarat", "Gandhinagar", "gandhinagar"},

	// Rajasthan
	{"Rajasthan", "Jaipur", "jaipur"},
	{"Rajasthan", "Jodhpur", "jodhpur"},
	{"Rajasthan", "Udaipur", "udaipur"},
	{"Rajasthan", "Kota", "kota"},
	{"Rajasthan", "Ajmer", "ajmer"},

	// Madhya Pradesh
	{"Madhya Pradesh", "Bhopal", "bhopal"},
	{"Madhya Pradesh", "Indore", "indore"},
	{"Madhya Pradesh", "Jabalpur", "jabalpur"},
	{"Madhya Pradesh", "Gwalior", "gwalior"},

	// Punjab
	{"Punjab", "Ludhiana", "ludhiana"},
	{"Punjab", "Amritsar", "amritsar"},
	{"Punjab", "Jalandhar", "jalandhar"},
	{"Punjab", "Patiala", "patiala"},
	{"Punjab", "Chandigarh", "chandigarh"},

	// Bihar
	{"Bihar", "Patna", "patna"},
	{"Bihar", "Gaya", "gaya"},
	{"Bihar", "Muzaffarpur", "muzaffarpur"},

	// Odisha
	{"Odisha", "Bhubaneswar", "bhubaneswar"},
	{"Odisha", "Cuttack", "cuttack"},
	{"Odisha", "Rourkela", "rourkela"},

	// Kerala
	{"Kerala", "Thiruvananthapuram", "thiruvananthapuram"},
	{"Kerala", "Kochi", "kochi"},
	{"Kerala", "Kozhikode", "kozhikode"},
	{"Kerala", "Thrissur", "thrissur"},

	// Jharkhand
	{"Jharkhand", "Ranchi", "ranchi"},
	{"Jharkhand", "Jamshedpur", "jamshedpur"},
	{"Jharkhand", "Dhanbad", "dhanbad"},

	// Chhattisgarh
	{"Chhattisgarh", "Raipur", "raipur"},
	{"Chhattisgarh", "Bhilai", "bhilai"},

	// Assam
	{"Assam", "Guwahati", "guwahati"},

	// Uttarakhand
	{"Uttarakhand", "Dehradun", "dehradun"},
	{"Uttarakhand", "Haridwar", "haridwar"},

	// Himachal Pradesh
	{"Himachal Pradesh", "Shimla", "shimla"},
	{"Himachal Pradesh", "Dharamshala", "dharamshala"},

	// Goa
	{"Goa", "Panaji", "panaji"},
	{"Goa", "Margao", "margao"},
}

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
	if intervalStr := os.Getenv("FETCH_INTERVAL_MINUTES"); intervalStr != "" {
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

// FetchAllStations fetches AQI data from all sources
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

// scrapeAllIndianCities scrapes AQI data from aqi.in for all Indian cities
func (s *ScraperService) scrapeAllIndianCities() []*StationAQIData {
	var allStations []*StationAQIData
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Create a semaphore to limit concurrent requests
	semaphore := make(chan struct{}, 5)

	for _, city := range indianCities {
		wg.Add(1)
		go func(c IndianCity) {
			defer wg.Done()
			semaphore <- struct{}{}        // Acquire
			defer func() { <-semaphore }() // Release

			stations := s.scrapeIndianCity(c)
			if len(stations) > 0 {
				mu.Lock()
				allStations = append(allStations, stations...)
				mu.Unlock()
			}

			// Small delay to be respectful to the server
			time.Sleep(500 * time.Millisecond)
		}(city)
	}

	wg.Wait()
	return allStations
}

// scrapeIndianCity scrapes a single Indian city from aqi.in
func (s *ScraperService) scrapeIndianCity(city IndianCity) []*StationAQIData {
	var stations []*StationAQIData

	collector := colly.NewCollector(
		colly.AllowedDomains("www.aqi.in", "aqi.in"),
		colly.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)
	collector.SetRequestTimeout(30 * time.Second)

	// Track discovered location URLs for this city
	locationURLs := make(map[string]bool)
	var urlMu sync.Mutex

	// Find all location links within the city
	collector.OnHTML("a[href*='/dashboard/india/']", func(e *colly.HTMLElement) {
		link := e.Attr("href")

		// Skip pollutant-specific and historical pages
		if strings.Contains(link, "/pm") || strings.Contains(link, "/co") ||
			strings.Contains(link, "/so2") || strings.Contains(link, "/no2") ||
			strings.Contains(link, "/o3") || strings.Contains(link, "/historical") {
			return
		}

		// Must be within our target city's state
		stateLower := strings.ToLower(strings.ReplaceAll(city.State, " ", "-"))
		if !strings.Contains(link, "/"+stateLower+"/") {
			return
		}

		if !strings.HasPrefix(link, "http") {
			link = AQIInBaseURL + link
		}

		urlMu.Lock()
		locationURLs[link] = true
		urlMu.Unlock()
	})

	// Parse script tags for AQI and coordinate data
	collector.OnHTML("script", func(e *colly.HTMLElement) {
		scriptContent := e.Text
		if !strings.Contains(scriptContent, "self.__next_f.push") {
			return
		}

		station := s.parseAQIInScript(scriptContent, e.Request.URL.String(), city)
		if station != nil {
			stations = append(stations, station)
		}
	})

	// Build the city URL
	stateLower := strings.ToLower(strings.ReplaceAll(city.State, " ", "-"))
	cityURL := fmt.Sprintf("%s/dashboard/india/%s/%s", AQIInBaseURL, stateLower, city.Slug)

	// Visit main city page
	collector.Visit(cityURL)

	// Visit discovered location pages
	for url := range locationURLs {
		if url != cityURL {
			collector.Visit(url)
		}
	}

	return stations
}

// parseAQIInScript extracts AQI data from aqi.in Next.js script content
func (s *ScraperService) parseAQIInScript(scriptContent, url string, city IndianCity) *StationAQIData {
	var lat, lng, aqi float64
	var location, lastUpdated string

	// Extract latitude
	latPatterns := []string{
		`"lat"\s*:\s*"([0-9.-]+)"`,
		`"latitude"\s*:\s*"?([0-9.-]+)"?`,
	}
	for _, pattern := range latPatterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(scriptContent); len(matches) > 1 {
			if val, err := strconv.ParseFloat(matches[1], 64); err == nil && val != 0 {
				lat = val
				break
			}
		}
	}

	// Extract longitude
	lngPatterns := []string{
		`"long"\s*:\s*"([0-9.-]+)"`,
		`"lon"\s*:\s*"([0-9.-]+)"`,
		`"longitude"\s*:\s*"?([0-9.-]+)"?`,
	}
	for _, pattern := range lngPatterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(scriptContent); len(matches) > 1 {
			if val, err := strconv.ParseFloat(matches[1], 64); err == nil && val != 0 {
				lng = val
				break
			}
		}
	}

	// Extract AQI
	aqiRe := regexp.MustCompile(`"aqi"\s*:\s*"?([0-9]+)"?`)
	aqiMatches := aqiRe.FindAllStringSubmatch(scriptContent, -1)
	for _, match := range aqiMatches {
		if len(match) > 1 {
			if val, err := strconv.ParseFloat(match[1], 64); err == nil && val > 0 && val < 1000 {
				aqi = val
				break
			}
		}
	}

	// Extract location name
	locationPatterns := []string{
		`"location"\s*:\s*"([^"]+)"`,
		`"station"\s*:\s*"([^"]+)"`,
		`"name"\s*:\s*"([^"]+)"`,
	}
	for _, pattern := range locationPatterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(scriptContent); len(matches) > 1 {
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

	// Use city name if location not found
	if location == "" {
		location = extractLocationFromURL(url)
	}

	// Calculate H3 index
	latLng := h3.NewLatLng(lat, lng)
	h3Index := h3.LatLngToCell(latLng, s.h3Resolution)

	return &StationAQIData{
		Location:    location,
		City:        city.City,
		State:       city.State,
		Country:     "India",
		Latitude:    lat,
		Longitude:   lng,
		AQI:         aqi,
		H3Index:     h3Index.String(),
		LastUpdated: lastUpdated,
		Source:      "aqi.in",
		ScrapedAt:   time.Now(),
	}
}

// fetchWAQIStationsInBounds fetches stations from WAQI API for international regions
func (s *ScraperService) fetchWAQIStationsInBounds(latMin, lngMin, latMax, lngMax float64) ([]*StationAQIData, error) {
	url := fmt.Sprintf("%s/map/bounds/?latlng=%f,%f,%f,%f&token=%s",
		WAQIBaseURL, latMin, lngMin, latMax, lngMax, s.waqiAPIKey)

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var mapResp WAQIMapBoundsResponse
	if err := json.Unmarshal(body, &mapResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if mapResp.Status != "ok" {
		return nil, fmt.Errorf("API returned status: %s", mapResp.Status)
	}

	var stations []*StationAQIData
	for _, st := range mapResp.Data {
		// Skip stations in India (we get those from aqi.in)
		if isInIndia(st.Lat, st.Lon) {
			continue
		}

		aqi, err := strconv.ParseFloat(st.AQI, 64)
		if err != nil || aqi <= 0 {
			continue
		}

		// Calculate H3 index
		latLng := h3.NewLatLng(st.Lat, st.Lon)
		h3Index := h3.LatLngToCell(latLng, s.h3Resolution)

		// Parse city and country from station name
		city, country := parseStationName(st.Name)

		station := &StationAQIData{
			Location:    st.Name,
			City:        city,
			Country:     country,
			Latitude:    st.Lat,
			Longitude:   st.Lon,
			AQI:         aqi,
			H3Index:     h3Index.String(),
			LastUpdated: time.Now().Format(time.RFC3339),
			Source:      "waqi",
			ScrapedAt:   time.Now(),
		}
		stations = append(stations, station)
	}

	return stations, nil
}

// isInIndia checks if coordinates are within India's bounding box
func isInIndia(lat, lng float64) bool {
	// India's approximate bounding box
	return lat >= 6.0 && lat <= 37.0 && lng >= 68.0 && lng <= 98.0
}

// parseStationName extracts city and country from station name
func parseStationName(name string) (city, country string) {
	parts := strings.Split(name, ",")
	if len(parts) >= 2 {
		city = strings.TrimSpace(parts[len(parts)-2])
		country = strings.TrimSpace(parts[len(parts)-1])
	} else if len(parts) == 1 {
		city = strings.TrimSpace(parts[0])
		country = "Unknown"
	}
	return
}

// extractLocationFromURL extracts location name from URL
func extractLocationFromURL(url string) string {
	parts := strings.Split(url, "/")
	if len(parts) == 0 {
		return "Unknown"
	}
	location := parts[len(parts)-1]
	return formatLocationName(location)
}

// formatLocationName formats a URL slug to readable name
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

// storeAllStationsInRedis stores all station data in Redis
func (s *ScraperService) storeAllStationsInRedis() error {
	ctx := context.Background()
	pipe := s.redisClient.Pipeline()

	s.mu.RLock()
	stations := make([]*StationAQIData, 0, len(s.stations))
	for _, station := range s.stations {
		stations = append(stations, station)

		// Store individual station by H3
		stationKey := StationKeyPrefix + station.H3Index
		stationJSON, _ := json.Marshal(station)
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

// GetStationByH3 retrieves station data for an H3 hexagon
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

// GetNearestStationWithDistance finds the nearest station and returns distance in km
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

// GetStationsInRadius returns all stations within a given radius (km)
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

// GetStationStats returns statistics about cached stations
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

// LoadFromRedis loads cached stations from Redis on startup
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

// HTTP Handlers

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	service.mu.RLock()
	stationCount := len(service.stations)
	lastFetch := service.lastFetchTime
	service.mu.RUnlock()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":         "healthy",
		"stations":       stationCount,
		"last_fetch":     lastFetch,
		"fetch_interval": config.FetchInterval.String(),
		"timestamp":      time.Now(),
	})
}

func stationsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	country := r.URL.Query().Get("country")
	city := r.URL.Query().Get("city")
	source := r.URL.Query().Get("source")

	stations := service.GetAllStations()

	if country != "" || city != "" || source != "" {
		var filtered []*StationAQIData
		for _, s := range stations {
			if country != "" && !strings.EqualFold(s.Country, country) {
				continue
			}
			if city != "" && !strings.Contains(strings.ToLower(s.City), strings.ToLower(city)) {
				continue
			}
			if source != "" && !strings.EqualFold(s.Source, source) {
				continue
			}
			filtered = append(filtered, s)
		}
		stations = filtered
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":      len(stations),
		"stations":   stations,
		"last_fetch": service.lastFetchTime,
	})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	stats := service.GetStationStats()
	json.NewEncoder(w).Encode(stats)
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
		cell := h3.Cell(h3.IndexFromString(h3Index))
		if !cell.IsValid() {
			http.Error(w, `{"error": "invalid h3 index"}`, http.StatusBadRequest)
			return
		}
		latLng := cell.LatLng()
		station, dist := service.GetNearestStationWithDistance(latLng.Lat, latLng.Lng)

		if station != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"found":       true,
				"exact_match": false,
				"distance_km": dist,
				"station":     station,
			})
			return
		}
	}

	if station == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"found":    false,
			"h3_index": h3Index,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"found":       true,
		"exact_match": true,
		"station":     station,
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

	station, distKm := service.GetNearestStationWithDistance(lat, lng)
	if station == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"found": false,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"found":       true,
		"distance_km": distKm,
		"station":     station,
	})
}

func radiusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	radiusStr := r.URL.Query().Get("radius")

	if latStr == "" || lngStr == "" {
		http.Error(w, `{"error": "lat and lng parameters required"}`, http.StatusBadRequest)
		return
	}

	lat, _ := strconv.ParseFloat(latStr, 64)
	lng, _ := strconv.ParseFloat(lngStr, 64)

	radius := 50.0
	if radiusStr != "" {
		if r, err := strconv.ParseFloat(radiusStr, 64); err == nil {
			radius = r
		}
	}

	stations := service.GetStationsInRadius(lat, lng, radius)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":     len(stations),
		"radius_km": radius,
		"center":    map[string]float64{"lat": lat, "lng": lng},
		"stations":  stations,
	})
}

func fetchHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "POST method required"}`, http.StatusMethodNotAllowed)
		return
	}

	go service.FetchAllStations()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "fetch initiated",
		"message": "Check /health for progress",
	})
}

// Utility functions

func haversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000
	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	deltaLat := (lat2 - lat1) * math.Pi / 180
	deltaLng := (lng2 - lng1) * math.Pi / 180

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(deltaLng/2)*math.Sin(deltaLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// Background fetch scheduler
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
