import React from 'react';
import { formatDistance, formatTime } from '../utils/formatters';

const RouteAlternatives = ({ routes, selectedRoute, onRouteSelect }) => {
  if (!routes) return null;

  const routeOrder = ['custom', 'shortest', 'fastest', 'cleanest'];
  const routeIcons = {
    custom: '⚖️',
    shortest: '📏',
    fastest: '⚡',
    cleanest: '🌿'
  };

  const getAQIColor = (aqi) => {
    if (aqi < 50) return '#22c55e';
    if (aqi < 100) return '#84cc16';
    if (aqi < 150) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="route-alternatives">
      <h4 className="alternatives-title">Route Options</h4>
      <div className="alternatives-list">
        {routeOrder.map((key) => {
          const route = routes[key];
          if (!route || !route.found) return null;
          
          const isSelected = selectedRoute === key;
          
          return (
            <div
              key={key}
              className={`route-option ${isSelected ? 'selected' : ''}`}
              onClick={() => onRouteSelect(key)}
              style={{ borderLeftColor: route.color }}
            >
              <div className="route-header">
                <span className="route-icon">{routeIcons[key]}</span>
                <span className="route-label">{route.label}</span>
                {isSelected && <span className="selected-badge">✓</span>}
              </div>
              <div className="route-stats">
                <div className="stat">
                  <span className="stat-value">{formatDistance(route.totalDistance)}</span>
                  <span className="stat-label">Distance</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{formatTime(route.totalTime)}</span>
                  <span className="stat-label">Time</span>
                </div>
                <div className="stat">
                  <span className="stat-value" style={{ color: getAQIColor(route.averageAQI) }}>
                    {route.averageAQI}
                  </span>
                  <span className="stat-label">AQI</span>
                </div>
              </div>
              <div 
                className="route-color-bar" 
                style={{ backgroundColor: route.color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RouteAlternatives;
