package handler

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/green-corridor/ingestion-service/internal/models"
	"github.com/green-corridor/ingestion-service/internal/service"
)

// TelemetryHandler handles telemetry HTTP endpoints
type TelemetryHandler struct {
	service *service.TelemetryService
}

// NewTelemetryHandler creates a new telemetry handler
func NewTelemetryHandler(svc *service.TelemetryService) *TelemetryHandler {
	log.Println("📡 TelemetryHandler initialized")
	return &TelemetryHandler{
		service: svc,
	}
}

// IngestTelemetry handles single telemetry data ingestion
// POST /api/v1/telemetry
func (h *TelemetryHandler) IngestTelemetry(c *fiber.Ctx) error {
	var data models.TelemetryData

	if err := c.BodyParser(&data); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.TelemetryResponse{
			Success: false,
			Message: "Invalid request body: " + err.Error(),
		})
	}

	// Validate required fields
	if data.VehicleID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.TelemetryResponse{
			Success: false,
			Message: "vehicle_id is required",
		})
	}

	if data.Latitude < -90 || data.Latitude > 90 {
		return c.Status(fiber.StatusBadRequest).JSON(models.TelemetryResponse{
			Success: false,
			Message: "latitude must be between -90 and 90",
		})
	}

	if data.Longitude < -180 || data.Longitude > 180 {
		return c.Status(fiber.StatusBadRequest).JSON(models.TelemetryResponse{
			Success: false,
			Message: "longitude must be between -180 and 180",
		})
	}

	if data.AQI < 0 || data.AQI > 500 {
		return c.Status(fiber.StatusBadRequest).JSON(models.TelemetryResponse{
			Success: false,
			Message: "aqi must be between 0 and 500",
		})
	}

	hexagonID, err := h.service.IngestTelemetry(&data)
	if err != nil {
		log.Printf("❌ Telemetry ingestion failed for vehicle %s: %v", data.VehicleID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(models.TelemetryResponse{
			Success: false,
			Message: "Failed to ingest telemetry: " + err.Error(),
		})
	}

	log.Printf("✅ Telemetry ingested: vehicle=%s hex=%s aqi=%.1f lat=%.4f lng=%.4f",
		data.VehicleID, hexagonID, data.AQI, data.Latitude, data.Longitude)

	return c.Status(fiber.StatusOK).JSON(models.TelemetryResponse{
		Success:   true,
		Message:   "Telemetry ingested successfully",
		HexagonID: hexagonID,
	})
}

// IngestBatchTelemetry handles batch telemetry data ingestion
// POST /api/v1/telemetry/batch
func (h *TelemetryHandler) IngestBatchTelemetry(c *fiber.Ctx) error {
	startTime := time.Now()

	var batch models.BatchTelemetryData

	if err := c.BodyParser(&batch); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.BatchTelemetryResponse{
			Success: false,
			Message: "Invalid request body: " + err.Error(),
		})
	}

	if len(batch.Data) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(models.BatchTelemetryResponse{
			Success: false,
			Message: "Batch data is empty",
		})
	}

	processed, failed, err := h.service.IngestBatchTelemetry(&batch)
	if err != nil {
		log.Printf("❌ Batch ingestion failed: %v (attempted %d records)", err, len(batch.Data))
		return c.Status(fiber.StatusInternalServerError).JSON(models.BatchTelemetryResponse{
			Success: false,
			Message: "Failed to process batch: " + err.Error(),
		})
	}

	elapsed := time.Since(startTime)

	log.Printf("📦 Batch ingestion complete: processed=%d failed=%d total=%d duration=%v",
		processed, failed, len(batch.Data), elapsed)

	return c.Status(fiber.StatusOK).JSON(models.BatchTelemetryResponse{
		Success:   true,
		Message:   "Batch processed",
		Processed: processed,
		Failed:    failed,
		TotalTime: elapsed.String(),
	})
}

// GetStats returns ingestion statistics
// GET /api/v1/stats
func (h *TelemetryHandler) GetStats(c *fiber.Ctx) error {
	stats, err := h.service.GetStats()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to retrieve stats: " + err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    stats,
	})
}
