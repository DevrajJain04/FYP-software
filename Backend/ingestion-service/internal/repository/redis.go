package repository

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// Key prefixes
	AQIKeyPrefix     = "aqi:h3:"
	StatsKeyPrefix   = "stats:"
	VehicleKeyPrefix = "vehicle:"
)

// RedisRepository handles all Redis operations
type RedisRepository struct {
	client *redis.Client
	ctx    context.Context
}

// NewRedisRepository creates a new Redis repository
func NewRedisRepository(redisURL string) (*RedisRepository, error) {
	log.Printf("🔗 Connecting to Redis at %s...", redisURL)

	client := redis.NewClient(&redis.Options{
		Addr:         redisURL,
		Password:     "", // No password by default
		DB:           0,
		PoolSize:     100,
		MinIdleConns: 10,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx := context.Background()

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Printf("✅ Redis connected successfully (pool_size=100)")

	return &RedisRepository{
		client: client,
		ctx:    ctx,
	}, nil
}

// Close closes the Redis connection
func (r *RedisRepository) Close() error {
	return r.client.Close()
}

// Ping checks Redis connectivity
func (r *RedisRepository) Ping() error {
	return r.client.Ping(r.ctx).Err()
}

// StoreAQI stores AQI data for a vehicle in a hexagon
// Key: aqi:h3:{hexagon_id} -> Hash{vehicle_id: aqi_value}
// This implements the "debounce" strategy - one car = one vote
func (r *RedisRepository) StoreAQI(hexagonID, vehicleID string, aqi float64, ttlSeconds int) error {
	key := AQIKeyPrefix + hexagonID

	// Use pipeline for atomic operations
	pipe := r.client.Pipeline()

	// Store AQI value in hash (vehicle_id -> aqi)
	pipe.HSet(r.ctx, key, vehicleID, fmt.Sprintf("%.2f", aqi))

	// Set/refresh TTL on the key
	pipe.Expire(r.ctx, key, time.Duration(ttlSeconds)*time.Second)

	// Track vehicle's current hexagon for stats
	vehicleKey := VehicleKeyPrefix + vehicleID
	pipe.Set(r.ctx, vehicleKey, hexagonID, time.Duration(ttlSeconds)*time.Second)

	// Increment ingestion counter
	pipe.Incr(r.ctx, StatsKeyPrefix+"ingestions")

	_, err := pipe.Exec(r.ctx)
	return err
}

// GetHexagonAQI retrieves all AQI values for a hexagon
func (r *RedisRepository) GetHexagonAQI(hexagonID string) (map[string]float64, error) {
	key := AQIKeyPrefix + hexagonID

	result, err := r.client.HGetAll(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	aqiMap := make(map[string]float64)
	for vehicleID, aqiStr := range result {
		aqi, err := strconv.ParseFloat(aqiStr, 64)
		if err == nil {
			aqiMap[vehicleID] = aqi
		}
	}

	return aqiMap, nil
}

// GetAllHexagonKeys returns all hexagon keys currently stored
func (r *RedisRepository) GetAllHexagonKeys() ([]string, error) {
	var cursor uint64
	var keys []string

	for {
		var scanKeys []string
		var err error
		scanKeys, cursor, err = r.client.Scan(r.ctx, cursor, AQIKeyPrefix+"*", 1000).Result()
		if err != nil {
			return nil, err
		}

		keys = append(keys, scanKeys...)

		if cursor == 0 {
			break
		}
	}

	return keys, nil
}

// GetStats retrieves ingestion statistics
func (r *RedisRepository) GetStats() (int64, int64, error) {
	// Count hexagons
	hexKeys, err := r.GetAllHexagonKeys()
	if err != nil {
		return 0, 0, err
	}
	hexCount := int64(len(hexKeys))

	// Count unique vehicles (approximate)
	var vehicleCursor uint64
	vehicleCount := int64(0)
	for {
		var scanKeys []string
		var err error
		scanKeys, vehicleCursor, err = r.client.Scan(r.ctx, vehicleCursor, VehicleKeyPrefix+"*", 1000).Result()
		if err != nil {
			return 0, 0, err
		}
		vehicleCount += int64(len(scanKeys))
		if vehicleCursor == 0 {
			break
		}
	}

	return hexCount, vehicleCount, nil
}

// GetIngestionCount returns the total number of ingestions
func (r *RedisRepository) GetIngestionCount() (int64, error) {
	count, err := r.client.Get(r.ctx, StatsKeyPrefix+"ingestions").Int64()
	if err == redis.Nil {
		return 0, nil
	}
	return count, err
}
