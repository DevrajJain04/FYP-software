import React from 'react';

/**
 * WeightSliders Component
 * 
 * Provides UI for adjusting route preferences.
 * Supports two modes:
 * 1. Legacy mode (weights): Three separate sliders for distance, time, AQI
 * 2. Backend mode (balance): Single slider from Fastest (0) to Cleanest Air (1)
 * 
 * Props:
 * - weights: { w1, w2, w3 } - Legacy weight values
 * - onWeightChange: (weights) => void - Legacy weight change handler
 * - balance: number (0-1) - Backend balance value (optional)
 * - onBalanceChange: (balance) => void - Backend balance change handler (optional)
 * - useBackendMode: boolean - Show backend balance slider (default: true if balance prop provided)
 */
const WeightSliders = ({ 
  weights, 
  onWeightChange, 
  balance, 
  onBalanceChange,
  useBackendMode = balance !== undefined 
}) => {
  const handleSliderChange = (weightKey, value) => {
    onWeightChange({
      ...weights,
      [weightKey]: parseFloat(value),
    });
  };

  // Calculate normalized percentages for visualization
  const total = weights.w1 + weights.w2 + weights.w3;
  const pct = {
    w1: total > 0 ? Math.round((weights.w1 / total) * 100) : 33,
    w2: total > 0 ? Math.round((weights.w2 / total) * 100) : 33,
    w3: total > 0 ? Math.round((weights.w3 / total) * 100) : 34,
  };

  // Get balance label text
  const getBalanceLabel = (val) => {
    if (val <= 0.2) return 'Fastest Route';
    if (val <= 0.4) return 'Mostly Time';
    if (val <= 0.6) return 'Balanced';
    if (val <= 0.8) return 'Mostly Air Quality';
    return 'Cleanest Air';
  };

  return (
    <div className="section">
      <h3 className="section-title">⚖️ Route Preferences</h3>
      
      {/* Backend Balance Slider (Primary when backend is available) */}
      {useBackendMode && onBalanceChange && (
        <div className="backend-balance-section" style={{ marginBottom: '20px' }}>
          <div className="slider-group">
            <div className="slider-label">
              <span>🎯 Route Priority</span>
              <span 
                className="slider-value" 
                style={{ 
                  background: balance <= 0.3 ? '#fef3c7' : balance >= 0.7 ? '#dcfce7' : '#e0e7ff',
                  color: balance <= 0.3 ? '#b45309' : balance >= 0.7 ? '#15803d' : '#4338ca'
                }}
              >
                {getBalanceLabel(balance)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: '#666' }}>⏱️ Fast</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={balance}
                onChange={(e) => onBalanceChange(parseFloat(e.target.value))}
                className="slider balance"
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '0.75rem', color: '#666' }}>🌿 Clean</span>
            </div>
          </div>
          
          {/* Balance quick presets */}
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
            <button
              onClick={() => onBalanceChange(0)}
              style={{
                flex: 1,
                padding: '6px',
                border: '1px solid #f59e0b',
                background: balance === 0 ? '#f59e0b' : 'white',
                color: balance === 0 ? 'white' : '#f59e0b',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 500
              }}
            >
              Fastest
            </button>
            <button
              onClick={() => onBalanceChange(0.5)}
              style={{
                flex: 1,
                padding: '6px',
                border: '1px solid #6366f1',
                background: balance === 0.5 ? '#6366f1' : 'white',
                color: balance === 0.5 ? 'white' : '#6366f1',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 500
              }}
            >
              Balanced
            </button>
            <button
              onClick={() => onBalanceChange(1)}
              style={{
                flex: 1,
                padding: '6px',
                border: '1px solid #22c55e',
                background: balance === 1 ? '#22c55e' : 'white',
                color: balance === 1 ? 'white' : '#22c55e',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 500
              }}
            >
              Greenest
            </button>
          </div>
          
          <div style={{ 
            marginTop: '12px', 
            padding: '8px', 
            background: '#f0fdf4', 
            borderRadius: '6px',
            fontSize: '0.75rem',
            color: '#166534'
          }}>
            💡 This slider controls the AQI-aware routing algorithm when connected to the backend.
          </div>
        </div>
      )}
      
      {/* Legacy Weight Sliders (for ORS fallback or fine-tuning) */}
      <details style={{ marginTop: useBackendMode ? '10px' : '0' }}>
        <summary style={{ 
          cursor: 'pointer', 
          fontSize: '0.85rem', 
          color: '#666',
          marginBottom: '10px'
        }}>
          {useBackendMode ? '⚙️ Advanced Weight Settings (ORS fallback)' : ''}
        </summary>
        
        {/* Weight visualization bar */}
        <div style={{ 
          display: 'flex', 
          height: '8px', 
          borderRadius: '4px', 
          overflow: 'hidden',
          marginBottom: '16px'
        }}>
          <div style={{ width: `${pct.w1}%`, background: '#3b82f6' }} title={`Distance: ${pct.w1}%`} />
          <div style={{ width: `${pct.w2}%`, background: '#f59e0b' }} title={`Time: ${pct.w2}%`} />
          <div style={{ width: `${pct.w3}%`, background: '#22c55e' }} title={`Air Quality: ${pct.w3}%`} />
        </div>
        
        {/* Distance Weight (w1) */}
        <div className="slider-group">
          <div className="slider-label">
            <span>📏 Shortest Distance</span>
            <span className="slider-value" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              {weights.w1.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.w1}
            onChange={(e) => handleSliderChange('w1', e.target.value)}
            className="slider distance"
          />
        </div>

        {/* Travel Time Weight (w2) */}
        <div className="slider-group">
          <div className="slider-label">
            <span>⏱️ Fastest Time</span>
            <span className="slider-value" style={{ background: '#fef3c7', color: '#b45309' }}>
              {weights.w2.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.w2}
            onChange={(e) => handleSliderChange('w2', e.target.value)}
            className="slider time"
          />
        </div>

        {/* AQI Weight (w3) */}
        <div className="slider-group">
          <div className="slider-label">
            <span>🌿 Best Air Quality</span>
            <span className="slider-value" style={{ background: '#dcfce7', color: '#15803d' }}>
              {weights.w3.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.w3}
            onChange={(e) => handleSliderChange('w3', e.target.value)}
            className="slider aqi"
          />
        </div>
        
        {/* Quick presets */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onWeightChange({ w1: 1, w2: 0, w3: 0 })}
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #3b82f6',
              background: weights.w1 === 1 ? '#3b82f6' : 'white',
              color: weights.w1 === 1 ? 'white' : '#3b82f6',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500
            }}
          >
            Shortest
          </button>
          <button
            onClick={() => onWeightChange({ w1: 0, w2: 1, w3: 0 })}
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #f59e0b',
              background: weights.w2 === 1 ? '#f59e0b' : 'white',
              color: weights.w2 === 1 ? 'white' : '#f59e0b',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500
            }}
          >
            Fastest
          </button>
          <button
            onClick={() => onWeightChange({ w1: 0, w2: 0, w3: 1 })}
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #22c55e',
              background: weights.w3 === 1 ? '#22c55e' : 'white',
              color: weights.w3 === 1 ? 'white' : '#22c55e',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500
            }}
          >
            Greenest
          </button>
        </div>
      </details>
    </div>
  );
};

export default WeightSliders;
