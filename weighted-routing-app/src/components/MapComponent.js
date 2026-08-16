import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { aqiZones, getAQIInfo } from '../data/aqiData';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom draggable pin icons (Google Maps style)
const createPinIcon = (color, label) => {
  return L.divIcon({
    className: 'custom-pin',
    html: `
      <div style="position: relative;">
        <svg width="40" height="50" viewBox="0 0 40 50" style="filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.3));">
          <path d="M20 0 C9 0 0 9 0 20 C0 35 20 50 20 50 C20 50 40 35 40 20 C40 9 31 0 20 0 Z" fill="${color}"/>
          <circle cx="20" cy="18" r="8" fill="white"/>
          <text x="20" y="22" text-anchor="middle" fill="${color}" font-size="12" font-weight="bold">${label}</text>
        </svg>
      </div>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50],
  });
};

const startPinIcon = createPinIcon('#22c55e', 'A');
const endPinIcon = createPinIcon('#ef4444', 'B');

// Draggable marker component
const DraggableMarker = ({ position, icon, onDragEnd, popupContent }) => {
  const markerRef = useRef(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          onDragEnd(newPos.lat, newPos.lng);
        }
      },
    }),
    [onDragEnd],
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={icon}
    >
      <Popup>{popupContent}</Popup>
    </Marker>
  );
};

// Map click handler for setting markers
const MapClickHandler = ({ onMapClick, clickMode }) => {
  useMapEvents({
    click: (e) => {
      if (clickMode) {
        onMapClick(e.latlng.lat, e.latlng.lng, clickMode);
      }
    },
  });
  return null;
};

// AQI Zone circles
const AQIZones = ({ showZones, aqiData }) => {
  if (!showZones) return null;
  
  const zones = aqiData?.zones || aqiZones;
  
  return (
    <>
      {zones.map((zone) => {
        const aqiInfo = getAQIInfo(zone.aqi);
        return (
          <Circle
            key={zone.id}
            center={[zone.lat, zone.lng]}
            radius={zone.radius * 111000} // Convert degrees to meters approximately
            pathOptions={{
              color: aqiInfo.color,
              fillColor: aqiInfo.color,
              fillOpacity: 0.15,
              weight: 1,
              opacity: 0.4
            }}
          >
            <Popup>
              <div style={{ textAlign: 'center' }}>
                <strong>{zone.name}</strong>
                <div style={{ 
                  marginTop: '5px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: aqiInfo.bgColor,
                  color: aqiInfo.color,
                  fontWeight: 600
                }}>
                  AQI: {Math.round(zone.aqi)} ({aqiInfo.category})
                </div>
                <small style={{ color: '#666' }}>{zone.type}</small>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
};

// Map bounds handler
const MapBounds = ({ routes, startPosition, endPosition }) => {
  const map = useMap();

  useEffect(() => {
    const bounds = [];
    
    // Add route coordinates to bounds
    if (routes && routes.length > 0) {
      routes.forEach(route => {
        if (route.coordinates) {
          bounds.push(...route.coordinates);
        }
      });
    }
    
    // Add start/end positions
    if (startPosition) bounds.push(startPosition);
    if (endPosition) bounds.push(endPosition);
    
    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    }
  }, [map, routes, startPosition, endPosition]);

  return null;
};

// Route polyline with AQI-based coloring
const RoutePolyline = ({ route, isSelected, isAlternative, onClick }) => {
  if (!route || !route.coordinates || route.coordinates.length < 2) {
    return null;
  }

  // Color based on AQI
  const getRouteColor = () => {
    if (route.color) return route.color;
    const aqi = route.averageAQI || 50;
    if (aqi <= 50) return '#22c55e';
    if (aqi <= 100) return '#84cc16';
    if (aqi <= 150) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <>
      {/* Shadow/outline for better visibility */}
      <Polyline
        positions={route.coordinates}
        pathOptions={{
          color: '#000',
          weight: isSelected ? 8 : 6,
          opacity: 0.2,
          lineCap: 'round',
          lineJoin: 'round'
        }}
      />
      {/* Main route line */}
      <Polyline
        positions={route.coordinates}
        pathOptions={{
          color: getRouteColor(),
          weight: isSelected ? 6 : 4,
          opacity: isAlternative ? 0.5 : 0.9,
          dashArray: isAlternative ? '10, 10' : null,
          lineCap: 'round',
          lineJoin: 'round'
        }}
        eventHandlers={onClick ? { click: onClick } : {}}
      >
        <Popup>
          <div style={{ minWidth: '150px' }}>
            <strong>{route.label || 'Route'}</strong>
            <div style={{ marginTop: '8px', fontSize: '13px' }}>
              <div>📏 {route.distance >= 1000 ? `${(route.distance / 1000).toFixed(1)} km` : `${Math.round(route.distance)} m`}</div>
              <div>⏱️ {route.duration >= 3600 ? `${Math.floor(route.duration / 3600)}h ${Math.floor((route.duration % 3600) / 60)}m` : `${Math.floor(route.duration / 60)} min`}</div>
              <div style={{ color: getRouteColor() }}>
                🌿 AQI: {Math.round(route.averageAQI)}
              </div>
            </div>
          </div>
        </Popup>
      </Polyline>
    </>
  );
};

const MapComponent = ({ 
  startCoords,
  endCoords,
  routes,
  selectedRouteIndex,
  showAQIZones,
  aqiData,
  clickMode,
  onMapClick,
  onRouteSelect,
  isLoading
}) => {

  // Handle draggable marker drag end - calls onMapClick with [lat, lng] array
  const handleStartDragEnd = (lat, lng) => {
    if (onMapClick) {
      // Temporarily set click mode to start, then call onMapClick
      onMapClick([lat, lng], 'start');
    }
  };

  const handleEndDragEnd = (lat, lng) => {
    if (onMapClick) {
      onMapClick([lat, lng], 'end');
    }
  };

  const handleMapClickInternal = (lat, lng, mode) => {
    if (onMapClick) {
      onMapClick([lat, lng], mode);
    }
  };

  return (
    <MapContainer
      center={[19.0760, 72.8777]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapBounds 
        routes={routes} 
        startPosition={startCoords} 
        endPosition={endCoords} 
      />
      <MapClickHandler onMapClick={handleMapClickInternal} clickMode={clickMode} />
      
      {/* AQI Zones overlay */}
      <AQIZones showZones={showAQIZones} aqiData={aqiData} />
      
      {/* Alternative routes (rendered first so they appear behind) */}
      {routes && routes.map((route, index) => {
        if (index === selectedRouteIndex) return null;
        return (
          <RoutePolyline
            key={`route-${index}`}
            route={route}
            isSelected={false}
            isAlternative={true}
            onClick={() => onRouteSelect && onRouteSelect(index)}
          />
        );
      })}
      
      {/* Selected route */}
      {routes && routes[selectedRouteIndex] && (
        <RoutePolyline
          route={routes[selectedRouteIndex]}
          isSelected={true}
          isAlternative={false}
        />
      )}
      
      {/* Loading indicator on map */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div className="loading-spinner" />
          <span>Finding routes...</span>
        </div>
      )}
      
      {/* Start marker (draggable) */}
      {startCoords && (
        <DraggableMarker
          position={startCoords}
          icon={startPinIcon}
          onDragEnd={handleStartDragEnd}
          popupContent={
            <div style={{ textAlign: 'center' }}>
              <strong style={{ color: '#22c55e' }}>📍 Start Point</strong>
              <br />
              <small>{startCoords[0].toFixed(5)}, {startCoords[1].toFixed(5)}</small>
              <br />
              <em style={{ fontSize: '10px', color: '#888' }}>Drag to change location</em>
            </div>
          }
        />
      )}
      
      {/* End marker (draggable) */}
      {endCoords && (
        <DraggableMarker
          position={endCoords}
          icon={endPinIcon}
          onDragEnd={handleEndDragEnd}
          popupContent={
            <div style={{ textAlign: 'center' }}>
              <strong style={{ color: '#ef4444' }}>🏁 Destination</strong>
              <br />
              <small>{endCoords[0].toFixed(5)}, {endCoords[1].toFixed(5)}</small>
              <br />
              <em style={{ fontSize: '10px', color: '#888' }}>Drag to change location</em>
            </div>
          }
        />
      )}
    </MapContainer>
  );
};

export default MapComponent;
