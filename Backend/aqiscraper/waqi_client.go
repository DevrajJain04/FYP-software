package main

import (
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	h3 "github.com/uber/h3-go/v4"
)

// fetchWAQIStationsInBounds fetches stations from WAQI API for international regions.
func (s *ScraperService) fetchWAQIStationsInBounds(latMin, lngMin, latMax, lngMax float64) ([]*StationAQIData, error) {
	url := fmt.Sprintf("%s/map/bounds/?latlng=%f,%f,%f,%f&token=%s",
		WAQIBaseURL, latMin, lngMin, latMax, lngMax, s.waqiAPIKey)

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var mapResp WAQIMapBoundsResponse
	if err := json.Unmarshal(body, &mapResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if mapResp.Status != "ok" {
		return nil, fmt.Errorf("API returned status: %s", mapResp.Status)
	}

	var stations []*StationAQIData
	for _, st := range mapResp.Data {
		// Skip stations in India (we get those from aqi.in)
		if isInIndia(st.Lat, st.Lon) {
			continue
		}

		aqi, err := strconv.ParseFloat(st.AQI, 64)
		if err != nil || aqi <= 0 {
			continue
		}

		// Calculate H3 index
		latLng := h3.NewLatLng(st.Lat, st.Lon)
		h3Index := h3.LatLngToCell(latLng, s.h3Resolution)

		// Parse city and country from station name
		city, country := parseStationName(st.Name)

		station := &StationAQIData{
			Location:    st.Name,
			City:        city,
			Country:     country,
			Latitude:    st.Lat,
			Longitude:   st.Lon,
			AQI:         aqi,
			H3Index:     h3Index.String(),
			LastUpdated: time.Now().Format(time.RFC3339),
			Source:      "waqi",
			ScrapedAt:   time.Now(),
		}
		stations = append(stations, station)
	}

	return stations, nil
}

// isInIndia checks if coordinates are within India's bounding box.
func isInIndia(lat, lng float64) bool {
	// India's approximate bounding box
	return lat >= 6.0 && lat <= 37.0 && lng >= 68.0 && lng <= 98.0
}

// parseStationName extracts city and country from station name.
func parseStationName(name string) (city, country string) {
	parts := strings.Split(name, ",")
	if len(parts) >= 2 {
		city = strings.TrimSpace(parts[len(parts)-2])
		country = strings.TrimSpace(parts[len(parts)-1])
	} else if len(parts) == 1 {
		city = strings.TrimSpace(parts[0])
		country = "Unknown"
	}
	return
}
