/**
 * @deprecated LEGACY COMPONENT - This component is no longer used.
 * 
 * The app now uses LocationSearch.js for dynamic location input with geocoding.
 * This file used static node presets from graphData.js which is also deprecated.
 * 
 * For location input, see: components/LocationSearch.js
 * 
 * Consider removing this file if no longer needed.
 */

import React from 'react';
import { nodes } from '../data/graphData';

const NodeSelector = ({ 
  startNode, 
  endNode, 
  onStartChange, 
  onEndChange,
  clickMode,
  onClickModeChange,
  onSwapLocations
}) => {
  const nodeOptions = Object.values(nodes);

  return (
    <div className="section location-section">
      <h3 className="section-title">📍 Choose Locations</h3>
      
      {/* Start Location */}
      <div className="location-input-group">
        <div className="location-icon start">A</div>
        <div className="location-input-wrapper">
          <select
            value={startNode}
            onChange={(e) => onStartChange(e.target.value)}
            className="location-select"
          >
            <option value="">Choose starting point...</option>
            {nodeOptions.map((node) => (
              <option key={node.id} value={node.id} disabled={node.id === endNode}>
                {node.name}
              </option>
            ))}
          </select>
          <button 
            className={`pin-button ${clickMode === 'start' ? 'active' : ''}`}
            onClick={() => onClickModeChange(clickMode === 'start' ? null : 'start')}
            title="Click on map to set start point"
          >
            📍
          </button>
        </div>
        {startNode && nodes[startNode] && (
          <div className="location-address">{nodes[startNode].address}</div>
        )}
      </div>

      {/* Swap Button */}
      <div className="swap-container">
        <button 
          className="swap-button"
          onClick={onSwapLocations}
          title="Swap start and end"
        >
          ⇅
        </button>
        <div className="connector-line" />
      </div>

      {/* End Location */}
      <div className="location-input-group">
        <div className="location-icon end">B</div>
        <div className="location-input-wrapper">
          <select
            value={endNode}
            onChange={(e) => onEndChange(e.target.value)}
            className="location-select"
          >
            <option value="">Choose destination...</option>
            {nodeOptions.map((node) => (
              <option key={node.id} value={node.id} disabled={node.id === startNode}>
                {node.name}
              </option>
            ))}
          </select>
          <button 
            className={`pin-button ${clickMode === 'end' ? 'active' : ''}`}
            onClick={() => onClickModeChange(clickMode === 'end' ? null : 'end')}
            title="Click on map to set destination"
          >
            📍
          </button>
        </div>
        {endNode && nodes[endNode] && (
          <div className="location-address">{nodes[endNode].address}</div>
        )}
      </div>

      {clickMode && (
        <div className="click-mode-hint">
          Click on the map to set your {clickMode === 'start' ? 'starting point' : 'destination'}
        </div>
      )}
    </div>
  );
};

export default NodeSelector;
