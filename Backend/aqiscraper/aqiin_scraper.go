package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gocolly/colly/v2"
	h3 "github.com/uber/h3-go/v4"
)

// scrapeAllIndianCities scrapes AQI data from aqi.in for all Indian cities.
func (s *ScraperService) scrapeAllIndianCities() []*StationAQIData {
	var allStations []*StationAQIData
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Limit concurrent requests.
	semaphore := make(chan struct{}, 5)

	for _, city := range indianCities {
		wg.Add(1)
		go func(c IndianCity) {
			defer wg.Done()
			semaphore <- struct{}{}        // Acquire
			defer func() { <-semaphore }() // Release

			stations := s.scrapeIndianCity(c)
			if len(stations) > 0 {
				mu.Lock()
				allStations = append(allStations, stations...)
				mu.Unlock()
			}

			// Small delay to be respectful to the server.
			time.Sleep(500 * time.Millisecond)
		}(city)
	}

	wg.Wait()
	return allStations
}

// scrapeIndianCity scrapes a single Indian city from aqi.in.
func (s *ScraperService) scrapeIndianCity(city IndianCity) []*StationAQIData {
	var stations []*StationAQIData

	collector := colly.NewCollector(
		colly.AllowedDomains("www.aqi.in", "aqi.in"),
		colly.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)
	collector.SetRequestTimeout(30 * time.Second)

	// Track discovered location URLs for this city.
	locationURLs := make(map[string]bool)
	var urlMu sync.Mutex

	// Find all location links within the city.
	collector.OnHTML("a[href*='/dashboard/india/']", func(e *colly.HTMLElement) {
		link := e.Attr("href")

		// Skip pollutant-specific and historical pages.
		if strings.Contains(link, "/pm") || strings.Contains(link, "/co") ||
			strings.Contains(link, "/so2") || strings.Contains(link, "/no2") ||
			strings.Contains(link, "/o3") || strings.Contains(link, "/historical") {
			return
		}

		// Must be within our target city's state.
		stateLower := strings.ToLower(strings.ReplaceAll(city.State, " ", "-"))
		if !strings.Contains(link, "/"+stateLower+"/") {
			return
		}

		if !strings.HasPrefix(link, "http") {
			link = AQIInBaseURL + link
		}

		urlMu.Lock()
		locationURLs[link] = true
		urlMu.Unlock()
	})

	// Parse script tags for AQI and coordinate data.
	collector.OnHTML("script", func(e *colly.HTMLElement) {
		scriptContent := e.Text
		if !strings.Contains(scriptContent, "self.__next_f.push") {
			return
		}

		station := s.parseAQIInScript(scriptContent, e.Request.URL.String(), city)
		if station != nil {
			stations = append(stations, station)
		}
	})

	// Build the city URL.
	stateLower := strings.ToLower(strings.ReplaceAll(city.State, " ", "-"))
	cityURL := fmt.Sprintf("%s/dashboard/india/%s/%s", AQIInBaseURL, stateLower, city.Slug)

	// Visit main city page.
	_ = collector.Visit(cityURL)

	// Visit discovered location pages.
	for url := range locationURLs {
		if url != cityURL {
			_ = collector.Visit(url)
		}
	}

	return stations
}

// parseAQIInScript extracts AQI data from aqi.in Next.js script content.
func (s *ScraperService) parseAQIInScript(scriptContent, url string, city IndianCity) *StationAQIData {
	var lat, lng, aqi float64
	var location, lastUpdated string

	// Extract latitude.
	latPatterns := []string{
		`"lat"\s*:\s*"([0-9.-]+)"`,
		`"latitude"\s*:\s*"?([0-9.-]+)"?`,
	}
	for _, pattern := range latPatterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(scriptContent); len(matches) > 1 {
			if val, err := strconv.ParseFloat(matches[1], 64); err == nil && val != 0 {
				lat = val
				break
			}
		}
	}

	// Extract longitude.
	lngPatterns := []string{
		`"long"\s*:\s*"([0-9.-]+)"`,
		`"lon"\s*:\s*"([0-9.-]+)"`,
		`"longitude"\s*:\s*"?([0-9.-]+)"?`,
	}
	for _, pattern := range lngPatterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(scriptContent); len(matches) > 1 {
			if val, err := strconv.ParseFloat(matches[1], 64); err == nil && val != 0 {
				lng = val
				break
			}
		}
	}

	// Extract AQI.
	aqiRe := regexp.MustCompile(`"aqi"\s*:\s*"?([0-9]+)"?`)
	aqiMatches := aqiRe.FindAllStringSubmatch(scriptContent, -1)
	for _, match := range aqiMatches {
		if len(match) > 1 {
			if val, err := strconv.ParseFloat(match[1], 64); err == nil && val > 0 && val < 1000 {
				aqi = val
				break
			}
		}
	}

	// Extract location name.
	locationPatterns := []string{
		`"location"\s*:\s*"([^"]+)"`,
		`"station"\s*:\s*"([^"]+)"`,
		`"name"\s*:\s*"([^"]+)"`,
	}
	for _, pattern := range locationPatterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(scriptContent); len(matches) > 1 {
			location = matches[1]
			break
		}
	}

	// Extract last updated.
	lastUpdatedRe := regexp.MustCompile(`"last_updated"\s*:\s*"([^"]+)"`)
	if matches := lastUpdatedRe.FindStringSubmatch(scriptContent); len(matches) > 1 {
		lastUpdated = matches[1]
	}

	// Validate we have necessary data.
	if lat == 0 || lng == 0 || aqi == 0 {
		return nil
	}

	// Use URL slug if location not found.
	if location == "" {
		location = extractLocationFromURL(url)
	}

	// Calculate H3 index.
	latLng := h3.NewLatLng(lat, lng)
	h3Index := h3.LatLngToCell(latLng, s.h3Resolution)

	return &StationAQIData{
		Location:    location,
		City:        city.City,
		State:       city.State,
		Country:     "India",
		Latitude:    lat,
		Longitude:   lng,
		AQI:         aqi,
		H3Index:     h3Index.String(),
		LastUpdated: lastUpdated,
		Source:      "aqi.in",
		ScrapedAt:   time.Now(),
	}
}

// extractLocationFromURL extracts location name from URL.
func extractLocationFromURL(url string) string {
	parts := strings.Split(url, "/")
	if len(parts) == 0 {
		return "Unknown"
	}
	location := parts[len(parts)-1]
	return formatLocationName(location)
}

// formatLocationName formats a URL slug to readable name.
func formatLocationName(location string) string {
	name := strings.ReplaceAll(location, "-", " ")
	words := strings.Fields(name)
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
		}
	}
	return strings.Join(words, " ")
}
