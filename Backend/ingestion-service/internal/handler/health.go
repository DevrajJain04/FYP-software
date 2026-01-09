package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/green-corridor/ingestion-service/internal/repository"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	repo *repository.RedisRepository
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(repo *repository.RedisRepository) *HealthHandler {
	return &HealthHandler{
		repo: repo,
	}
}

// Health checks the health of the service
// GET /api/v1/health
func (h *HealthHandler) Health(c *fiber.Ctx) error {
	// Check Redis connectivity
	redisStatus := "healthy"
	if err := h.repo.Ping(); err != nil {
		redisStatus = "unhealthy: " + err.Error()
	}

	status := "healthy"
	if redisStatus != "healthy" {
		status = "degraded"
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":  status,
		"service": "ingestion-service",
		"dependencies": fiber.Map{
			"redis": redisStatus,
		},
	})
}
