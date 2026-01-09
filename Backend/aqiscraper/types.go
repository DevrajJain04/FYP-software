package main

import (
	"net/http"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// StationAQIData represents the AQI information for a station with coordinates.
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

// WAQIMapBoundsResponse represents stations within map bounds from WAQI API.
type WAQIMapBoundsResponse struct {
	Status string `json:"status"`
	Data   []struct {
		Lat     float64 `json:"lat"`
		Lon     float64 `json:"lon"`
		UID     int     `json:"uid"`
		AQI     string  `json:"aqi"`
		Station struct {
			Name string `json:"name"`
			Time string `json:"time"`
		} `json:"station"`
	} `json:"data"`
}

// IndianCity represents a city to scrape from aqi.in.
type IndianCity struct {
	State string
	City  string
	Slug  string // URL slug
}

// ScraperService handles AQI fetching and caching.
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

// Config from environment.
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
