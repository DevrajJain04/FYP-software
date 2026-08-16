import React, { useState, useEffect, useCallback } from 'react';
import { getScrapedStations, getNearestStation, isBackendAvailable } from '../services/backendService';

/**
 * StationsPage - View all AQI monitoring stations
 */

const getAQIColor = (aqi) => {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#84cc16';
  if (aqi <= 150) return '#f59e0b';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#7c2d12';
  return '#4a044e';
};

const getAQILabel = (aqi) => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy (Sensitive)';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

const StationsPage = () => {
  const [stations, setStations] = useState([]);
  const [filteredStations, setFilteredStations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [aqiFilter, setAqiFilter] = useState('all');
  const [sortBy, setSortBy] = useState('aqi-asc');

  // Check backend on mount
  useEffect(() => {
    const checkBackend = async () => {
      const available = await isBackendAvailable();
      setBackendOnline(available);
    };
    checkBackend();
  }, []);

  // Fetch stations
  const fetchStations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getScrapedStations();
      setStations(data || []);
      setLastFetch(new Date());
    } catch (err) {
      console.error('Error fetching stations:', err);
      setError(err.message || 'Failed to fetch stations');
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique cities for filter
  const cities = [...new Set(stations.map(s => s.city).filter(Boolean))].sort();

  // Apply filters and sorting
  useEffect(() => {
    let result = [...stations];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        (s.location && s.location.toLowerCase().includes(query)) ||
        (s.city && s.city.toLowerCase().includes(query))
      );
    }

    // City filter
    if (cityFilter !== 'all') {
      result = result.filter(s => s.city === cityFilter);
    }

    // AQI filter
    if (aqiFilter !== 'all') {
      result = result.filter(s => {
        const aqi = s.aqi || 0;
        switch (aqiFilter) {
          case 'good': return aqi <= 50;
          case 'moderate': return aqi > 50 && aqi <= 100;
          case 'unhealthy-sensitive': return aqi > 100 && aqi <= 150;
          case 'unhealthy': return aqi > 150;
          default: return true;
        }
      });
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'aqi-asc': return (a.aqi || 0) - (b.aqi || 0);
        case 'aqi-desc': return (b.aqi || 0) - (a.aqi || 0);
        case 'name-asc': return (a.location || '').localeCompare(b.location || '');
        case 'name-desc': return (b.location || '').localeCompare(a.location || '');
        case 'city-asc': return (a.city || '').localeCompare(b.city || '');
        default: return 0;
      }
    });

    setFilteredStations(result);
  }, [stations, searchQuery, cityFilter, aqiFilter, sortBy]);

  return (
    <div className="page stations-page">
      <div className="page-header">
        <h1>📍 Monitoring Stations</h1>
        <p className="page-subtitle">
          AQI data from official air quality monitoring stations
        </p>
      </div>

      {/* Backend Status */}
      {backendOnline === false && (
        <div className="warning-banner">
          ⚠️ Backend offline. Cannot fetch station data.
        </div>
      )}

      {/* Controls Bar */}
      <div className="stations-controls">
        <div className="controls-left">
          <button
            className="btn btn-primary"
            onClick={fetchStations}
            disabled={isLoading || !backendOnline}
          >
            {isLoading ? (
              <>
                <span className="spinner-sm"></span>
                Loading...
              </>
            ) : (
              <>🔄 Fetch Stations</>
            )}
          </button>

          {lastFetch && (
            <span className="last-fetch">
              Updated: {lastFetch.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="controls-right">
          <span className="station-count">
            {filteredStations.length} of {stations.length} stations
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Station name or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>City</label>
          <select 
            value={cityFilter} 
            onChange={(e) => setCityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Cities</option>
            {cities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>AQI Level</label>
          <select 
            value={aqiFilter} 
            onChange={(e) => setAqiFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Levels</option>
            <option value="good">Good (0-50)</option>
            <option value="moderate">Moderate (51-100)</option>
            <option value="unhealthy-sensitive">Unhealthy - Sensitive (101-150)</option>
            <option value="unhealthy">Unhealthy (150+)</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sort By</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="aqi-asc">AQI (Low to High)</option>
            <option value="aqi-desc">AQI (High to Low)</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="city-asc">City (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Stations Grid */}
      <div className="stations-grid">
        {filteredStations.length === 0 ? (
          <div className="empty-state">
            {stations.length === 0 ? (
              <>
                <span className="empty-icon">📡</span>
                <h3>No Stations Loaded</h3>
                <p>Click "Fetch Stations" to load monitoring station data</p>
              </>
            ) : (
              <>
                <span className="empty-icon">🔍</span>
                <h3>No Matching Stations</h3>
                <p>Try adjusting your filters</p>
              </>
            )}
          </div>
        ) : (
          filteredStations.map((station, idx) => {
            const aqi = station.aqi || 0;
            const color = getAQIColor(aqi);
            return (
              <div key={station.h3_index || idx} className="station-card">
                <div 
                  className="station-aqi-badge"
                  style={{ backgroundColor: color }}
                >
                  {Math.round(aqi)}
                </div>
                <div className="station-info">
                  <h4 className="station-name">{station.location || 'Unknown Station'}</h4>
                  <p className="station-city">{station.city || station.state || 'Unknown City'}</p>
                  <p className="station-aqi-label" style={{ color }}>
                    {getAQILabel(aqi)}
                  </p>
                  <div className="station-coords">
                    📍 {station.latitude?.toFixed(4)}, {station.longitude?.toFixed(4)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default StationsPage;
