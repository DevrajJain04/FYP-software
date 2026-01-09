package config

import (
	"os"
	"strconv"
)

// Config holds the application configuration
type Config struct {
	Port          string
	RedisURL      string
	PostgresURL   string
	H3Resolution  int
	AQITTLSeconds int
	EnablePersist bool // Enable persistent storage to PostgreSQL
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:          getEnv("PORT", "8080"),
		RedisURL:      getEnv("REDIS_URL", "localhost:6379"),
		PostgresURL:   getEnv("POSTGRES_URL", "postgres://postgres:postgres@localhost:5432/green_corridor?sslmode=disable"),
		H3Resolution:  getEnvInt("H3_RESOLUTION", 9),
		AQITTLSeconds: getEnvInt("AQI_TTL_SECONDS", 300), // 5 minutes default
		EnablePersist: getEnvBool("ENABLE_PERSIST", true),
	}
}

func getEnvBool(key string, defaultValue bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
