# Project Implementation Report
## Smart Route Planner - Weighted Routing Application

**Project Type:** Final Year Project (FYP)  
**Date:** January 7, 2026  
**Version:** 1.0.0

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Core Features](#core-features)
6. [Component Implementation](#component-implementation)
7. [Service Layer](#service-layer)
8. [Data Management](#data-management)
9. [User Interface](#user-interface)
10. [API Integration](#api-integration)
11. [Real-Time Features](#real-time-features)
12. [Future Enhancements](#future-enhancements)
13. [Installation & Setup](#installation--setup)

---

## Executive Summary

The **Smart Route Planner** is an intelligent routing application that calculates optimal routes between two locations based on three weighted factors: **distance**, **travel time**, and **air quality (AQI)**. Built with React and Leaflet.js, it provides real-time air quality updates and multiple route alternatives, empowering users to make informed decisions about their travel routes.

### Key Achievements
- ✅ Multi-factor weighted routing algorithm implementation
- ✅ Real-time AQI simulation and visualization
- ✅ Integration with OpenRouteService for real-world routing
- ✅ Dynamic geocoding with OpenStreetMap Nominatim
- ✅ Interactive map with draggable markers
- ✅ Turn-by-turn navigation with street names
- ✅ Multiple travel modes (driving, cycling, walking)
- ✅ Responsive and intuitive user interface
- ✅ Hardware interface specification for IoT integration

---

## Project Overview

### Problem Statement
Traditional routing applications focus solely on distance or time optimization, neglecting environmental factors like air quality that can significantly impact health, especially for vulnerable populations (children, elderly, people with respiratory conditions).

### Solution
A web-based routing application that:
1. Calculates multiple route alternatives based on customizable weight preferences
2. Displays real-time air quality information along routes
3. Provides visual comparison of routes with different optimization priorities
4. Offers turn-by-turn directions with AQI awareness
5. Supports multiple travel modes (car, bicycle, walking)

### Target Users
- Health-conscious travelers
- People with respiratory conditions (asthma, allergies)
- Parents planning routes for children
- Cyclists and pedestrians
- Urban planners and researchers

---

## Technology Stack

### Frontend Framework
- **React 18.2.0** - Component-based UI framework
- **React-DOM 18.2.0** - DOM rendering
- **React-Scripts 5.0.1** - Build tooling and development server

### Mapping Libraries
- **Leaflet 1.9.4** - Interactive map library
- **React-Leaflet 4.2.1** - React components for Leaflet

### External APIs
- **OpenRouteService (ORS)** - Real-world routing with alternative routes
- **OpenStreetMap Nominatim** - Free geocoding and reverse geocoding
- **AQI APIs** (Planned integration):
  - OpenWeather Air Pollution API
  - IQAir AirVisual API
  - WAQI (World Air Quality Index) API
  - Google Air Quality API

### Development Tools
- Node.js & npm
- Modern JavaScript (ES6+)
- CSS3 with custom styling
- Environment variables (.env) for API keys

---

## System Architecture

### Application Structure
```
weighted-routing-app/
├── public/                 # Static assets
│   └── index.html         # HTML template
├── src/
│   ├── App.js             # Main application component
│   ├── index.js           # Application entry point
│   ├── index.css          # Global styles
│   ├── components/        # UI components
│   │   ├── MapComponent.js          # Interactive map
│   │   ├── WeightSliders.js         # Weight controls
│   │   ├── LocationSearch.js        # Location input
│   │   ├── DirectionsPanel.js       # Navigation
│   │   ├── RouteAlternatives.js     # Route comparison
│   │   ├── AQIStatus.js             # Live status
│   │   └── NodeSelector.js          # (Legacy)
│   ├── services/          # External API integrations
│   │   ├── routingService.js        # OpenRouteService
│   │   └── aqiService.js            # AQI data fetching
│   ├── data/              # Data models and simulation
│   │   ├── aqiData.js               # AQI zones & updates
│   │   └── graphData.js             # (Legacy graph)
│   └── utils/             # Helper functions
│       ├── dijkstra.js              # (Legacy algorithm)
│       └── formatters.js            # Display formatting
├── docs/                  # Documentation
│   ├── HARDWARE_INTERFACE.md        # IoT contract
│   └── PROJECT_IMPLEMENTATION.md    # This file
├── analysis/             # Data analysis
│   └── aqi_ml_analysis.ipynb       # ML exploration
├── .env.example          # Environment template
├── .env                  # API keys (gitignored)
├── package.json          # Dependencies
└── README.md            # Project overview
```

### Data Flow Architecture

```
┌─────────────┐
│   User UI   │ (React Components)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│     App.js (State Management)      │
│  - Route state                     │
│  - Weight preferences              │
│  - Location coordinates            │
│  - AQI updates                     │
└──────┬─────────────┬────────────────┘
       │             │
       ▼             ▼
┌──────────────┐  ┌────────────────┐
│   Services   │  │   Components   │
│              │  │                │
│ - Routing    │  │ - Map          │
│ - AQI        │  │ - Controls     │
│ - Geocoding  │  │ - Directions   │
└──────┬───────┘  └────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│      External APIs              │
│ - OpenRouteService              │
│ - Nominatim (OSM)               │
│ - AQI APIs (future)             │
└─────────────────────────────────┘
```

---

## Core Features

### 1. Weighted Routing Algorithm

**Implementation:** Custom weight-based route selection
```javascript
Cost = (w1 × normalized_distance) + (w2 × normalized_time) + (w3 × normalized_AQI)
```

**Features:**
- Three adjustable weight sliders (w1, w2, w3)
- Real-time route recalculation on weight change
- Normalization of different units for fair comparison
- Visual weight distribution bar

**User Controls:**
- Slider range: 0.00 to 1.00 (increments of 0.05)
- Quick preset buttons:
  - **Shortest** (w1=1, w2=0, w3=0)
  - **Fastest** (w1=0, w2=1, w3=0)
  - **Greenest** (w1=0, w2=0, w3=1)

### 2. Multiple Route Alternatives

**Implementation:** OpenRouteService alternative routes API
- Request up to 3 alternative routes per query
- Routes sorted by weighted cost
- Color-coded visualization (Best = Green, Alt1 = Blue, Alt2 = Orange)

**Route Information Displayed:**
- Distance (meters/kilometers)
- Duration (minutes/hours)
- Average AQI along route
- Turn-by-turn directions with street names

### 3. Real-Time Air Quality Updates

**Current Implementation:** Zone-based simulation
- 30+ predefined AQI zones across London
- Updates every 8 seconds
- ±15% AQI fluctuation to simulate real-time changes

**AQI Categories:**
- **Good** (0-50): Green
- **Moderate** (51-100): Yellow-green
- **Unhealthy for Sensitive** (101-150): Orange
- **Unhealthy** (151-200): Red
- **Very Unhealthy** (201-300): Dark red
- **Hazardous** (301-500): Purple

**Future Implementation:** Real API integration
- Supports OpenWeather, WAQI, IQAir, Google APIs
- Configurable provider selection
- Built-in caching (5-minute duration)
- Automatic fallback to simulation

### 4. Interactive Location Selection

**Methods:**
1. **Autocomplete Search**
   - Type-ahead suggestions via Nominatim
   - UK-focused results (configurable)
   - Displays full address with short name
   - Debounced search (300ms) for performance

2. **Map Click**
   - Click pin button (📍) to activate
   - Click anywhere on map to set location
   - Visual feedback for active mode
   - Reverse geocoding to display address

3. **Draggable Markers**
   - Google Maps-style pin icons (A for start, B for end)
   - Drag markers to new positions
   - Automatic route recalculation
   - Popup with coordinates and instructions

**Additional Features:**
- Swap locations button (⇅)
- Location persistence during session
- Coordinate display (5 decimal precision)

### 5. Multiple Travel Modes

**Supported Modes:**
- 🚗 **Driving** (driving-car) - Default
- 🚴 **Cycling** (cycling-regular) - Bike routes
- 🚶 **Walking** (foot-walking) - Pedestrian paths

**Mode-Specific Features:**
- Different route calculations per mode
- Mode-appropriate speed estimates
- Suitable road type filtering

### 6. Turn-by-Turn Navigation

**Implementation:** ORS step-by-step instructions

**Direction Types:**
- 🚩 Start
- ↰ Turn left
- ↱ Turn right  
- ↖ Slight left
- ↗ Slight right
- ↩ U-turn
- 🔄 Roundabout
- ↑ Continue straight
- ⤴ Merge
- 🏁 Arrive at destination

**Information per Step:**
- Instruction text with street name
- Distance for this step
- Duration for this step
- Cumulative distance/time

**UI Features:**
- Collapsible directions panel
- Step hover highlights (planned)
- Step click zoom (planned)
- Summary header with totals

### 7. Visual Map Features

**Map Components:**
- OpenStreetMap tile layer
- Custom pin icons (color-coded)
- Multiple route polylines
- Route shadow/outline for visibility
- AQI zone circles (optional overlay)
- Popup information on click
- Auto-bounds to show all routes

**Route Visualization:**
- Main route: solid, full opacity
- Alternative routes: dashed, 50% opacity
- Click alternative to select/highlight
- Color varies by AQI level or route type
- Thicker line for selected route

### 8. Responsive UI Design

**Layout:**
- Left sidebar (360px) for controls
- Right map area (flexible width)
- Floating directions panel
- Bottom AQI legend

**Styling:**
- Modern, clean interface
- Google Maps-inspired design
- Color-coded elements
- Smooth transitions and animations
- Loading indicators
- Error message displays

---

## Component Implementation

### 1. App.js (Main Component)

**Purpose:** Root component managing application state and orchestrating all features

**State Management:**
```javascript
- weights: { w1, w2, w3 }          // Routing weights
- startCoords, endCoords           // [lat, lng] arrays
- startName, endName               // Location names
- routes[]                         // Array of route objects
- selectedRouteIndex               // Currently selected route
- isLoading                        // Loading state
- error                            // Error messages
- clickMode: 'start'|'end'|null   // Map click mode
- showDirections: boolean          // Directions panel visibility
- travelMode: string               // Travel mode selection
- lastAQIUpdate: timestamp         // Last AQI refresh
- isLive: boolean                  // AQI simulation status
```

**Key Functions:**
- `calculateRoutes()` - Fetch routes from ORS and process
- `handleMapClick()` - Set locations via map interaction
- `handleSwapLocations()` - Swap start and end points
- AQI update subscription and debounced recalculation
- Format helpers for display

**Lifecycle:**
1. Initialize with default London locations
2. Start AQI simulation on mount
3. Subscribe to AQI updates
4. Debounce route calculation (500ms)
5. Cleanup on unmount

### 2. MapComponent.js

**Purpose:** Interactive Leaflet map with markers and routes

**Features Implemented:**
- MapContainer with OSM tiles
- DraggableMarker components (start/end)
- RoutePolyline components (multiple routes)
- AQIZones overlay circles
- MapClickHandler for location selection
- MapBounds auto-fit
- Loading indicator overlay

**Custom Icons:**
- SVG-based pin icons
- Color-coded (Green for start, Red for end)
- Labels (A, B)
- Drop shadow effects

**Event Handling:**
- Marker drag end → update coordinates
- Map click → set location (if mode active)
- Route click → select different route
- Popup interactions

### 3. LocationSearch.js

**Purpose:** Intelligent location input with autocomplete

**Features:**
- Debounced search input (300ms)
- Nominatim geocoding API
- Dropdown suggestions list
- Short name formatting
- Pin button toggle
- Loading spinner
- Reverse geocoding export

**Search Flow:**
1. User types → debounce
2. Fetch from Nominatim (3+ characters)
3. Format results (limit 5)
4. Display dropdown
5. Select → update coordinates & name
6. Close dropdown

**Exported Functions:**
- `reverseGeocode(lat, lng)` - Get address from coordinates

### 4. WeightSliders.js

**Purpose:** Route preference controls

**Features:**
- Three range inputs (0-1, step 0.05)
- Real-time weight display
- Visual weight bar (percentage distribution)
- Quick preset buttons
- Color-coded sliders and values

**Visual Feedback:**
- Distance: Blue theme
- Time: Orange theme
- Air Quality: Green theme
- Percentage bar shows current distribution

### 5. DirectionsPanel.js

**Purpose:** Turn-by-turn navigation display

**Features:**
- Summary header (total distance, time, AQI)
- Route indicator bar
- Numbered step list
- Direction icons
- Street names
- Step distance/duration
- AQI breakdown bar

**Styling:**
- Scrollable step list
- Hover effects (planned)
- Click to zoom (planned)
- Color-coded AQI

### 6. RouteAlternatives.js

**Purpose:** Route comparison cards

**Note:** This component exists but is currently unused in favor of inline route display in App.js

**Features:**
- Route cards with stats
- Selection highlighting
- Color-coded borders
- Icons per route type

### 7. AQIStatus.js

**Purpose:** Live update indicator

**Features:**
- Live/Offline status indicator
- Pulsing animation when live
- "Time ago" display
- Last update timestamp

---

## Service Layer

### 1. routingService.js

**Purpose:** OpenRouteService API integration

**Functions:**

**`getAlternativeRoutes(start, end, profile)`**
- Requests up to 3 alternative routes
- Parameters:
  - `start`: [lat, lng] array
  - `end`: [lat, lng] array  
  - `profile`: 'driving-car' | 'cycling-regular' | 'foot-walking'
- Returns: Array of route objects with:
  - `geometry`: [lat, lng] coordinates
  - `distance`: meters
  - `duration`: seconds
  - `steps`: Turn-by-turn instructions
  - `found`: true if route exists

**`getORSRoute(start, end, profile)`**
- Simple single route request (GET method)
- Used for basic routing needs

**`getORSRouteDetailed(start, end, profile, options)`**
- Advanced POST request with extra options
- Supports waypoints, elevation, extra_info

**Helper Functions:**
- `getInstructionText(type, streetName)` - Format turn instructions
- `decodeGeometry(geometry)` - Convert GeoJSON to Leaflet format
- `parseORSRoute(orsData, aqiData)` - Transform ORS response

**Configuration:**
- API key from `process.env.REACT_APP_ORS_API_KEY`
- Base URL: `https://api.openrouteservice.org`
- Endpoints: `/v2/directions/{profile}/geojson`

### 2. aqiService.js

**Purpose:** Flexible AQI data fetching with multiple provider support

**Current Mode:** Sample data simulation  
**Future Modes:** OpenWeather, WAQI, IQAir, Google APIs

**Main Functions:**

**`fetchRouteAQI(coordinates)`**
- Samples points along route
- Fetches AQI for each sample
- Returns: `{ average, min, max, segments[], provider }`
- Configurable sample count (default: 10 points)

**`fetchLocationAQI(lat, lng)`**
- Single point AQI query
- Returns: `{ aqi, category, color, bgColor, description }`

**`getAQICategory(aqi)`**
- Returns category info for AQI value
- 6 categories from Good to Hazardous

**Configuration Functions:**
- `configureAQIService(config)` - Update provider, cache, etc.
- `getAQIServiceConfig()` - Get current settings
- `clearAQICache()` - Reset cache

**Caching:**
- In-memory Map cache
- 5-minute default TTL
- Rounded coordinates (3 decimal places) for cache keys

**Provider Integration (Prepared):**

**OpenWeather:**
```javascript
fetchOpenWeatherAQI(lat, lng)
// Uses: api.openweathermap.org/data/2.5/air_pollution
// Returns: 1-5 scale, converts to EPA 0-500
```

**WAQI:**
```javascript
fetchWAQIAQI(lat, lng)
// Uses: api.waqi.info/feed/geo
// Returns: EPA AQI directly
```

**Sample Mode:**
```javascript
fetchSampleAQI(lat, lng)
// Geographic simulation based on:
// - Distance from city center
// - Time of day (rush hour penalty)
// - Random variation
```

---

## Data Management

### 1. aqiData.js

**Purpose:** AQI zone definitions and real-time simulation

**AQI Zones:**
- 30+ predefined zones across London
- Each zone includes:
  - Unique ID and name
  - Center coordinates (lat, lng)
  - Radius of influence (degrees)
  - Current AQI value
  - Zone type (park, residential, commercial, traffic, industrial, riverside)

**Zone Types & Typical AQI:**
- **Parks** (20-35): Hyde Park, Regent's Park, Hampstead Heath
- **Residential** (35-50): Notting Hill, Chelsea, Hampstead
- **Riverside** (45-60): South Bank, Embankment, Thames Barrier
- **Commercial** (85-95): Oxford Circus, Piccadilly, Soho
- **Traffic** (102-115): Marble Arch, Euston Road, Elephant & Castle
- **Industrial** (120-155): Canary Wharf, Blackwall Tunnel, A13 Corridor

**Real-Time Simulation:**

**`startAQISimulation()`**
- Runs every 8 seconds
- Fluctuates each zone's AQI by ±15%
- Notifies subscribers
- Returns cleanup function

**`subscribeToAQIUpdates(callback)`**
- Pub/sub pattern
- Multiple subscribers supported
- Returns unsubscribe function

**AQI Calculation Functions:**

**`getAQIAtLocation(lat, lng)`**
- Inverse distance weighting from nearby zones
- Considers zones within 3× radius
- Returns interpolated AQI value

**`calculateRouteAQI(coordinates)`**
- Samples 30 points along route
- Gets AQI at each point
- Returns: `{ average, max, min, segments[] }`

**`calculateRouteAQIAsync(coordinates)`**
- Async version for real API integration
- Falls back to zone calculation on error

**`getAQIInfo(aqi)`**
- Returns category, color, background color
- 5 AQI ranges with distinct colors

**Integration Points:**
- Used by App.js for real-time updates
- Used by MapComponent for zone overlay
- Bridges to aqiService.js for API calls

### 2. graphData.js (Legacy)

**Status:** Deprecated, kept for reference

**Original Purpose:** Static graph-based routing

**Contents:**
- 24 predefined nodes (A-X) around London
- ~70 edges with distance, time, AQI
- Graph building functions
- Nearest node finder
- Bearing calculations

**Replacement:** Now uses OpenRouteService for dynamic routing

### 3. formatters.js

**Purpose:** Display formatting utilities

**Functions:**

**`formatTime(minutes)`**
- Input: Minutes as number
- Output: "X min" or "X hr Y min"

**`formatDistance(km)`**
- Input: Kilometers as number
- Output: "X m" or "X.X km"

**`formatAQI(aqi)`**
- Input: AQI value
- Output: Rounded integer string

---

## User Interface

### Design Philosophy
- **Clean & Modern:** Google Maps-inspired interface
- **Informative:** Rich data display without clutter
- **Responsive:** Adapts to different screen sizes
- **Visual Hierarchy:** Clear information prioritization
- **Accessible:** Color-coded with labels

### Color Palette

**Primary Colors:**
- Blue (#1a73e8): Primary actions, distance theme
- Green (#22c55e): Start point, AQI good, green route
- Red (#ef4444): End point, AQI unhealthy
- Orange (#f59e0b): Time theme, AQI moderate

**AQI Colors:**
- Good: #22c55e (Green)
- Moderate: #84cc16 (Yellow-green)
- Unhealthy for Sensitive: #f59e0b (Orange)
- Unhealthy: #ef4444 (Red)
- Very Unhealthy: #7c2d12 (Dark red)

**Neutral Colors:**
- Background: #f5f5f5
- Borders: #e0e0e0
- Text: #374151
- Light text: #9ca3af

### Layout Structure

**Header (Fixed)**
- Gradient background (blue theme)
- App title and subtitle
- Always visible

**Main Content (Flex)**
- Left: Controls panel (360px fixed width)
- Right: Map container (flexible)

**Controls Panel Sections:**
1. AQI Status (live indicator)
2. Locations (search inputs)
3. Travel Mode (mode buttons)
4. Route Preferences (weight sliders)
5. Routes (alternatives list)
6. Error messages (if any)

**Map Area:**
- Full height interactive map
- Floating directions panel (collapsible)
- Loading overlay (when active)

**Footer (Fixed)**
- AQI legend
- Category reference

### Responsive Design

**Desktop (>1024px):**
- Full sidebar visible
- Wide map area
- All features accessible

**Tablet (768-1024px):**
- Narrower sidebar
- Compact controls
- Maintained functionality

**Mobile (<768px):**
- Collapsible sidebar (planned)
- Full-width map
- Touch-optimized controls

### CSS Implementation

**Total Lines:** 1034 lines of custom CSS

**Key Features:**
- Flexbox layouts
- CSS animations (pulse, fade)
- Smooth transitions (0.2s)
- Hover states
- Focus states for accessibility
- Custom scrollbars
- Media queries (planned expansion)

**Animation Examples:**
- Pulsing live indicator
- Loading spinner
- Smooth panel transitions
- Route selection highlight

### Accessibility Considerations

**Current:**
- Color + text labels (not color alone)
- Focus indicators on inputs
- Semantic HTML structure
- Alt text for icons (emoji-based)

**Future Enhancements:**
- ARIA labels
- Keyboard navigation
- Screen reader optimization
- High contrast mode

---

## API Integration

### OpenRouteService (ORS)

**Purpose:** Real-world routing engine

**Setup:**
1. Sign up at https://openrouteservice.org/dev/#/signup
2. Get free API key (5000 requests/day)
3. Add to `.env`: `REACT_APP_ORS_API_KEY=your_key_here`

**Endpoints Used:**

**Alternative Routes (POST):**
```
POST https://api.openrouteservice.org/v2/directions/{profile}/geojson
Headers:
  - Content-Type: application/json
  - Authorization: {API_KEY}
Body:
{
  "coordinates": [[lng1, lat1], [lng2, lat2]],
  "instructions": true,
  "geometry": true,
  "alternative_routes": {
    "target_count": 3,
    "weight_factor": 1.6,
    "share_factor": 0.6
  }
}
```

**Response Format:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[lng, lat], ...]
      },
      "properties": {
        "segments": [
          {
            "steps": [
              {
                "type": 0-13,
                "instruction": "Turn left onto Street Name",
                "name": "Street Name",
                "distance": 123.4,
                "duration": 45.6,
                "way_points": [0, 5]
              }
            ]
          }
        ],
        "summary": {
          "distance": 1234.5,
          "duration": 567.8
        }
      }
    }
  ]
}
```

**Rate Limits:**
- Free tier: 5000 requests/day
- 40 requests/minute
- Recommend caching routes

**Error Handling:**
- HTTP status check
- Fallback to error message
- User notification
- No crash on API failure

### OpenStreetMap Nominatim

**Purpose:** Geocoding and reverse geocoding

**Base URL:** https://nominatim.openstreetmap.org

**Forward Geocoding (Search):**
```
GET /search?format=json&q={query}&countrycodes=gb&limit=5&addressdetails=1
Headers:
  - Accept-Language: en
```

**Reverse Geocoding (Coordinates to Address):**
```
GET /reverse?format=json&lat={lat}&lon={lng}&addressdetails=1
Headers:
  - Accept-Language: en
```

**Usage Policy:**
- Max 1 request/second
- Must have valid User-Agent
- Not for heavy usage (consider hosting own instance)
- Free for fair use

**Response Parsing:**
- Extract road, suburb, city
- Format short name (2-3 parts)
- Full display_name for details

### AQI APIs (Planned Integration)

**1. OpenWeather Air Pollution API**
- URL: api.openweathermap.org/data/2.5/air_pollution
- Free tier: 60 calls/minute
- Returns: AQI (1-5 scale), pollutant concentrations
- Coverage: Global

**2. WAQI (World Air Quality Index)**
- URL: api.waqi.info/feed/geo
- Free tier: 1000 requests/day
- Returns: EPA AQI (0-500 scale)
- Coverage: 130+ countries, 30000+ stations

**3. IQAir AirVisual**
- URL: api.airvisual.com/v2
- Free tier: 10000 calls/month
- Returns: US AQI, detailed pollutants
- Coverage: 100+ countries

**4. Google Air Quality API**
- URL: airquality.googleapis.com/v1
- Paid (with free tier)
- Returns: Comprehensive AQI data
- Coverage: Global with high accuracy

**Implementation Status:**
- ✅ Service architecture prepared
- ✅ Provider switching mechanism
- ✅ Caching system
- ✅ Fallback handling
- ⏳ API keys pending
- ⏳ Production deployment

---

## Real-Time Features

### AQI Update System

**Architecture:**
```
AQI Zones Data
    ↓
startAQISimulation()
    ↓ (every 8 seconds)
Update Zone Values (±15% fluctuation)
    ↓
Notify Subscribers
    ↓
App.js receives update
    ↓
Set calculationPending flag
    ↓
Debounced recalculation
    ↓
Recalculate route AQI
    ↓
Re-sort routes
    ↓
Update UI
```

**Subscription Pattern:**
```javascript
// In App.js
useEffect(() => {
  const unsubscribe = subscribeToAQIUpdates(() => {
    setLastAQIUpdate(Date.now());
    calculationPending.current = true;
  });
  
  return unsubscribe; // Cleanup
}, []);
```

**Performance Optimization:**
- Debounced recalculation (prevents excessive updates)
- Reuses existing route geometry
- Only recalculates AQI, not full route
- Flag-based update prevention

**Visual Feedback:**
- Live indicator with pulsing animation
- "Last updated" timestamp
- Route colors update dynamically
- Route ranking changes reflected

### Route Auto-Recalculation

**Triggers:**
1. Weight slider change → 500ms debounce
2. Location change → immediate
3. Travel mode change → immediate
4. AQI update → flagged + debounced

**Debouncing Strategy:**
```javascript
useEffect(() => {
  const timer = setTimeout(() => {
    calculateRoutes();
  }, 500);
  return () => clearTimeout(timer);
}, [calculateRoutes]);
```

**Benefits:**
- Prevents API spam
- Smooth user experience
- Reduces unnecessary calculations
- Maintains responsiveness

---

## Future Enhancements

### Phase 1: Core Improvements (Near-term)

**1. Real AQI API Integration**
- Switch from simulation to live data
- Implement OpenWeather as primary provider
- Add provider selection in settings
- Monitor API usage and costs

**2. Route Caching**
- Cache calculated routes
- Invalidate on significant AQI change
- Reduce API calls
- Faster repeat queries

**3. Mobile Optimization**
- Collapsible sidebar
- Touch gestures (pinch zoom)
- Bottom sheet for directions
- Simplified controls

**4. Route Comparison View**
- Side-by-side route metrics
- Chart visualization
- Export comparison data
- Share routes

### Phase 2: Advanced Features (Mid-term)

**5. User Preferences**
- Save favorite locations
- Default weight settings
- Preferred travel mode
- AQI threshold alerts

**6. Waypoints Support**
- Multi-stop routing
- Drag to reorder stops
- Optimize waypoint order
- Save common routes

**7. Time-Based Routing**
- Departure/arrival time selection
- Traffic predictions
- Time-varying AQI
- Historical AQI data

**8. Offline Mode**
- Download map tiles
- Cache routes
- Offline directions
- Sync when online

### Phase 3: IoT Integration (Long-term)

**9. Hardware Sensor Network**
- Implement HARDWARE_INTERFACE.md spec
- Real sensor deployment
- Live data streaming
- Crowdsourced AQI

**10. Predictive Analytics**
- ML model integration (see analysis/aqi_ml_analysis.ipynb)
- AQI forecasting
- Route prediction
- Traffic pattern analysis

**11. Community Features**
- User-reported conditions
- Route ratings
- Photo sharing
- Social features

### Phase 4: Platform Expansion

**12. Mobile Apps**
- Native iOS app
- Native Android app
- React Native cross-platform
- GPS integration

**13. Voice Navigation**
- Turn-by-turn audio
- Voice commands
- Accessibility features
- Multiple languages

**14. Public API**
- Developer API access
- Webhook support
- Third-party integrations
- Rate limiting

**15. Enterprise Features**
- Fleet management
- Bulk routing
- Custom algorithms
- White-label solution

---

## Installation & Setup

### Prerequisites

**Required:**
- Node.js v14+ (v18+ recommended)
- npm v6+ (or yarn)
- Modern web browser (Chrome, Firefox, Safari, Edge)

**Optional:**
- Git (for version control)
- VS Code (recommended editor)
- React Developer Tools browser extension

### Step-by-Step Installation

**1. Clone/Download Project**
```bash
git clone https://github.com/YOUR_USERNAME/weighted-routing-app.git
cd weighted-routing-app
```

**2. Install Dependencies**
```bash
npm install
```

This installs:
- react, react-dom
- react-scripts
- leaflet, react-leaflet

**3. Configure Environment**
```bash
# Copy example file
cp .env.example .env

# Edit .env and add your API keys
REACT_APP_ORS_API_KEY=your_openrouteservice_key_here
```

Get ORS API key:
1. Visit https://openrouteservice.org/dev/#/signup
2. Sign up for free account
3. Generate API key
4. Copy to .env file

**4. Start Development Server**
```bash
npm start
```

Application opens at http://localhost:3000

**5. Build for Production**
```bash
npm run build
```

Creates optimized build in `build/` directory

### Configuration Options

**Environment Variables (.env):**
```bash
# Required
REACT_APP_ORS_API_KEY=your_key

# Optional (for future AQI integration)
REACT_APP_OPENWEATHER_API_KEY=your_key
REACT_APP_WAQI_API_KEY=your_key
REACT_APP_IQAIR_API_KEY=your_key
REACT_APP_GOOGLE_AQI_API_KEY=your_key
```

**AQI Service Configuration (in code):**
```javascript
import { configureAQIService } from './services/aqiService';

configureAQIService({
  provider: 'openweather',  // 'sample', 'openweather', 'waqi'
  samplePointsPerRoute: 15, // Number of AQI samples
  cacheDuration: 300000     // 5 minutes in ms
});
```

### Deployment

**Recommended Platforms:**
- **Vercel** - Zero config, free tier
- **Netlify** - Easy deployment, free tier
- **GitHub Pages** - Free hosting
- **Firebase Hosting** - Google infrastructure

**Vercel Deployment:**
```bash
npm install -g vercel
vercel --prod
```

**Netlify Deployment:**
```bash
npm run build
# Drag build/ folder to netlify.com
```

**Environment Variables in Production:**
- Set in platform dashboard
- Same names as .env file
- Keep keys secure

### Troubleshooting

**Issue: Routes not loading**
- Check ORS API key is set
- Verify API key is valid
- Check browser console for errors
- Ensure internet connection

**Issue: Locations not searching**
- Nominatim may rate-limit
- Wait 1 second between searches
- Check browser console

**Issue: Map not displaying**
- Ensure Leaflet CSS is loaded
- Check for JavaScript errors
- Clear browser cache

**Issue: npm install fails**
- Delete node_modules/
- Delete package-lock.json
- Run npm install again
- Try npm cache clean --force

---

## Testing & Quality Assurance

### Manual Testing Checklist

**Location Selection:**
- ✅ Autocomplete search works
- ✅ Map click selection works
- ✅ Marker dragging works
- ✅ Swap locations works
- ✅ Reverse geocoding displays names

**Routing:**
- ✅ Routes calculate on location change
- ✅ Multiple alternatives displayed
- ✅ Routes sorted by weighted cost
- ✅ Route selection highlights correctly
- ✅ All travel modes work

**Weight Controls:**
- ✅ Sliders update routes
- ✅ Preset buttons apply correctly
- ✅ Visual weight bar accurate
- ✅ Debouncing prevents spam

**Real-Time Updates:**
- ✅ AQI simulation runs
- ✅ Routes recalculate on AQI change
- ✅ Live indicator shows status
- ✅ Timestamp updates

**Directions:**
- ✅ Turn-by-turn displays
- ✅ Street names shown
- ✅ Distance/time accurate
- ✅ Panel collapsible

**Error Handling:**
- ✅ Same location error
- ✅ API failure handling
- ✅ No route found message
- ✅ Loading states

### Browser Compatibility

**Tested:**
- ✅ Chrome 120+ (Full support)
- ✅ Firefox 121+ (Full support)
- ✅ Safari 17+ (Full support)
- ✅ Edge 120+ (Full support)

**Known Issues:**
- None currently

### Performance Metrics

**Load Time:**
- Initial load: ~1.5s
- Route calculation: ~0.5-2s (depends on ORS)
- AQI update: <0.1s

**Bundle Size:**
- Total: ~500KB (uncompressed)
- After gzip: ~150KB

**Optimization Opportunities:**
- Code splitting (React.lazy)
- Image optimization
- Service worker caching
- CDN for static assets

---

## Development Notes

### Code Organization

**Naming Conventions:**
- Components: PascalCase (MapComponent.js)
- Functions: camelCase (calculateRoutes)
- Constants: UPPER_SNAKE_CASE (AQI_CATEGORIES)
- Files: camelCase.js or PascalCase.js

**Comment Standards:**
- JSDoc for exported functions
- Inline comments for complex logic
- TODO markers for future work
- Deprecation notices for legacy code

**Git Workflow:**
- main branch for stable code
- Feature branches for development
- Descriptive commit messages
- Pull requests for review

### Legacy Code

**Deprecated Files:**
1. **utils/dijkstra.js**
   - Original graph-based algorithm
   - Replaced by OpenRouteService
   - Kept for reference
   - Formatters moved to formatters.js

2. **data/graphData.js**
   - Static node/edge graph
   - Replaced by dynamic geocoding
   - 24 predefined London locations
   - Kept for fallback/testing

3. **components/NodeSelector.js**
   - Dropdown location selector
   - Replaced by LocationSearch.js
   - Used static nodes
   - No longer imported

**Migration Notes:**
- Old routing used Dijkstra on static graph
- New routing uses ORS with real roads
- AQI calculation method consistent
- Weight system unchanged

### Known Limitations

**1. API Dependencies**
- Requires internet connection
- Subject to rate limits
- Free tier restrictions
- No offline mode yet

**2. Coverage**
- Demo focused on London area
- Works globally but zones are London-specific
- AQI simulation is generic

**3. Accuracy**
- Route AQI is sampled (not continuous)
- Simulation not real sensor data
- Time estimates from ORS (traffic-unaware on free tier)

**4. Scalability**
- Client-side only (no backend)
- No user accounts
- No data persistence
- Limited by browser storage

### Security Considerations

**API Keys:**
- Never commit .env to git
- Use environment variables
- Rotate keys periodically
- Monitor usage

**User Privacy:**
- No tracking implemented
- No personal data collected
- Locations not stored
- Client-side only

**XSS Prevention:**
- React auto-escapes
- No dangerouslySetInnerHTML
- Validated inputs
- Sanitized API responses

---

## Hardware Interface Documentation

### IoT Sensor Integration

**Reference:** `docs/HARDWARE_INTERFACE.md`

**Purpose:** Define data contract between IoT sensor nodes and software application

**Data Packet Structure:**
```json
{
  "node_id": "sensor_001",
  "timestamp": 1704067200,
  "location": {
    "lat": 51.5074,
    "lng": -0.1278
  },
  "measurements": {
    "aqi": 45,
    "pm25": 12.5,
    "pm10": 25.0,
    "co2": 400,
    "temperature": 22.5,
    "humidity": 60
  },
  "status": "active"
}
```

**API Endpoint (Planned):**
- Method: POST
- URL: Cloud database or Firebase
- Frequency: Every 5 minutes
- Authentication: API key or OAuth

**Sensor Requirements:**
- GPS module (lat/lng accuracy)
- PM2.5/PM10 sensor
- Optional: CO2, temperature, humidity
- WiFi/cellular connectivity
- Battery or solar powered

**Software Integration:**
- Parse incoming JSON
- Validate data structure
- Store in time-series database
- Update AQI zones dynamically
- Trigger route recalculation

**Security:**
- HTTPS only
- API key authentication
- Data validation
- Rate limiting
- Anomaly detection

---

## Machine Learning Analysis

### AQI Prediction Research

**Reference:** `analysis/aqi_ml_analysis.ipynb`

**Purpose:** Explore ML models for AQI forecasting

**Potential Models:**
- Time series (ARIMA, LSTM)
- Regression (Random Forest, XGBoost)
- Neural networks
- Ensemble methods

**Features:**
- Historical AQI data
- Weather data
- Traffic patterns
- Time of day/week
- Seasonal factors

**Applications:**
- Predict future AQI
- Recommend optimal departure times
- Alert high AQI periods
- Long-term trend analysis

**Status:** Research phase, not yet integrated

---

## Project Statistics

### Codebase Metrics

**Total Files:** 22
- Components: 7
- Services: 2
- Data: 2
- Utils: 2
- Config: 4
- Documentation: 3
- Analysis: 1
- Other: 1

**Lines of Code (approx):**
- JavaScript: ~3500 lines
- CSS: ~1000 lines
- HTML: ~20 lines
- Markdown: ~800 lines
- Total: ~5320 lines

**Component Breakdown:**
- App.js: ~440 lines
- MapComponent.js: ~315 lines
- routingService.js: ~380 lines
- aqiService.js: ~420 lines
- aqiData.js: ~320 lines

### Dependencies

**Production:**
- react: 18.2.0
- react-dom: 18.2.0
- react-scripts: 5.0.1
- leaflet: 1.9.4
- react-leaflet: 4.2.1

**Total:** 5 direct dependencies
**Bundle Size:** ~150KB gzipped

### API Usage (Estimated)

**OpenRouteService:**
- ~2-10 requests per route calculation
- ~100-500 requests per day (active user)
- Within free tier (5000/day)

**Nominatim:**
- ~2-5 requests per location search
- ~50-200 requests per day
- Within usage policy (1/sec max)

---

## Acknowledgments

### Third-Party Services

**OpenRouteService**
- Free routing API
- Alternative routes support
- Multiple travel modes
- Excellent documentation

**OpenStreetMap**
- Free map tiles
- Nominatim geocoding
- Community-driven data
- Global coverage

**Leaflet.js**
- Open-source mapping library
- Lightweight and performant
- Extensive plugin ecosystem
- Great React integration

### Inspirations

- Google Maps (UI/UX design)
- Citymapper (route alternatives)
- Waze (real-time updates)
- BreezoMeter (AQI visualization)

---

## License

**Project License:** MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Contact & Support

### Project Repository
GitHub: [weighted-routing-app](https://github.com/YOUR_USERNAME/weighted-routing-app)

### Issues & Bugs
Please report issues on GitHub Issues page with:
- Description of problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information
- Screenshots if applicable

### Feature Requests
Submit feature requests via GitHub Issues with:
- Clear description of feature
- Use case and benefits
- Example implementation (if possible)

---

## Conclusion

The **Smart Route Planner** successfully demonstrates a novel approach to route optimization by integrating air quality data into traditional routing algorithms. The project showcases:

✅ **Technical Excellence:** Modern React architecture with clean, maintainable code  
✅ **User-Centric Design:** Intuitive interface with rich feature set  
✅ **Real-World Application:** Practical solution to environmental health concerns  
✅ **Scalability:** Prepared for IoT integration and real API deployment  
✅ **Innovation:** Unique multi-factor weighted routing approach  

The foundation is solid for expansion into a production-ready, commercially viable application that can make a real difference in helping people make healthier routing decisions.

**Current Status:** ✅ Functional MVP with simulation  
**Next Phase:** 🔄 Real API integration and IoT deployment  
**Long-term Vision:** 🚀 Mobile apps, community features, and ML-powered predictions

---

*Document Version: 1.0*  
*Last Updated: January 7, 2026*  
*Author: FYP Development Team*
