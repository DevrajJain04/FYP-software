import React from 'react';

const AQIStatus = ({ lastUpdate, isLive }) => {
  const getTimeAgo = () => {
    if (!lastUpdate) return 'Never';
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className="aqi-status">
      <div className={`status-indicator ${isLive ? 'live' : 'offline'}`}>
        <span className="status-dot" />
        <span className="status-text">{isLive ? 'Live AQI Data' : 'Offline'}</span>
      </div>
      <div className="last-update">
        Updated: {getTimeAgo()}
      </div>
    </div>
  );
};

export default AQIStatus;
