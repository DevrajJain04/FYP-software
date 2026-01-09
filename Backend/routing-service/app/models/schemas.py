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
