package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"

	"github.com/green-corridor/ingestion-service/internal/config"
	"github.com/green-corridor/ingestion-service/internal/handler"
	"github.com/green-corridor/ingestion-service/internal/repository"
	"github.com/green-corridor/ingestion-service/internal/service"
)

func main() {
	// Load .env file if it exists
	_ = godotenv.Load()

	// Load configuration
	cfg := config.Load()

	// Initialize Redis repository
	redisRepo, err := repository.NewRedisRepository(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisRepo.Close()

	// Initialize services
	telemetrySvc := service.NewTelemetryService(redisRepo, cfg.H3Resolution, cfg.AQITTLSeconds)

	// Initialize handlers
	telemetryHandler := handler.NewTelemetryHandler(telemetrySvc)
	healthHandler := handler.NewHealthHandler(redisRepo)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "Green Corridor Ingestion Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${latency} ${method} ${path}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// Routes
	api := app.Group("/api/v1")

	// Health routes
	api.Get("/health", healthHandler.Health)
	api.Get("/stats", telemetryHandler.GetStats)

	// Telemetry routes
	api.Post("/telemetry", telemetryHandler.IngestTelemetry)
	api.Post("/telemetry/batch", telemetryHandler.IngestBatchTelemetry)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("Shutting down server...")

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := app.ShutdownWithContext(ctx); err != nil {
			log.Fatalf("Server forced to shutdown: %v", err)
		}
	}()

	// Start server
	port := cfg.Port
	log.Printf("🚀 Ingestion Service starting on port %s", port)
	log.Printf("📊 H3 Resolution: %d", cfg.H3Resolution)
	log.Printf("⏱️  AQI TTL: %d seconds", cfg.AQITTLSeconds)

	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
