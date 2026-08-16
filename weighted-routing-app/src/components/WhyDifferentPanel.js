import React from 'react';
import PropTypes from 'prop-types';

/**
 * WhyDifferentPanel - Explains why the greenest route differs from fastest
 * Shows avoided high-AQI areas, time vs exposure tradeoff
 */
const WhyDifferentPanel = ({ explanation, isVisible = true }) => {
    if (!isVisible || !explanation) {
        return null;
    }

    const { summary, benefits, delta_vs_fastest, avoided_segments } = explanation;

    const formatTime = (seconds) => {
        if (!seconds) return '0 min';
        const mins = Math.abs(Math.round(seconds / 60));
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hrs}h ${remainMins}m`;
    };

    const formatDistance = (meters) => {
        if (!meters) return '0 m';
        const absMeters = Math.abs(meters);
        if (absMeters < 1000) return `${Math.round(absMeters)} m`;
        return `${(absMeters / 1000).toFixed(1)} km`;
    };

    return (
        <div className="why-different-panel">
            <div className="panel-header">
                <span className="header-icon">💡</span>
                <span className="header-text">Why this route?</span>
            </div>

            {/* Summary */}
            {summary && (
                <div className="summary-section">
                    <p className="summary-text">{summary}</p>
                </div>
            )}

            {/* Benefits List */}
            {benefits && benefits.length > 0 && (
                <div className="benefits-section">
                    <ul className="benefits-list">
                        {benefits.map((benefit, index) => (
                            <li key={index} className="benefit-item">
                                <span className="benefit-icon">✓</span>
                                <span className="benefit-text">{benefit}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Delta Stats */}
            {delta_vs_fastest && Object.keys(delta_vs_fastest).length > 0 && (
                <div className="delta-section">
                    <div className="delta-grid">
                        {delta_vs_fastest.time_added_s !== undefined && (
                            <div className="delta-item">
                                <span className="delta-label">Time added</span>
                                <span className={`delta-value ${delta_vs_fastest.time_added_s > 0 ? 'negative' : 'positive'}`}>
                                    {delta_vs_fastest.time_added_s > 0 ? '+' : ''}{formatTime(delta_vs_fastest.time_added_s)}
                                </span>
                            </div>
                        )}
                        {delta_vs_fastest.exposure_reduced_pct !== undefined && (
                            <div className="delta-item">
                                <span className="delta-label">Exposure reduced</span>
                                <span className="delta-value positive">
                                    -{delta_vs_fastest.exposure_reduced_pct}%
                                </span>
                            </div>
                        )}
                        {delta_vs_fastest.distance_added_m !== undefined && delta_vs_fastest.distance_added_m !== 0 && (
                            <div className="delta-item">
                                <span className="delta-label">Distance added</span>
                                <span className={`delta-value ${delta_vs_fastest.distance_added_m > 0 ? 'neutral' : 'positive'}`}>
                                    {delta_vs_fastest.distance_added_m > 0 ? '+' : ''}{formatDistance(delta_vs_fastest.distance_added_m)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Avoided Segments */}
            {avoided_segments && avoided_segments.length > 0 && (
                <div className="avoided-section">
                    <div className="avoided-header">High-AQI Areas Avoided:</div>
                    <ul className="avoided-list">
                        {avoided_segments.slice(0, 3).map((segment, index) => (
                            <li key={index} className="avoided-item">
                                <span className="avoided-location">{segment.location || 'Segment ' + (index + 1)}</span>
                                <span className={`avoided-aqi aqi-${segment.category?.toLowerCase()?.replace(' ', '-') || 'unhealthy'}`}>
                                    AQI {Math.round(segment.aqi)} ({segment.category})
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <style jsx>{`
        .why-different-panel {
          background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 12px;
        }
        
        .panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        
        .header-icon {
          font-size: 18px;
        }
        
        .header-text {
          font-weight: 600;
          color: #166534;
          font-size: 14px;
        }
        
        .summary-section {
          margin-bottom: 10px;
        }
        
        .summary-text {
          margin: 0;
          font-size: 13px;
          color: #374151;
          line-height: 1.5;
        }
        
        .benefits-section {
          margin-bottom: 10px;
        }
        
        .benefits-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .benefit-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 6px;
        }
        
        .benefit-icon {
          color: #16a34a;
          font-weight: bold;
          flex-shrink: 0;
        }
        
        .benefit-text {
          font-size: 12px;
          color: #4b5563;
        }
        
        .delta-section {
          background: white;
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 10px;
        }
        
        .delta-grid {
          display: flex;
          justify-content: space-around;
          gap: 12px;
        }
        
        .delta-item {
          text-align: center;
        }
        
        .delta-label {
          display: block;
          font-size: 10px;
          color: #6b7280;
          margin-bottom: 2px;
        }
        
        .delta-value {
          font-size: 14px;
          font-weight: 600;
        }
        
        .delta-value.positive {
          color: #16a34a;
        }
        
        .delta-value.negative {
          color: #dc2626;
        }
        
        .delta-value.neutral {
          color: #6b7280;
        }
        
        .avoided-section {
          border-top: 1px solid #d1fae5;
          padding-top: 10px;
        }
        
        .avoided-header {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
        }
        
        .avoided-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .avoided-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          padding: 4px 0;
        }
        
        .avoided-location {
          color: #4b5563;
        }
        
        .avoided-aqi {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
        }
        
        .avoided-aqi.aqi-unhealthy {
          background: #fef2f2;
          color: #dc2626;
        }
        
        .avoided-aqi.aqi-very-unhealthy {
          background: #fef2f2;
          color: #7c2d12;
        }
        
        .avoided-aqi.aqi-hazardous {
          background: #faf5ff;
          color: #4a044e;
        }
      `}</style>
        </div>
    );
};

WhyDifferentPanel.propTypes = {
    explanation: PropTypes.shape({
        summary: PropTypes.string,
        benefits: PropTypes.arrayOf(PropTypes.string),
        delta_vs_fastest: PropTypes.shape({
            time_added_s: PropTypes.number,
            exposure_reduced_pct: PropTypes.number,
            distance_added_m: PropTypes.number,
        }),
        avoided_segments: PropTypes.arrayOf(PropTypes.shape({
            location: PropTypes.string,
            aqi: PropTypes.number,
            category: PropTypes.string,
        })),
    }),
    isVisible: PropTypes.bool,
};

export default WhyDifferentPanel;
