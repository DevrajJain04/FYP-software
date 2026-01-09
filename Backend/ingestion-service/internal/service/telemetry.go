package service

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/uber/h3-go/v4"

	"github.com/green-corridor/ingestion-service/internal/models"
	"github.com/green-corridor/ingestion-service/internal/repository"
)

// TelemetryService handles telemetry business logic
type TelemetryService struct {
	repo          *repository.RedisRepository
	h3Resolution  int
	aqiTTLSeconds int
}

// NewTelemetryService creates a new telemetry service
func NewTelemetryService(repo *repository.RedisRepository, h3Resolution, aqiTTLSeconds int) *TelemetryService {
	return &TelemetryService{
		repo:          repo,
		h3Resolution:  h3Resolution,
		aqiTTLSeconds: aqiTTLSeconds,
	}
}

// IngestTelemetry processes a single telemetry data point
func (s *TelemetryService) IngestTelemetry(data *models.TelemetryData) (string, error) {
	// Set timestamp if not provided
	if data.Timestamp.IsZero() {
		data.Timestamp = time.Now().UTC()
	}

	// Convert lat/long to H3 hexagon index
	latLng := h3.NewLatLng(data.Latitude, data.Longitude)
	hexIndex := h3.LatLngToCell(latLng, s.h3Resolution)
	hexagonID := hexIndex.String()

	// Store in Redis using debounce strategy
	err := s.repo.StoreAQI(hexagonID, data.VehicleID, data.AQI, s.aqiTTLSeconds)
	if err != nil {
		return "", fmt.Errorf("failed to store AQI data: %w", err)
	}

	return hexagonID, nil
}

// IngestBatchTelemetry processes multiple telemetry data points
func (s *TelemetryService) IngestBatchTelemetry(batch *models.BatchTelemetryData) (int, int, error) {
	processed := 0
	failed := 0

	for _, data := range batch.Data {
		dataCopy := data // Create a copy to avoid pointer issues
		_, err := s.IngestTelemetry(&dataCopy)
		if err != nil {
			failed++
		} else {
			processed++
		}
	}

	return processed, failed, nil
}

// GetStats retrieves current statistics
func (s *TelemetryService) GetStats() (*models.StatsResponse, error) {
	hexCount, vehicleCount, err := s.repo.GetStats()
	if err != nil {
		return nil, err
	}

	// Get top hexagons by vehicle count
	topHexagons, err := s.getTopHexagons(10)
	if err != nil {
		return nil, err
	}

	return &models.StatsResponse{
		TotalHexagons: hexCount,
		TotalVehicles: vehicleCount,
		TopHexagons:   topHexagons,
	}, nil
}

// getTopHexagons returns the hexagons with the most vehicles
func (s *TelemetryService) getTopHexagons(limit int) ([]models.HexagonStats, error) {
	keys, err := s.repo.GetAllHexagonKeys()
	if err != nil {
		return nil, err
	}

	var stats []models.HexagonStats

	for _, key := range keys {
		// Extract hexagon ID from key
		hexID := strings.TrimPrefix(key, repository.AQIKeyPrefix)

		// Get AQI data for this hexagon
		aqiMap, err := s.repo.GetHexagonAQI(hexID)
		if err != nil {
			continue
		}

		vehicleCount := len(aqiMap)
		if vehicleCount == 0 {
			continue
		}

		// Calculate median AQI
		medianAQI := calculateMedian(aqiMap)

		stats = append(stats, models.HexagonStats{
			HexagonID:    hexID,
			VehicleCount: vehicleCount,
			MedianAQI:    medianAQI,
		})
	}

	// Sort by vehicle count descending
	sort.Slice(stats, func(i, j int) bool {
		return stats[i].VehicleCount > stats[j].VehicleCount
	})

	// Limit results
	if len(stats) > limit {
		stats = stats[:limit]
	}

	return stats, nil
}

// calculateMedian calculates the median AQI from a map of vehicle AQI values
func calculateMedian(aqiMap map[string]float64) float64 {
	if len(aqiMap) == 0 {
		return 0
	}

	values := make([]float64, 0, len(aqiMap))
	for _, v := range aqiMap {
		values = append(values, v)
	}

	sort.Float64s(values)

	n := len(values)
	if n%2 == 0 {
		return (values[n/2-1] + values[n/2]) / 2
	}
	return values[n/2]
}
