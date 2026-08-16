import React from 'react';
import PropTypes from 'prop-types';

/**
 * RouteComparisonPanel - Side-by-side comparison of route alternatives
 * Shows Fastest vs Greenest route with key metrics
 */
const RouteComparisonPanel = ({ routes, selectedIndex, onSelectRoute }) => {
    if (!routes || routes.length < 2) {
        return null; // Need at least 2 routes to compare
    }

    // Find the fastest and greenest routes
    const fastestRoute = routes.reduce((prev, curr) =>
        (curr.duration < prev.duration) ? curr : prev
    );
    const greenestRoute = routes.reduce((prev, curr) =>
        (curr.averageAQI < prev.averageAQI) ? curr : prev
    );

    const formatDuration = (seconds) => {
        if (!seconds) return '--';
        const mins = Math.round(seconds / 60);
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hrs}h ${remainMins}m`;
    };

    const formatDistance = (meters) => {
        if (!meters) return '--';
        if (meters < 1000) return `${Math.round(meters)} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    };

    const formatExposure = (score) => {
        if (!score) return '--';
        return score.toLocaleString();
    };

    const getAQIClass = (aqi) => {
        if (aqi <= 50) return 'aqi-good';
        if (aqi <= 100) return 'aqi-moderate';
        if (aqi <= 150) return 'aqi-usg';
        if (aqi <= 200) return 'aqi-unhealthy';
        if (aqi <= 300) return 'aqi-very-unhealthy';
        return 'aqi-hazardous';
    };

    const getAQICategoryName = (aqi) => {
        if (aqi <= 50) return 'Good';
        if (aqi <= 100) return 'Moderate';
        if (aqi <= 150) return 'USG';
        if (aqi <= 200) return 'Unhealthy';
        if (aqi <= 300) return 'Very Unhealthy';
        return 'Hazardous';
    };

    // Calculate delta
    const timeDiff = greenestRoute.duration - fastestRoute.duration;
    const exposureDiff = fastestRoute.exposureScore - greenestRoute.exposureScore;
    const exposurePct = fastestRoute.exposureScore > 0
        ? ((exposureDiff / fastestRoute.exposureScore) * 100).toFixed(0)
        : 0;

    return (
        <div className="route-comparison-panel">
            <h3 className="comparison-title">Route Comparison</h3>

            <div className="comparison-grid">
                {/* Fastest Route */}
                <div
                    className={`route-card fastest ${selectedIndex === routes.indexOf(fastestRoute) ? 'selected' : ''}`}
                    onClick={() => onSelectRoute && onSelectRoute(routes.indexOf(fastestRoute))}
                >
                    <div className="route-badge">⚡ Fastest</div>
                    <div className="route-metrics">
                        <div className="metric">
                            <span className="metric-label">Time</span>
                            <span className="metric-value">{formatDuration(fastestRoute.duration)}</span>
                        </div>
                        <div className="metric">
                            <span className="metric-label">Distance</span>
                            <span className="metric-value">{formatDistance(fastestRoute.distance)}</span>
                        </div>
                        <div className="metric">
                            <span className="metric-label">Avg AQI</span>
                            <span className={`metric-value ${getAQIClass(fastestRoute.averageAQI)}`}>
                                {Math.round(fastestRoute.averageAQI || 0)} ({getAQICategoryName(fastestRoute.averageAQI)})
                            </span>
                        </div>
                        {fastestRoute.exposureScore && (
                            <div className="metric">
                                <span className="metric-label">Exposure</span>
                                <span className="metric-value">{formatExposure(fastestRoute.exposureScore)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Greenest Route */}
                <div
                    className={`route-card greenest ${selectedIndex === routes.indexOf(greenestRoute) ? 'selected' : ''}`}
                    onClick={() => onSelectRoute && onSelectRoute(routes.indexOf(greenestRoute))}
                >
                    <div className="route-badge">🌿 Greenest</div>
                    <div className="route-metrics">
                        <div className="metric">
                            <span className="metric-label">Time</span>
                            <span className="metric-value">{formatDuration(greenestRoute.duration)}</span>
                        </div>
                        <div className="metric">
                            <span className="metric-label">Distance</span>
                            <span className="metric-value">{formatDistance(greenestRoute.distance)}</span>
                        </div>
                        <div className="metric">
                            <span className="metric-label">Avg AQI</span>
                            <span className={`metric-value ${getAQIClass(greenestRoute.averageAQI)}`}>
                                {Math.round(greenestRoute.averageAQI || 0)} ({getAQICategoryName(greenestRoute.averageAQI)})
                            </span>
                        </div>
                        {greenestRoute.exposureScore && (
                            <div className="metric">
                                <span className="metric-label">Exposure</span>
                                <span className="metric-value">{formatExposure(greenestRoute.exposureScore)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tradeoff Summary */}
            {fastestRoute !== greenestRoute && (
                <div className="tradeoff-summary">
                    {timeDiff > 0 ? (
                        <span className="tradeoff-text">
                            🌱 Greenest adds <strong>+{formatDuration(timeDiff)}</strong> but reduces exposure by <strong>{exposurePct}%</strong>
                        </span>
                    ) : (
                        <span className="tradeoff-text positive">
                            ✨ Greenest route is also the fastest!
                        </span>
                    )}
                </div>
            )}

            <style jsx>{`
        .route-comparison-panel {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 16px;
        }
        
        .comparison-title {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }
        
        .comparison-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        
        .route-card {
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .route-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
        }
        
        .route-card.selected {
          border-color: #3b82f6;
          background: #eff6ff;
        }
        
        .route-card.fastest .route-badge {
          background: #fef3c7;
          color: #92400e;
        }
        
        .route-card.greenest .route-badge {
          background: #d1fae5;
          color: #065f46;
        }
        
        .route-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        
        .route-metrics {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .metric-label {
          font-size: 12px;
          color: #6b7280;
        }
        
        .metric-value {
          font-size: 13px;
          font-weight: 500;
          color: #1f2937;
        }
        
        .aqi-good { color: #059669; }
        .aqi-moderate { color: #ca8a04; }
        .aqi-usg { color: #ea580c; }
        .aqi-unhealthy { color: #dc2626; }
        .aqi-very-unhealthy { color: #7c2d12; }
        .aqi-hazardous { color: #4a044e; }
        
        .tradeoff-summary {
          margin-top: 12px;
          padding: 10px 12px;
          background: #f9fafb;
          border-radius: 8px;
          text-align: center;
        }
        
        .tradeoff-text {
          font-size: 13px;
          color: #4b5563;
        }
        
        .tradeoff-text.positive {
          color: #059669;
        }
      `}</style>
        </div>
    );
};

RouteComparisonPanel.propTypes = {
    routes: PropTypes.arrayOf(PropTypes.shape({
        duration: PropTypes.number,
        distance: PropTypes.number,
        averageAQI: PropTypes.number,
        maxAQI: PropTypes.number,
        exposureScore: PropTypes.number,
    })),
    selectedIndex: PropTypes.number,
    onSelectRoute: PropTypes.func,
};

export default RouteComparisonPanel;
