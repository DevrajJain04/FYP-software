import React, { useState, useEffect, useRef } from 'react';

// Nominatim (OpenStreetMap) geocoding service - free, no API key needed
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

// Popular locations in India for quick selection
export const INDIA_LOCATIONS = [
  // Mumbai
  { name: 'Bandra, Mumbai', lat: 19.0596, lng: 72.8295, city: 'Mumbai' },
  { name: 'Andheri, Mumbai', lat: 19.1136, lng: 72.8697, city: 'Mumbai' },
  { name: 'Colaba, Mumbai', lat: 18.9067, lng: 72.8147, city: 'Mumbai' },
  { name: 'Worli, Mumbai', lat: 19.0176, lng: 72.8150, city: 'Mumbai' },
  { name: 'Dadar, Mumbai', lat: 19.0178, lng: 72.8478, city: 'Mumbai' },
  { name: 'Powai, Mumbai', lat: 19.1176, lng: 72.9060, city: 'Mumbai' },
  { name: 'Juhu, Mumbai', lat: 19.0883, lng: 72.8264, city: 'Mumbai' },
  { name: 'Kurla, Mumbai', lat: 19.0726, lng: 72.8845, city: 'Mumbai' },
  { name: 'Chembur, Mumbai', lat: 19.0522, lng: 72.8994, city: 'Mumbai' },
  { name: 'Malad, Mumbai', lat: 19.1872, lng: 72.8484, city: 'Mumbai' },
  { name: 'Borivali, Mumbai', lat: 19.2307, lng: 72.8567, city: 'Mumbai' },
  { name: 'Goregaon, Mumbai', lat: 19.1663, lng: 72.8526, city: 'Mumbai' },
  { name: 'Marine Lines, Mumbai', lat: 18.9432, lng: 72.8235, city: 'Mumbai' },
  { name: 'Lower Parel, Mumbai', lat: 18.9980, lng: 72.8305, city: 'Mumbai' },
  { name: 'BKC, Mumbai', lat: 19.0655, lng: 72.8692, city: 'Mumbai' },
  
  // Delhi
  { name: 'Connaught Place, Delhi', lat: 28.6315, lng: 77.2167, city: 'Delhi' },
  { name: 'Dwarka, Delhi', lat: 28.5921, lng: 77.0460, city: 'Delhi' },
  { name: 'Nehru Place, Delhi', lat: 28.5491, lng: 77.2533, city: 'Delhi' },
  { name: 'Saket, Delhi', lat: 28.5244, lng: 77.2066, city: 'Delhi' },
  { name: 'Karol Bagh, Delhi', lat: 28.6514, lng: 77.1907, city: 'Delhi' },
  { name: 'Lajpat Nagar, Delhi', lat: 28.5677, lng: 77.2433, city: 'Delhi' },
  
  // Bangalore
  { name: 'Koramangala, Bangalore', lat: 12.9352, lng: 77.6245, city: 'Bangalore' },
  { name: 'Whitefield, Bangalore', lat: 12.9698, lng: 77.7500, city: 'Bangalore' },
  { name: 'Indiranagar, Bangalore', lat: 12.9784, lng: 77.6408, city: 'Bangalore' },
  { name: 'Electronic City, Bangalore', lat: 12.8399, lng: 77.6770, city: 'Bangalore' },
  { name: 'MG Road, Bangalore', lat: 12.9758, lng: 77.6045, city: 'Bangalore' },
  
  // Chennai
  { name: 'T Nagar, Chennai', lat: 13.0418, lng: 80.2341, city: 'Chennai' },
  { name: 'Anna Nagar, Chennai', lat: 13.0850, lng: 80.2101, city: 'Chennai' },
  { name: 'Velachery, Chennai', lat: 12.9815, lng: 80.2180, city: 'Chennai' },
  { name: 'Adyar, Chennai', lat: 13.0012, lng: 80.2565, city: 'Chennai' },
  
  // Pune
  { name: 'Hinjewadi, Pune', lat: 18.5912, lng: 73.7380, city: 'Pune' },
  { name: 'Koregaon Park, Pune', lat: 18.5362, lng: 73.8939, city: 'Pune' },
  { name: 'Kothrud, Pune', lat: 18.5074, lng: 73.8077, city: 'Pune' },
  { name: 'Shivaji Nagar, Pune', lat: 18.5308, lng: 73.8475, city: 'Pune' },
  
  // Hyderabad
  { name: 'Hitech City, Hyderabad', lat: 17.4435, lng: 78.3772, city: 'Hyderabad' },
  { name: 'Banjara Hills, Hyderabad', lat: 17.4156, lng: 78.4347, city: 'Hyderabad' },
  { name: 'Gachibowli, Hyderabad', lat: 17.4401, lng: 78.3489, city: 'Hyderabad' },
  { name: 'Secunderabad, Hyderabad', lat: 17.4399, lng: 78.4983, city: 'Hyderabad' },
  
  // Kolkata
  { name: 'Salt Lake, Kolkata', lat: 22.5958, lng: 88.4106, city: 'Kolkata' },
  { name: 'Park Street, Kolkata', lat: 22.5519, lng: 88.3529, city: 'Kolkata' },
  { name: 'Howrah, Kolkata', lat: 22.5958, lng: 88.2636, city: 'Kolkata' },
  
  // Ahmedabad
  { name: 'SG Highway, Ahmedabad', lat: 23.0469, lng: 72.5170, city: 'Ahmedabad' },
  { name: 'CG Road, Ahmedabad', lat: 23.0225, lng: 72.5714, city: 'Ahmedabad' },
];

