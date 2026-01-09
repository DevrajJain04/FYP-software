"""Pydantic models for API requests and responses."""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime


class Coordinate(BaseModel):
    """Geographic coordinate."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")


class RouteRequest(BaseModel):
    """Request model for route calculation."""
    origin: Coordinate = Field(..., description="Starting point")
    destination: Coordinate = Field(..., description="End point")
    balance: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Balance between time (0) and AQI (1). 0.5 = equal weight"
    )
    alternatives: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Number of alternative routes to return"
    )
    
    @field_validator('balance')
    @classmethod
    def validate_balance(cls, v):
        """Ensure balance is between 0 and 1."""
        if not 0 <= v <= 1:
            raise ValueError("Balance must be between 0 and 1")
        return v


class RouteStep(BaseModel):
    """A step in the route with coordinates and metadata."""
    coordinates: List[List[float]] = Field(..., description="List of [lng, lat] points")
    distance_m: float = Field(..., description="Distance in meters")
    duration_s: float = Field(..., description="Duration in seconds")
    aqi: float = Field(..., description="Average AQI for this segment")
    street_name: Optional[str] = Field(None, description="Street name if available")


class RouteResponse(BaseModel):
    """Response model for a calculated route."""
    route_id: str = Field(..., description="Unique route identifier")
    coordinates: List[List[float]] = Field(..., description="Full route as [lng, lat] points")
    total_distance_m: float = Field(..., description="Total distance in meters")
    total_duration_s: float = Field(..., description="Total duration in seconds")
    average_aqi: float = Field(..., description="Average AQI along route")
    max_aqi: float = Field(..., description="Maximum AQI encountered")
    weighted_cost: float = Field(..., description="Combined weighted cost")
    steps: List[RouteStep] = Field(default=[], description="Route steps")
    metadata: dict = Field(default={}, description="Additional metadata")


class MultiRouteResponse(BaseModel):
    """Response containing multiple route alternatives."""
    routes: List[RouteResponse] = Field(..., description="List of route alternatives")
    origin: Coordinate = Field(..., description="Origin point")
    destination: Coordinate = Field(..., description="Destination point")
    balance: float = Field(..., description="Balance factor used")
    calculated_at: datetime = Field(default_factory=datetime.utcnow)


class HexagonAQI(BaseModel):
    """AQI data for a single hexagon."""
    hexagon_id: str = Field(..., description="H3 hexagon ID")
    median_aqi: float = Field(..., description="Median AQI value")
    vehicle_count: int = Field(..., description="Number of vehicles reporting")
    center: Coordinate = Field(..., description="Hexagon center point")


class AreaAQIRequest(BaseModel):
    """Request for AQI data in an area."""
    north: float = Field(..., ge=-90, le=90)
    south: float = Field(..., ge=-90, le=90)
    east: float = Field(..., ge=-180, le=180)
    west: float = Field(..., ge=-180, le=180)
    
    @field_validator('north')
    @classmethod
    def north_greater_than_south(cls, v, info):
        """Validate that north > south."""
        # This validation happens after all fields are set
        return v


class AreaAQIResponse(BaseModel):
    """Response with AQI heatmap data for an area."""
    hexagons: List[HexagonAQI] = Field(..., description="AQI data by hexagon")
    bounds: dict = Field(..., description="Bounding box of returned data")
    total_hexagons: int = Field(..., description="Total hexagons with data")


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[dict] = Field(None, description="Additional details")


# === Navigation / Turn-by-Turn Models ===

class NavigationStepResponse(BaseModel):
    """A single turn-by-turn navigation instruction."""
    instruction: str = Field(..., description="Human-readable instruction (e.g., 'Turn left onto Main St')")
    distance_m: float = Field(..., description="Distance for this step in meters")
    duration_s: float = Field(..., description="Duration for this step in seconds")
    maneuver_type: str = Field(..., description="Type of maneuver (turn-left, turn-right, roundabout, etc.)")
    road_name: Optional[str] = Field(None, description="Name of the road/street")
    exit_number: Optional[int] = Field(None, description="Exit number for roundabouts")
    coordinates: List[List[float]] = Field(..., description="[lng, lat] points for this step segment")
    bearing_before: Optional[float] = Field(None, description="Bearing when entering the maneuver")
    bearing_after: Optional[float] = Field(None, description="Bearing after completing the maneuver")


class NavigationRequest(BaseModel):
    """Request for turn-by-turn navigation."""
    route_coordinates: List[List[float]] = Field(
        ..., 
        description="Route coordinates as [lng, lat] points from the routing service"
    )
    origin: Coordinate = Field(..., description="Starting point")
    destination: Coordinate = Field(..., description="End point")
    profile: str = Field(
        default="driving-car",
        description="Routing profile: driving-car, driving-hgv, cycling-regular, foot-walking"
    )


class NavigationResponse(BaseModel):
    """Detailed turn-by-turn navigation response."""
    steps: List[NavigationStepResponse] = Field(..., description="Turn-by-turn navigation steps")
    total_distance_m: float = Field(..., description="Total route distance in meters")
    total_duration_s: float = Field(..., description="Total route duration in seconds")
    summary: str = Field(..., description="Route summary (e.g., '15.2 km, 23 min')")
    warnings: List[str] = Field(default=[], description="Route warnings")
    geometry: List[List[float]] = Field(..., description="Refined route geometry [lng, lat]")
    bbox: List[float] = Field(default=[], description="Bounding box [min_lng, min_lat, max_lng, max_lat]")


class DetailedRouteResponse(BaseModel):
    """Combined route response with AQI data and navigation."""
    route_id: str = Field(..., description="Unique route identifier")
    
    # From our AQI-weighted routing
    coordinates: List[List[float]] = Field(..., description="Route from AQI-weighted algorithm")
    total_distance_m: float = Field(..., description="Total distance in meters")
    total_duration_s: float = Field(..., description="Total duration in seconds")
    average_aqi: float = Field(..., description="Average AQI along route")
    max_aqi: float = Field(..., description="Maximum AQI encountered")
    weighted_cost: float = Field(..., description="Combined weighted cost")
    
    # Turn-by-turn navigation from ORS
    navigation: Optional[NavigationResponse] = Field(
        None, 
        description="Detailed turn-by-turn navigation (requires ORS_API_KEY)"
    )
    
    metadata: dict = Field(default={}, description="Additional metadata")
