import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet';
import { checkBackendHealth, getServiceStats, getScrapedStations } from '../services/backendService';
import { aqiZones, getAQIInfo } from '../data/aqiData';

/**
 * HomePage - Dashboard showing system status, quick actions, and mini map
 */
const HomePage = () => {
  const [healthStatus, setHealthStatus] = useState({
    routing: { healthy: false, error: null },
    ingestion: { healthy: false, error: null },
    scraper: { healthy: false, error: null },
  });
  const [stats, setStats] = useState(null);
  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const health = await checkBackendHealth();
      setHealthStatus(health);
      setLastChecked(new Date());

      // Fetch stats if routing is healthy
      if (health.routing.healthy) {
        try {
          const serviceStats = await getServiceStats();
          setStats(serviceStats);
        } catch (e) {
          console.warn('Could not fetch stats:', e);
        }
      }

      // Fetch stations if scraper is healthy
      if (health.scraper.healthy) {
        try {
          const stationData = await getScrapedStations();
          setStations(stationData.slice(0, 10)); // Top 10 stations
        } catch (e) {
          console.warn('Could not fetch stations:', e);
        }
      }
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Refresh every 60 seconds
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const allOnline = healthStatus.routing.healthy && 
                    healthStatus.ingestion.healthy && 
                    healthStatus.scraper.healthy;

  return (
    <div className="page home-page">
      <div className="page-header">
        <h1>🌿 Green Corridor Dashboard</h1>
        <p className="page-subtitle">
          Real-time pollution-aware routing for cleaner commutes in Mumbai
        </p>
      </div>

      <div className="page-content">
        {/* System Status */}
        <div className="section-header">
          <h2>System Status</h2>
          <button 
            className={`btn btn-secondary btn-sm ${isLoading ? 'loading' : ''}`}
            onClick={checkHealth}
            disabled={isLoading}
          >
            {isLoading ? '⟳ Checking...' : '⟳ Refresh'}
          </button>
        </div>

        {lastChecked && (
          <p className="last-checked">
            Last checked: {lastChecked.toLocaleTimeString()}
          </p>
        )}

        <div className="services-grid">
          <div className={`service-card ${healthStatus.routing.healthy ? 'online' : 'offline'}`}>
            <div className="service-icon">🧭</div>
            <div className="service-info">
              <h3>Routing Service</h3>
              <p className="service-description">
                AQI-weighted pathfinding & navigation
              </p>
              <div className="service-status">
                <span className={`status-badge ${healthStatus.routing.healthy ? 'online' : 'offline'}`}>
                  {healthStatus.routing.healthy ? '● Online' : '○ Offline'}
                </span>
                {healthStatus.routing.error && (
                  <span className="error-text">{healthStatus.routing.error}</span>
                )}
              </div>
            </div>
          </div>

          <div className={`service-card ${healthStatus.ingestion.healthy ? 'online' : 'offline'}`}>
            <div className="service-icon">📡</div>
            <div className="service-info">
              <h3>Ingestion Service</h3>
              <p className="service-description">
                Vehicle telemetry data processing
              </p>
              <div className="service-status">
                <span className={`status-badge ${healthStatus.ingestion.healthy ? 'online' : 'offline'}`}>
                  {healthStatus.ingestion.healthy ? '● Online' : '○ Offline'}
                </span>
                {healthStatus.ingestion.error && (
                  <span className="error-text">{healthStatus.ingestion.error}</span>
                )}
              </div>
            </div>
          </div>

          <div className={`service-card ${healthStatus.scraper.healthy ? 'online' : 'offline'}`}>
            <div className="service-icon">🌡️</div>
            <div className="service-info">
              <h3>AQI Scraper</h3>
              <p className="service-description">
                Real-time air quality monitoring data
              </p>
              <div className="service-status">
                <span className={`status-badge ${healthStatus.scraper.healthy ? 'online' : 'offline'}`}>
                  {healthStatus.scraper.healthy ? '● Online' : '○ Offline'}
                </span>
                {healthStatus.scraper.error && (
                  <span className="error-text">{healthStatus.scraper.error}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 style={{ marginBottom: '16px', marginTop: '32px' }}>Quick Actions</h2>
        <div className="quick-actions-grid">
          <Link 
            to="/route" 
            className={`quick-action ${!healthStatus.routing.healthy ? 'disabled' : ''}`}
          >
            <span className="action-icon">🗺️</span>
            <div className="action-content">
              <h4>Plan a Route</h4>
              <p>Find the cleanest path to your destination</p>
            </div>
            <span className="action-arrow">→</span>
          </Link>

          <Link to="/aqi-map" className="quick-action">
            <span className="action-icon">🌡️</span>
            <div className="action-content">
              <h4>View AQI Map</h4>
              <p>Explore air quality heatmap across Mumbai</p>
            </div>
            <span className="action-arrow">→</span>
          </Link>

          <Link 
            to="/stations" 
            className={`quick-action ${!healthStatus.scraper.healthy ? 'disabled' : ''}`}
          >
            <span className="action-icon">📊</span>
            <div className="action-content">
              <h4>Monitoring Stations</h4>
              <p>View all air quality monitoring stations</p>
            </div>
            <span className="action-arrow">→</span>
          </Link>
        </div>

        {/* Mini Map & Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
          {/* Mini Map Preview */}
          <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151' }}>Mumbai AQI Overview</h3>
            </div>
            <div style={{ height: '300px' }}>
              <MapContainer
                center={[19.0760, 72.8777]}
                zoom={11}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                dragging={false}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {aqiZones.map((zone) => {
                  const aqiInfo = getAQIInfo(zone.aqi);
                  return (
                    <Circle
                      key={zone.id}
                      center={[zone.lat, zone.lng]}
                      radius={zone.radius * 111000}
                      pathOptions={{
                        color: aqiInfo.color,
                        fillColor: aqiInfo.color,
                        fillOpacity: 0.25,
                        weight: 1,
                      }}
                    >
                      <Popup>
                        <strong>{zone.name}</strong><br />
                        AQI: {Math.round(zone.aqi)} ({aqiInfo.category})
                      </Popup>
                    </Circle>
                  );
                })}
              </MapContainer>
            </div>
            <div style={{ padding: '12px 16px', background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
              <Link to="/aqi-map" style={{ color: '#1a73e8', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}>
                Open Full Map →
              </Link>
            </div>
          </div>

          {/* Stats & Info */}
          <div>
            <div className="stats-row" style={{ marginBottom: '16px' }}>
              <div className="stat-card">
                <div className="stat-value">{allOnline ? '3/3' : `${[healthStatus.routing.healthy, healthStatus.ingestion.healthy, healthStatus.scraper.healthy].filter(Boolean).length}/3`}</div>
                <div className="stat-label">Services Online</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stations.length || aqiZones.length}</div>
                <div className="stat-label">Monitoring Zones</div>
              </div>
            </div>

            {/* AQI Scale Reference */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>Air Quality Index Scale</h3>
              <div className="aqi-scale">
                <div className="aqi-scale-item">
                  <div className="aqi-color-box" style={{ background: '#22c55e' }}></div>
                  <span className="aqi-range">0-50</span>
                  <span className="aqi-category">Good</span>
                </div>
                <div className="aqi-scale-item">
                  <div className="aqi-color-box" style={{ background: '#84cc16' }}></div>
                  <span className="aqi-range">51-100</span>
                  <span className="aqi-category">Moderate</span>
                </div>
                <div className="aqi-scale-item">
                  <div className="aqi-color-box" style={{ background: '#f59e0b' }}></div>
                  <span className="aqi-range">101-150</span>
                  <span className="aqi-category">Sensitive Groups</span>
                </div>
                <div className="aqi-scale-item">
                  <div className="aqi-color-box" style={{ background: '#ef4444' }}></div>
                  <span className="aqi-range">151-200</span>
                  <span className="aqi-category">Unhealthy</span>
                </div>
                <div className="aqi-scale-item">
                  <div className="aqi-color-box" style={{ background: '#991b1b' }}></div>
                  <span className="aqi-range">201-300</span>
                  <span className="aqi-category">Very Unhealthy</span>
                </div>
                <div className="aqi-scale-item">
                  <div className="aqi-color-box" style={{ background: '#4a044e' }}></div>
                  <span className="aqi-range">300+</span>
                  <span className="aqi-category">Hazardous</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div style={{ marginTop: '32px', background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '20px' }}>How Green Corridor Works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📍</div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>1. Set Locations</h4>
              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Choose your start and destination points on the map</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚖️</div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>2. Set Preference</h4>
              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Balance between fastest route and cleanest air</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🧭</div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>3. Get Routes</h4>
              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Our AI calculates AQI-optimized routes</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🌿</div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>4. Navigate</h4>
              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Follow turn-by-turn directions for cleaner travel</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