const LocationSearch = ({
  label,
  placeholder,
  value,
  onChange,
  onCoordinateChange,
  icon,
  iconColor,
  clickMode,
  onClickModeChange,
  currentClickMode
}) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Filter local India locations first, then search Nominatim
  const searchLocations = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    
    // First, filter local Indian locations
    const localMatches = INDIA_LOCATIONS.filter(loc => 
      loc.name.toLowerCase().includes(lowerQuery) ||
      loc.city.toLowerCase().includes(lowerQuery)
    ).slice(0, 3).map(loc => ({
      displayName: `${loc.name}, India`,
      shortName: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      type: 'local',
      isLocal: true
    }));

    // Show local matches immediately
    if (localMatches.length > 0) {
      setSuggestions(localMatches);
    }

    // Then search Nominatim for more results (search in India)
    if (searchQuery.length >= 3) {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=in&limit=5&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en'
            }
          }
        );
        const data = await response.json();
        
        const nominatimResults = data.map(item => ({
          displayName: item.display_name,
          shortName: formatShortName(item),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type,
          address: item.address,
          isLocal: false
        }));
        
        // Combine local and Nominatim results, removing duplicates
        const combined = [...localMatches];
        nominatimResults.forEach(nr => {
          const isDuplicate = combined.some(c => 
            Math.abs(c.lat - nr.lat) < 0.01 && Math.abs(c.lng - nr.lng) < 0.01
          );
          if (!isDuplicate) {
            combined.push(nr);
          }
        });
        
        setSuggestions(combined.slice(0, 8));
      } catch (error) {
        console.error('Geocoding error:', error);
        // Keep local matches if Nominatim fails
      } finally {
        setIsLoading(false);
      }
    }
  };

  const formatShortName = (item) => {
    const parts = [];
    if (item.address) {
      if (item.address.road) parts.push(item.address.road);
      if (item.address.suburb || item.address.neighbourhood) {
        parts.push(item.address.suburb || item.address.neighbourhood);
      }
      if (item.address.city || item.address.town || item.address.state_district) {
        parts.push(item.address.city || item.address.town || item.address.state_district);
      }
    }
    return parts.length > 0 ? parts.join(', ') : item.display_name.split(',').slice(0, 2).join(',');
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setQuery(newValue);
    setShowSuggestions(true);

    // Debounce the search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchLocations(newValue);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion) => {
    setQuery(suggestion.shortName);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange && onChange(suggestion.shortName);
    onCoordinateChange && onCoordinateChange([suggestion.lat, suggestion.lng]);
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow click to register
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className="location-search">
      <div className="location-input-group">
        <div className="location-icon" style={{ backgroundColor: iconColor }}>
          {icon}
        </div>
        <div className="location-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="location-input"
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions(true)}
            onBlur={handleBlur}
          />
          {isLoading && <div className="input-spinner" />}
          <button 
            className={`pin-button ${currentClickMode === clickMode ? 'active' : ''}`}
            onClick={() => onClickModeChange(currentClickMode === clickMode ? null : clickMode)}
            title={`Click on map to set ${label.toLowerCase()}`}
          >
            📍
          </button>
        </div>
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="suggestion-item"
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <div className="suggestion-icon">{suggestion.isLocal ? '⭐' : '📍'}</div>
              <div className="suggestion-content">
                <div className="suggestion-name">{suggestion.shortName}</div>
                <div className="suggestion-address">
                  {suggestion.isLocal ? '🇮🇳 Popular Location' : suggestion.displayName}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Reverse geocoding - get address from coordinates
export const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(
      `${NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en'
        }
      }
    );
    const data = await response.json();
    
    if (data && data.address) {
      const parts = [];
      if (data.address.road) parts.push(data.address.road);
      if (data.address.suburb) parts.push(data.address.suburb);
      if (data.address.city || data.address.town) {
        parts.push(data.address.city || data.address.town);
      }
      return parts.join(', ') || data.display_name.split(',').slice(0, 2).join(',');
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

export default LocationSearch;
