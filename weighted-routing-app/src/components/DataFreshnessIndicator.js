import React from 'react';
import PropTypes from 'prop-types';

/**
 * DataFreshnessIndicator - Shows how fresh the AQI data is
 * Displays provider name, last update time, and refresh button
 */
const DataFreshnessIndicator = ({
    aqiMetadata,
    onRefresh,
    isRefreshing = false
}) => {
    if (!aqiMetadata) {
        return null;
    }

    const { aqi_provider, data_age_minutes, aqi_status, segments_with_data, segments_total } = aqiMetadata;

    const getProviderDisplayName = (provider) => {
        const names = {
            'vehicle_telemetry': 'Vehicle Sensors',
            'monitoring_stations': 'Monitoring Stations',
            'default': 'Default Values',
        };
        return names[provider] || provider || 'Unknown';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'live': return '#16a34a';
            case 'cached': return '#ca8a04';
            case 'unavailable': return '#dc2626';
            default: return '#6b7280';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'live': return '🟢';
            case 'cached': return '🟡';
            case 'unavailable': return '🔴';
            default: return '⚪';
        }
    };

    const formatAge = (minutes) => {
        if (minutes === null || minutes === undefined) return 'Unknown';
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${Math.round(minutes)} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const getFreshnessClass = (minutes) => {
        if (minutes === null || minutes === undefined) return 'unknown';
        if (minutes < 5) return 'fresh';
        if (minutes < 15) return 'recent';
        if (minutes < 60) return 'stale';
        return 'very-stale';
    };

    const coverage = segments_total > 0
        ? Math.round((segments_with_data / segments_total) * 100)
        : 0;

    return (
        <div className="freshness-indicator">
            <div className="indicator-row">
                <span className="status-badge" style={{ color: getStatusColor(aqi_status) }}>
                    {getStatusIcon(aqi_status)} {aqi_status?.toUpperCase() || 'UNKNOWN'}
                </span>

                {onRefresh && (
                    <button
                        className="refresh-button"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        aria-label="Refresh AQI data"
                    >
                        {isRefreshing ? '⟳' : '↻'} Refresh
                    </button>
                )}
            </div>

            <div className="details-row">
                <div className="detail-item">
                    <span className="detail-label">Provider</span>
                    <span className="detail-value">{getProviderDisplayName(aqi_provider)}</span>
                </div>

                {data_age_minutes !== null && data_age_minutes !== undefined && (
                    <div className="detail-item">
                        <span className="detail-label">Updated</span>
                        <span className={`detail-value freshness-${getFreshnessClass(data_age_minutes)}`}>
                            {formatAge(data_age_minutes)}
                        </span>
                    </div>
                )}

                {segments_total > 0 && (
                    <div className="detail-item">
                        <span className="detail-label">Coverage</span>
                        <span className="detail-value">{coverage}%</span>
                    </div>
                )}
            </div>

            <style jsx>{`
        .freshness-indicator {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
        }
        
        .indicator-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .status-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
          font-size: 11px;
        }
        
        .refresh-button {
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .refresh-button:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #94a3b8;
        }
        
        .refresh-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .details-row {
          display: flex;
          gap: 16px;
        }
        
        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .detail-label {
          color: #64748b;
          font-size: 10px;
        }
        
        .detail-value {
          color: #1e293b;
          font-weight: 500;
        }
        
        .freshness-fresh { color: #16a34a; }
        .freshness-recent { color: #65a30d; }
        .freshness-stale { color: #ca8a04; }
        .freshness-very-stale { color: #dc2626; }
        .freshness-unknown { color: #6b7280; }
      `}</style>
        </div>
    );
};

DataFreshnessIndicator.propTypes = {
    aqiMetadata: PropTypes.shape({
        aqi_provider: PropTypes.string,
        data_age_minutes: PropTypes.number,
        aqi_status: PropTypes.string,
        segments_with_data: PropTypes.number,
        segments_total: PropTypes.number,
    }),
    onRefresh: PropTypes.func,
    isRefreshing: PropTypes.bool,
};

export default DataFreshnessIndicator;
