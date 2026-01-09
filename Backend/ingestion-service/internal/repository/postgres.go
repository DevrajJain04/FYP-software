package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

// TelemetryRecord represents a single telemetry data point for persistence
type TelemetryRecord struct {
	VehicleID string
	Latitude  float64
	Longitude float64
	AQI       float64
	HexagonID string
	Timestamp time.Time
}

// PostgresRepository handles all PostgreSQL operations for persistent storage
type PostgresRepository struct {
	db  *sql.DB
	ctx context.Context
}

// NewPostgresRepository creates a new PostgreSQL repository
func NewPostgresRepository(connString string) (*PostgresRepository, error) {
	db, err := sql.Open("postgres", connString)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx := context.Background()

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	repo := &PostgresRepository{
		db:  db,
		ctx: ctx,
	}

	// Initialize schema
	if err := repo.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return repo, nil
}

// initSchema creates the necessary tables and hypertables
func (p *PostgresRepository) initSchema() error {
	// Create the telemetry table
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS vehicle_telemetry (
		id BIGSERIAL,
		vehicle_id VARCHAR(100) NOT NULL,
		latitude DOUBLE PRECISION NOT NULL,
		longitude DOUBLE PRECISION NOT NULL,
		aqi DOUBLE PRECISION NOT NULL,
		hexagon_id VARCHAR(20) NOT NULL,
		recorded_at TIMESTAMPTZ NOT NULL,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		PRIMARY KEY (id, recorded_at)
	);
	`

	if _, err := p.db.ExecContext(p.ctx, createTableSQL); err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}

	// Try to convert to TimescaleDB hypertable (if extension is available)
	// This is idempotent - will do nothing if already a hypertable
	hypertableSQL := `
	SELECT create_hypertable('vehicle_telemetry', 'recorded_at', 
		if_not_exists => TRUE,
		migrate_data => TRUE
	);
	`
	if _, err := p.db.ExecContext(p.ctx, hypertableSQL); err != nil {
		// TimescaleDB might not be installed, log but continue
		log.Printf("Note: TimescaleDB hypertable creation skipped (extension may not be installed): %v", err)
	}

	// Create indexes for common query patterns
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_id ON vehicle_telemetry(vehicle_id)`,
		`CREATE INDEX IF NOT EXISTS idx_telemetry_hexagon_id ON vehicle_telemetry(hexagon_id)`,
		`CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON vehicle_telemetry(recorded_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time ON vehicle_telemetry(vehicle_id, recorded_at DESC)`,
	}

	for _, idx := range indexes {
		if _, err := p.db.ExecContext(p.ctx, idx); err != nil {
			log.Printf("Warning: Index creation failed: %v", err)
		}
	}

	log.Println("✅ PostgreSQL schema initialized successfully")
	return nil
}

// Close closes the database connection
func (p *PostgresRepository) Close() error {
	return p.db.Close()
}

// Ping checks database connectivity
func (p *PostgresRepository) Ping() error {
	return p.db.PingContext(p.ctx)
}

// StoreTelemetry persists a single telemetry record
func (p *PostgresRepository) StoreTelemetry(record *TelemetryRecord) error {
	insertSQL := `
	INSERT INTO vehicle_telemetry (vehicle_id, latitude, longitude, aqi, hexagon_id, recorded_at)
	VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := p.db.ExecContext(p.ctx, insertSQL,
		record.VehicleID,
		record.Latitude,
		record.Longitude,
		record.AQI,
		record.HexagonID,
		record.Timestamp,
	)

	return err
}

// StoreTelemetryBatch persists multiple telemetry records efficiently
func (p *PostgresRepository) StoreTelemetryBatch(records []*TelemetryRecord) (int, error) {
	if len(records) == 0 {
		return 0, nil
	}

	tx, err := p.db.BeginTx(p.ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(p.ctx, `
		INSERT INTO vehicle_telemetry (vehicle_id, latitude, longitude, aqi, hexagon_id, recorded_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`)
	if err != nil {
		return 0, fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	inserted := 0
	for _, record := range records {
		_, err := stmt.ExecContext(p.ctx,
			record.VehicleID,
			record.Latitude,
			record.Longitude,
			record.AQI,
			record.HexagonID,
			record.Timestamp,
		)
		if err != nil {
			log.Printf("Warning: Failed to insert record for vehicle %s: %v", record.VehicleID, err)
			continue
		}
		inserted++
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return inserted, nil
}

// GetTelemetryStats returns basic statistics about stored data
func (p *PostgresRepository) GetTelemetryStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total records
	var totalRecords int64
	err := p.db.QueryRowContext(p.ctx, "SELECT COUNT(*) FROM vehicle_telemetry").Scan(&totalRecords)
	if err != nil {
		return nil, err
	}
	stats["total_records"] = totalRecords

	// Unique vehicles
	var uniqueVehicles int64
	err = p.db.QueryRowContext(p.ctx, "SELECT COUNT(DISTINCT vehicle_id) FROM vehicle_telemetry").Scan(&uniqueVehicles)
	if err != nil {
		return nil, err
	}
	stats["unique_vehicles"] = uniqueVehicles

	// Unique hexagons
	var uniqueHexagons int64
	err = p.db.QueryRowContext(p.ctx, "SELECT COUNT(DISTINCT hexagon_id) FROM vehicle_telemetry").Scan(&uniqueHexagons)
	if err != nil {
		return nil, err
	}
	stats["unique_hexagons"] = uniqueHexagons

	// Date range
	var minDate, maxDate sql.NullTime
	err = p.db.QueryRowContext(p.ctx, "SELECT MIN(recorded_at), MAX(recorded_at) FROM vehicle_telemetry").Scan(&minDate, &maxDate)
	if err != nil {
		return nil, err
	}
	if minDate.Valid {
		stats["earliest_record"] = minDate.Time
		stats["latest_record"] = maxDate.Time
	}

	return stats, nil
}
