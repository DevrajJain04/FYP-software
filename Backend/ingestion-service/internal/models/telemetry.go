package models

import "time"

// TelemetryData represents incoming vehicle telemetry
type TelemetryData struct {
	VehicleID string    `json:"vehicle_id" validate:"required"`
	Latitude  float64   `json:"latitude" validate:"required,min=-90,max=90"`
	Longitude float64   `json:"longitude" validate:"required,min=-180,max=180"`
	AQI       float64   `json:"aqi" validate:"required,min=0,max=500"`
	Timestamp time.Time `json:"timestamp"`
}

// BatchTelemetryData represents a batch of telemetry data
type BatchTelemetryData struct {
	Data []TelemetryData `json:"data" validate:"required,min=1,dive"`
}

// TelemetryResponse represents the response after ingestion
type TelemetryResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	HexagonID string `json:"hexagon_id,omitempty"`
}

// BatchTelemetryResponse represents the response for batch ingestion
type BatchTelemetryResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	Processed int    `json:"processed"`
	Failed    int    `json:"failed"`
	TotalTime string `json:"total_time"`
}

// StatsResponse represents ingestion statistics
type StatsResponse struct {
	TotalHexagons    int64                  `json:"total_hexagons"`
	TotalVehicles    int64                  `json:"total_vehicles"`
	IngestionsPerSec float64                `json:"ingestions_per_sec"`
	TopHexagons      []HexagonStats         `json:"top_hexagons"`
	PersistentStats  map[string]interface{} `json:"persistent_stats,omitempty"` // PostgreSQL storage stats
}

// HexagonStats represents statistics for a single hexagon
type HexagonStats struct {
	HexagonID    string  `json:"hexagon_id"`
	VehicleCount int     `json:"vehicle_count"`
	MedianAQI    float64 `json:"median_aqi"`
}
