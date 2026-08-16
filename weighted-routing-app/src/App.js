import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import { HomePage, RoutePlanner, AQIMap, StationsPage, SimulatorPage } from './pages';
import 'leaflet/dist/leaflet.css';
import './index.css';

/**
 * Green Corridor - Main Application
 * 
 * Routes:
 *   /              - Dashboard (HomePage)
 *   /route         - Route Planner
 *   /aqi-map       - AQI Heatmap
 *   /stations      - Monitoring Stations
 *   /dev/simulator - Hidden simulator (not linked in nav)
 */
function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/route" element={<RoutePlanner />} />
            <Route path="/aqi-map" element={<AQIMap />} />
            <Route path="/stations" element={<StationsPage />} />
            {/* Hidden simulator - not linked in navigation */}
            <Route path="/dev/simulator" element={<SimulatorPage />} />
            {/* 404 fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

/**
 * 404 Not Found Component
 */
const NotFound = () => (
  <div className="page not-found-page">
    <div className="not-found-content">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/" className="btn btn-primary">Go to Dashboard</a>
    </div>
  </div>
);

export default App;
