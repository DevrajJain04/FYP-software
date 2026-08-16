import React from 'react';

const DirectionsPanel = ({ 
  steps, 
  totalDistance, 
  totalDuration, 
  averageAQI,
  routeColor,
  onStepHover,
  onStepClick 
}) => {
  if (!steps || steps.length === 0) {
    return null;
  }

  /**
   * Filter out intermediate "destination" steps
   * Due to backend making multiple ORS requests for route segments,
   * we get multiple "arrive at destination" instructions.
   * Keep only the final one (last occurrence).
   */
  const isDestinationStep = (step) => {
    const instrLower = step.instruction?.toLowerCase() || '';
    const type = step.type;
    return type === 10 || 
           instrLower.includes('arrive') || 
           instrLower.includes('destination') ||
           instrLower.includes('reached') ||
           instrLower.includes('you have arrived');
  };

  const filteredSteps = (() => {
    // Find all destination step indices
    const destinationIndices = steps
      .map((step, idx) => isDestinationStep(step) ? idx : -1)
      .filter(idx => idx !== -1);
    
    // If 0 or 1 destination steps, no filtering needed
    if (destinationIndices.length <= 1) {
      return steps;
    }
    
    // Keep all steps EXCEPT intermediate destinations (keep the last one)
    const intermediateDestinations = destinationIndices.slice(0, -1);
    return steps.filter((_, idx) => !intermediateDestinations.includes(idx));
  })();

  // Format distance
  const formatDistance = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  // Format duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const getAQIColor = (aqi) => {
    if (aqi <= 50) return '#22c55e';
    if (aqi <= 100) return '#84cc16';
    if (aqi <= 150) return '#f59e0b';
    return '#ef4444';
  };

  const getAQILabel = (aqi) => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive';
    return 'Unhealthy';
  };

  // Get direction icon based on instruction type
  const getDirectionIcon = (instruction, type) => {
    const instrLower = instruction?.toLowerCase() || '';
    
    if (type === 0 || instrLower.includes('head') || instrLower.includes('start')) return '🚩';
    if (type === 10 || instrLower.includes('arrive') || instrLower.includes('destination')) return '🏁';
    if (instrLower.includes('turn left')) return '↰';
    if (instrLower.includes('turn right')) return '↱';
    if (instrLower.includes('slight left') || instrLower.includes('bear left')) return '↖';
    if (instrLower.includes('slight right') || instrLower.includes('bear right')) return '↗';
    if (instrLower.includes('u-turn')) return '↩';
    if (instrLower.includes('roundabout') || instrLower.includes('rotary')) return '🔄';
    if (instrLower.includes('continue') || instrLower.includes('straight')) return '↑';
    if (instrLower.includes('merge')) return '⤴';
    if (instrLower.includes('ramp') || instrLower.includes('exit')) return '↗';
    if (instrLower.includes('ferry')) return '⛴';
    return '→';
  };

  return (
    <div className="directions-panel">
      {/* Summary Header */}
      <div className="directions-summary">
        <div className="summary-item">
          <span className="summary-icon">🚗</span>
          <div className="summary-content">
            <span className="summary-value">{formatDistance(totalDistance)}</span>
            <span className="summary-label">Distance</span>
          </div>
        </div>
        <div className="summary-item">
          <span className="summary-icon">⏱️</span>
          <div className="summary-content">
            <span className="summary-value">{formatDuration(totalDuration)}</span>
            <span className="summary-label">Duration</span>
          </div>
        </div>
        <div className="summary-item">
          <span className="summary-icon">🌿</span>
          <div className="summary-content">
            <span className="summary-value" style={{ color: getAQIColor(averageAQI) }}>
              {Math.round(averageAQI)}
            </span>
            <span className="summary-label">{getAQILabel(averageAQI)}</span>
          </div>
        </div>
      </div>

      {/* Route indicator */}
      <div className="route-indicator" style={{ backgroundColor: routeColor }}>
        <span>Selected Route</span>
      </div>

      {/* Turn-by-turn Directions */}
      <div className="directions-list">
        {filteredSteps.map((step, index) => (
          <div
            key={index}
            className="direction-step"
            onMouseEnter={() => onStepHover && onStepHover(step)}
            onMouseLeave={() => onStepHover && onStepHover(null)}
            onClick={() => onStepClick && onStepClick(step)}
          >
            <div className="step-number">{index + 1}</div>
            <div className="step-icon">
              <span>{getDirectionIcon(step.instruction, step.type)}</span>
            </div>
            <div className="step-content">
              <div className="step-instruction">{step.instruction}</div>
              {step.distance > 0 && (
                <div className="step-details">
                  <span className="step-distance">{formatDistance(step.distance)}</span>
                  {step.duration > 0 && (
                    <>
                      <span className="step-separator">•</span>
                      <span className="step-time">{formatDuration(step.duration)}</span>
                    </>
                  )}
                  {step.name && (
                    <>
                      <span className="step-separator">•</span>
                      <span className="step-street">{step.name}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer with AQI details */}
      <div className="directions-footer">
        <div className="aqi-breakdown">
          <div className="aqi-bar">
            <div 
              className="aqi-fill"
              style={{ 
                width: `${Math.min(100, (averageAQI / 200) * 100)}%`,
                backgroundColor: getAQIColor(averageAQI)
              }}
            />
          </div>
          <div className="aqi-info">
            Average Air Quality: {Math.round(averageAQI)} ({getAQILabel(averageAQI)})
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectionsPanel;
