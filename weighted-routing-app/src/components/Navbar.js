import React from 'react';
import { NavLink } from 'react-router-dom';

/**
 * Navbar - Navigation component for the application
 * Note: Simulator link is intentionally excluded (hidden route)
 */
const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <NavLink to="/" className="brand-link">
          <span className="brand-icon">🌿</span>
          <span className="brand-text">Green Corridor</span>
        </NavLink>
      </div>

      <div className="navbar-menu">
        <NavLink 
          to="/" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          end
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-text">Dashboard</span>
        </NavLink>

        <NavLink 
          to="/route" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">🧭</span>
          <span className="nav-text">Route Planner</span>
        </NavLink>

        <NavLink 
          to="/aqi-map" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">🗺️</span>
          <span className="nav-text">AQI Map</span>
        </NavLink>

        <NavLink 
          to="/stations" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">📍</span>
          <span className="nav-text">Stations</span>
        </NavLink>
      </div>

      {/* Simulator link is intentionally NOT shown here */}
      {/* Access via direct URL: /dev/simulator */}
    </nav>
  );
};

export default Navbar;
