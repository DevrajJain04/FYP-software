package service

import (
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/uber/h3-go/v4"

	"github.com/green-corridor/ingestion-service/internal/models"
	"github.com/green-corridor/ingestion-service/internal/repository"
)

// TelemetryService handles telemetry business logic
type TelemetryService struct {
	redisRepo     *repository.RedisRepository
	postgresRepo  *repository.PostgresRepository // For persistent storage
	h3Resolution  int
	aqiTTLSeconds int
}

// NewTelemetryService creates a new telemetry service
func NewTelemetryService(redisRepo *repository.RedisRepository, postgresRepo *repository.PostgresRepository, h3Resolution, aqiTTLSeconds int) *TelemetryService {
	return &TelemetryService{
		redisRepo:     redisRepo,
		postgresRepo:  postgresRepo,
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

	// Store in Redis using debounce strategy (for real-time routing)
	err := s.redisRepo.StoreAQI(hexagonID, data.VehicleID, data.AQI, s.aqiTTLSeconds)
	if err != nil {
		return "", fmt.Errorf("failed to store AQI data in Redis: %w", err)
	}

	// Persist to PostgreSQL for historical analysis (fire and forget, non-blocking)
	if s.postgresRepo != nil {
		go func() {
			record := &repository.TelemetryRecord{
				VehicleID: data.VehicleID,
				Latitude:  data.Latitude,
				Longitude: data.Longitude,
				AQI:       data.AQI,
				HexagonID: hexagonID,
				Timestamp: data.Timestamp,
			}
			if err := s.postgresRepo.StoreTelemetry(record); err != nil {
				log.Printf("Warning: Failed to persist telemetry to PostgreSQL: %v", err)
			}
		}()
	}

	return hexagonID, nil
}

// IngestBatchTelemetry processes multiple telemetry data points
func (s *TelemetryService) IngestBatchTelemetry(batch *models.BatchTelemetryData) (int, int, error) {
	processed := 0
	failed := 0

	// Collect records for batch persistence
	var persistRecords []*repository.TelemetryRecord

	for _, data := range batch.Data {
		dataCopy := data // Create a copy to avoid pointer issues

		// Set timestamp if not provided
		if dataCopy.Timestamp.IsZero() {
			dataCopy.Timestamp = time.Now().UTC()
		}

		// Convert lat/long to H3 hexagon index
		latLng := h3.NewLatLng(dataCopy.Latitude, dataCopy.Longitude)
		hexIndex := h3.LatLngToCell(latLng, s.h3Resolution)
		hexagonID := hexIndex.String()

		// Store in Redis
		err := s.redisRepo.StoreAQI(hexagonID, dataCopy.VehicleID, dataCopy.AQI, s.aqiTTLSeconds)
		if err != nil {
			failed++
			continue
		}
		processed++

		// Collect for batch persistence
		if s.postgresRepo != nil {
			persistRecords = append(persistRecords, &repository.TelemetryRecord{
				VehicleID: dataCopy.VehicleID,
				Latitude:  dataCopy.Latitude,
				Longitude: dataCopy.Longitude,
				AQI:       dataCopy.AQI,
				HexagonID: hexagonID,
				Timestamp: dataCopy.Timestamp,
			})
		}
	}

	// Batch persist to PostgreSQL (fire and forget)
	if s.postgresRepo != nil && len(persistRecords) > 0 {
		go func(records []*repository.TelemetryRecord) {
			inserted, err := s.postgresRepo.StoreTelemetryBatch(records)
			if err != nil {
				log.Printf("Warning: Batch persistence failed: %v", err)
			} else {
				log.Printf("📦 Persisted %d telemetry records to PostgreSQL", inserted)
			}
		}(persistRecords)
	}

	return processed, failed, nil
}

// GetStats retrieves current statistics
func (s *TelemetryService) GetStats() (*models.StatsResponse, error) {
	hexCount, vehicleCount, err := s.redisRepo.GetStats()
	if err != nil {
		return nil, err
	}

	// Get top hexagons by vehicle count
	topHexagons, err := s.getTopHexagons(10)
	if err != nil {
		return nil, err
	}

	// Get persistent storage stats if available
	var persistentStats map[string]interface{}
	if s.postgresRepo != nil {
		persistentStats, _ = s.postgresRepo.GetTelemetryStats()
	}

	return &models.StatsResponse{
		TotalHexagons:   hexCount,
		TotalVehicles:   vehicleCount,
		TopHexagons:     topHexagons,
		PersistentStats: persistentStats,
	}, nil
}

// getTopHexagons returns the hexagons with the most vehicles
func (s *TelemetryService) getTopHexagons(limit int) ([]models.HexagonStats, error) {
	keys, err := s.redisRepo.GetAllHexagonKeys()
	if err != nil {
		return nil, err
	}

	var stats []models.HexagonStats

	for _, key := range keys {
		// Extract hexagon ID from key
		hexID := strings.TrimPrefix(key, repository.AQIKeyPrefix)

		// Get AQI data for this hexagon
		aqiMap, err := s.redisRepo.GetHexagonAQI(hexID)
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
