package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	h3 "github.com/uber/h3-go/v4"
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	service.mu.RLock()
	stationCount := len(service.stations)
	lastFetch := service.lastFetchTime
	service.mu.RUnlock()

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":         "healthy",
		"stations":       stationCount,
		"last_fetch":     lastFetch,
		"fetch_interval": config.FetchInterval.String(),
		"timestamp":      time.Now(),
	})
}

func stationsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	country := r.URL.Query().Get("country")
	city := r.URL.Query().Get("city")
	source := r.URL.Query().Get("source")

	stations := service.GetAllStations()

	if country != "" || city != "" || source != "" {
		var filtered []*StationAQIData
		for _, s := range stations {
			if country != "" && !strings.EqualFold(s.Country, country) {
				continue
			}
			if city != "" && !strings.Contains(strings.ToLower(s.City), strings.ToLower(city)) {
				continue
			}
			if source != "" && !strings.EqualFold(s.Source, source) {
				continue
			}
			filtered = append(filtered, s)
		}
		stations = filtered
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"count":      len(stations),
		"stations":   stations,
		"last_fetch": service.lastFetchTime,
	})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	stats := service.GetStationStats()
	_ = json.NewEncoder(w).Encode(stats)
}

func h3LookupHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	h3Index := r.URL.Query().Get("h3")
	if h3Index == "" {
		http.Error(w, `{"error": "h3 parameter required"}`, http.StatusBadRequest)
		return
	}

	station := service.GetStationByH3(h3Index)
	if station == nil {
		cell := h3.Cell(h3.IndexFromString(h3Index))
		if !cell.IsValid() {
			http.Error(w, `{"error": "invalid h3 index"}`, http.StatusBadRequest)
			return
		}
		latLng := cell.LatLng()
		station, dist := service.GetNearestStationWithDistance(latLng.Lat, latLng.Lng)

		if station != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"found":       true,
				"exact_match": false,
				"distance_km": dist,
				"station":     station,
			})
			return
		}
	}

	if station == nil {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"found":    false,
			"h3_index": h3Index,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"found":       true,
		"exact_match": true,
		"station":     station,
	})
}

func nearestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")

	if latStr == "" || lngStr == "" {
		http.Error(w, `{"error": "lat and lng parameters required"}`, http.StatusBadRequest)
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		http.Error(w, `{"error": "invalid lat parameter"}`, http.StatusBadRequest)
		return
	}

	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		http.Error(w, `{"error": "invalid lng parameter"}`, http.StatusBadRequest)
		return
	}

	station, distKm := service.GetNearestStationWithDistance(lat, lng)
	if station == nil {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"found": false,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"found":       true,
		"distance_km": distKm,
		"station":     station,
	})
}

func radiusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	radiusStr := r.URL.Query().Get("radius")

	if latStr == "" || lngStr == "" {
		http.Error(w, `{"error": "lat and lng parameters required"}`, http.StatusBadRequest)
		return
	}

	lat, _ := strconv.ParseFloat(latStr, 64)
	lng, _ := strconv.ParseFloat(lngStr, 64)

	radius := 50.0
	if radiusStr != "" {
		if r, err := strconv.ParseFloat(radiusStr, 64); err == nil {
			radius = r
		}
	}

	stations := service.GetStationsInRadius(lat, lng, radius)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"count":     len(stations),
		"radius_km": radius,
		"center":    map[string]float64{"lat": lat, "lng": lng},
		"stations":  stations,
	})
}

func fetchHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "POST method required"}`, http.StatusMethodNotAllowed)
		return
	}

	go service.FetchAllStations()

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "fetch initiated",
		"message": "Check /health for progress",
	})
}
