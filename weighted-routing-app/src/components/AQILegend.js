import React from 'react';
import PropTypes from 'prop-types';

/**
 * AQILegend - Map legend showing AQI color scale with categories
 */
const AQILegend = ({ position = 'bottom-left', compact = false }) => {
    const categories = [
        { range: '0-50', label: 'Good', color: '#22c55e', textColor: '#fff' },
        { range: '51-100', label: 'Moderate', color: '#84cc16', textColor: '#000' },
        { range: '101-150', label: 'USG', color: '#f59e0b', textColor: '#000' },
        { range: '151-200', label: 'Unhealthy', color: '#ef4444', textColor: '#fff' },
        { range: '201-300', label: 'Very Unhealthy', color: '#7c2d12', textColor: '#fff' },
        { range: '301+', label: 'Hazardous', color: '#4a044e', textColor: '#fff' },
    ];

    const positionStyles = {
        'bottom-left': { bottom: '20px', left: '10px' },
        'bottom-right': { bottom: '20px', right: '10px' },
        'top-left': { top: '80px', left: '10px' },
        'top-right': { top: '80px', right: '10px' },
    };

    return (
        <div
            className={`aqi-legend ${compact ? 'compact' : ''}`}
            style={positionStyles[position]}
        >
            <div className="legend-title">Air Quality Index</div>
            <div className="legend-items">
                {categories.map((cat) => (
                    <div key={cat.label} className="legend-item">
                        <div
                            className="color-box"
                            style={{ backgroundColor: cat.color }}
                            aria-label={`AQI ${cat.range}: ${cat.label}`}
                        >
                            {!compact && <span style={{ color: cat.textColor }}>{cat.range}</span>}
                        </div>
                        <span className="category-label">{cat.label}</span>
                    </div>
                ))}
            </div>

            <style jsx>{`
        .aqi-legend {
          position: absolute;
          z-index: 1000;
          background: white;
          border-radius: 8px;
          padding: 10px 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          font-size: 12px;
        }
        
        .aqi-legend.compact {
          padding: 8px 10px;
        }
        
        .legend-title {
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .legend-items {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .color-box {
          width: ${compact ? '16px' : '48px'};
          height: 16px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 500;
        }
        
        .category-label {
          color: #4b5563;
          font-size: 11px;
        }
        
        .aqi-legend.compact .legend-items {
          flex-direction: row;
          flex-wrap: wrap;
          gap: 6px;
        }
        
        .aqi-legend.compact .legend-item {
          flex-direction: column;
          gap: 2px;
        }
        
        .aqi-legend.compact .category-label {
          font-size: 9px;
        }
      `}</style>
        </div>
    );
};

AQILegend.propTypes = {
    position: PropTypes.oneOf(['bottom-left', 'bottom-right', 'top-left', 'top-right']),
    compact: PropTypes.bool,
};

export default AQILegend;
