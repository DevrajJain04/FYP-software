"""OpenRouteService integration for detailed turn-by-turn navigation."""

import httpx
import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from enum import Enum

from app.core.config import settings

logger = logging.getLogger(__name__)


class ManeuverType(str, Enum):
    """Types of navigation maneuvers."""
    DEPART = "depart"
    ARRIVE = "arrive"
    TURN_LEFT = "turn-left"
    TURN_RIGHT = "turn-right"
    TURN_SLIGHT_LEFT = "turn-slight-left"
    TURN_SLIGHT_RIGHT = "turn-slight-right"
    TURN_SHARP_LEFT = "turn-sharp-left"
    TURN_SHARP_RIGHT = "turn-sharp-right"
    CONTINUE = "continue"
    KEEP_LEFT = "keep-left"
    KEEP_RIGHT = "keep-right"
    ROUNDABOUT = "roundabout"
    EXIT_ROUNDABOUT = "exit-roundabout"
    MERGE = "merge"
    RAMP = "on-ramp"
    OFF_RAMP = "off-ramp"
    FORK = "fork"
    END_OF_ROAD = "end-of-road"
    NOTIFICATION = "notification"
    UNKNOWN = "unknown"


@dataclass
class NavigationStep:
    """A single navigation instruction."""
    instruction: str  # Human-readable instruction
    distance_m: float  # Distance for this step in meters
    duration_s: float  # Duration for this step in seconds
    maneuver_type: str  # Type of maneuver (turn, merge, etc.)
    road_name: Optional[str]  # Name of the road
    exit_number: Optional[int]  # For roundabouts
    coordinates: List[List[float]]  # [lng, lat] points for this step
    bearing_before: Optional[float]  # Bearing entering the maneuver
    bearing_after: Optional[float]  # Bearing exiting the maneuver


@dataclass  
class DetailedRoute:
    """Complete route with detailed navigation."""
    coordinates: List[List[float]]  # Full route geometry [lng, lat]
    total_distance_m: float
    total_duration_s: float
    steps: List[NavigationStep]
    summary: str  # Route summary (main roads used)
    warnings: List[str]  # Any route warnings
    bbox: List[float]  # Bounding box [min_lng, min_lat, max_lng, max_lat]


class OpenRouteServiceClient:
    """Client for OpenRouteService API."""
    
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.ORS_API_KEY
        self.base_url = base_url or settings.ORS_BASE_URL
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "Authorization": self.api_key,
                    "Content-Type": "application/json",
                }
            )
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    def _parse_maneuver_type(self, ors_type: int) -> str:
        """Convert ORS maneuver type code to readable type."""
        # ORS type codes: https://openrouteservice.org/dev/#/api-docs/v2/directions
        type_map = {
            0: ManeuverType.TURN_LEFT.value,
            1: ManeuverType.TURN_RIGHT.value,
            2: ManeuverType.TURN_SHARP_LEFT.value,
            3: ManeuverType.TURN_SHARP_RIGHT.value,
            4: ManeuverType.TURN_SLIGHT_LEFT.value,
            5: ManeuverType.TURN_SLIGHT_RIGHT.value,
            6: ManeuverType.CONTINUE.value,
            7: ManeuverType.ROUNDABOUT.value,
            8: ManeuverType.EXIT_ROUNDABOUT.value,
            9: ManeuverType.DEPART.value,
            10: ManeuverType.ARRIVE.value,
            11: ManeuverType.KEEP_LEFT.value,
            12: ManeuverType.KEEP_RIGHT.value,
            13: ManeuverType.FORK.value,
        }
        return type_map.get(ors_type, ManeuverType.UNKNOWN.value)
    
    def _parse_step(
        self, 
        segment_step: Dict[str, Any], 
        geometry_coords: List[List[float]]
    ) -> NavigationStep:
        """Parse an ORS step into NavigationStep."""
        way_points = segment_step.get("way_points", [0, 0])
        start_idx, end_idx = way_points[0], way_points[1]
        
        # Extract coordinates for this step
        step_coords = geometry_coords[start_idx:end_idx + 1]
        
        return NavigationStep(
            instruction=segment_step.get("instruction", "Continue"),
            distance_m=segment_step.get("distance", 0),
            duration_s=segment_step.get("duration", 0),
            maneuver_type=self._parse_maneuver_type(segment_step.get("type", 6)),
            road_name=segment_step.get("name", None),
            exit_number=segment_step.get("exit_number", None),
            coordinates=step_coords,
            bearing_before=segment_step.get("maneuver", {}).get("bearing_before"),
            bearing_after=segment_step.get("maneuver", {}).get("bearing_after"),
        )
    
    async def get_directions(
        self,
        coordinates: List[List[float]],
        profile: str = "driving-car",
        language: str = "en",
        units: str = "m",
        geometry: bool = True,
        instructions: bool = True,
    ) -> Optional[DetailedRoute]:
        """
        Get detailed directions from OpenRouteService.
        
        Args:
            coordinates: List of [lng, lat] waypoints (at least 2 points: origin, destination)
            profile: Routing profile - "driving-car", "driving-hgv", "cycling-regular", "foot-walking"
            language: Language for instructions
            units: Unit system - "m" (meters), "km", "mi" (miles)
            geometry: Include route geometry
            instructions: Include turn-by-turn instructions
            
        Returns:
            DetailedRoute with navigation steps, or None if failed
        """
        if not self.api_key:
            logger.warning("ORS_API_KEY not configured, cannot get detailed directions")
            return None
        
        if len(coordinates) < 2:
            logger.error("Need at least 2 coordinates for directions")
            return None
        
        client = await self._get_client()
        
        try:
            # ORS directions API endpoint
            url = f"{self.base_url}/v2/directions/{profile}"
            
            payload = {
                "coordinates": coordinates,
                "language": language,
                "units": units,
                "geometry": geometry,
                "instructions": instructions,
                "instructions_format": "text",
                "maneuvers": True,
            }
            
            response = await client.post(url, json=payload)
            
            if response.status_code == 401:
                logger.error("ORS API key is invalid or unauthorized")
                return None
            elif response.status_code == 429:
                logger.warning("ORS rate limit exceeded")
                return None
            elif response.status_code != 200:
                logger.error(f"ORS API error: {response.status_code} - {response.text}")
                return None
            
            data = response.json()
            
            # Parse the response
            if "routes" not in data or not data["routes"]:
                logger.warning("No routes returned from ORS")
                return None
            
            route = data["routes"][0]
            summary = route.get("summary", {})
            
            # Decode geometry (ORS returns encoded polyline by default in geojson format)
            geometry_data = route.get("geometry", {})
            if isinstance(geometry_data, dict):
                # GeoJSON format
                route_coords = geometry_data.get("coordinates", [])
            else:
                # Encoded polyline - decode it
                route_coords = self._decode_polyline(geometry_data)
            
            # Parse navigation steps
            steps: List[NavigationStep] = []
            segments = route.get("segments", [])
            
            for segment in segments:
                for step_data in segment.get("steps", []):
                    step = self._parse_step(step_data, route_coords)
                    steps.append(step)
            
            # Extract warnings
            warnings = []
            if "warnings" in route:
                for warning in route["warnings"]:
                    warnings.append(warning.get("message", str(warning)))
            
            # Build summary string
            summary_str = f"{summary.get('distance', 0) / 1000:.1f} km, {summary.get('duration', 0) / 60:.0f} min"
            
            return DetailedRoute(
                coordinates=route_coords,
                total_distance_m=summary.get("distance", 0),
                total_duration_s=summary.get("duration", 0),
                steps=steps,
                summary=summary_str,
                warnings=warnings,
                bbox=route.get("bbox", []),
            )
            
        except httpx.TimeoutException:
            logger.error("ORS API request timed out")
            return None
        except Exception as e:
            logger.error(f"Error calling ORS API: {e}", exc_info=True)
            return None
    
    def _decode_polyline(self, encoded: str, precision: int = 5) -> List[List[float]]:
        """Decode an encoded polyline string."""
        coordinates = []
        index = 0
        lat = 0
        lng = 0
        
        while index < len(encoded):
            # Decode latitude
            shift = 0
            result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            lat += (~(result >> 1) if result & 1 else result >> 1)
            
            # Decode longitude
            shift = 0
            result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            lng += (~(result >> 1) if result & 1 else result >> 1)
            
            # ORS uses precision of 5 by default
            coordinates.append([lng / (10 ** precision), lat / (10 ** precision)])
        
        return coordinates
    
    async def get_detailed_navigation_for_route(
        self,
        route_coordinates: List[List[float]],
        profile: str = "driving-car",
        simplify: bool = True,
        max_waypoints: int = 50,
    ) -> Optional[DetailedRoute]:
        """
        Get detailed navigation for an existing route from our routing service.
        
        This takes the route coordinates from our AQI-weighted routing and
        sends key waypoints to ORS to get turn-by-turn navigation.
        
        Args:
            route_coordinates: Full route coordinates [lng, lat] from our routing service
            profile: ORS routing profile
            simplify: Whether to simplify the route to reduce waypoints
            max_waypoints: Maximum waypoints to send to ORS (API limit)
            
        Returns:
            DetailedRoute with navigation instructions
        """
        if len(route_coordinates) < 2:
            return None
        
        # Simplify waypoints to stay within ORS limits
        # ORS typically allows max 50 waypoints
        waypoints = self._simplify_waypoints(route_coordinates, max_waypoints)
        
        logger.info(f"Getting ORS navigation for {len(waypoints)} waypoints (from {len(route_coordinates)} original)")
        
        return await self.get_directions(
            coordinates=waypoints,
            profile=profile,
        )
    
    def _simplify_waypoints(
        self, 
        coords: List[List[float]], 
        max_points: int
    ) -> List[List[float]]:
        """
        Simplify waypoints to reduce the number of points.
        
        Uses Douglas-Peucker-like approach - keep start, end, and 
        evenly distributed points in between.
        """
        if len(coords) <= max_points:
            return coords
        
        # Always keep first and last
        result = [coords[0]]
        
        # Calculate step size for intermediate points
        step = (len(coords) - 1) / (max_points - 1)
        
        for i in range(1, max_points - 1):
            idx = int(i * step)
            result.append(coords[idx])
        
        result.append(coords[-1])
        
        return result


# Singleton instance
ors_client = OpenRouteServiceClient()


async def get_actionable_navigation(
    route_coordinates: List[List[float]],
    origin: Dict[str, float],
    destination: Dict[str, float],
    profile: str = "driving-car",
) -> Optional[Dict[str, Any]]:
    """
    Convert vague route coordinates to actionable turn-by-turn navigation.
    
    This function takes the route from our AQI-weighted routing algorithm
    and uses OpenRouteService to provide detailed navigation instructions
    like "Turn left onto Main Street" or "Take the A2 flyover".
    
    Args:
        route_coordinates: Route coordinates from our routing service [lng, lat]
        origin: Origin point {"lat": float, "lng": float}
        destination: Destination point {"lat": float, "lng": float}
        profile: ORS profile ("driving-car", "cycling-regular", etc.)
        
    Returns:
        Dict containing:
        - steps: List of navigation steps with instructions
        - total_distance_m: Total route distance
        - total_duration_s: Total route duration  
        - summary: Route summary
        - warnings: Any route warnings
        - geometry: Refined route geometry from ORS
    """
    if not route_coordinates:
        logger.warning("No route coordinates provided")
        return None
    
    # Ensure we have proper waypoints (origin first, destination last)
    # Our routing service might give [lng, lat], ORS expects [lng, lat] too
    waypoints = route_coordinates.copy()
    
    # Make sure origin is the first point
    origin_coord = [origin["lng"], origin["lat"]]
    if waypoints[0] != origin_coord:
        waypoints.insert(0, origin_coord)
    
    # Make sure destination is the last point
    dest_coord = [destination["lng"], destination["lat"]]
    if waypoints[-1] != dest_coord:
        waypoints.append(dest_coord)
    
    detailed_route = await ors_client.get_detailed_navigation_for_route(
        route_coordinates=waypoints,
        profile=profile,
    )
    
    if not detailed_route:
        return None
    
    # Convert to JSON-serializable format
    return {
        "steps": [
            {
                "instruction": step.instruction,
                "distance_m": step.distance_m,
                "duration_s": step.duration_s,
                "maneuver_type": step.maneuver_type,
                "road_name": step.road_name,
                "exit_number": step.exit_number,
                "coordinates": step.coordinates,
                "bearing_before": step.bearing_before,
                "bearing_after": step.bearing_after,
            }
            for step in detailed_route.steps
        ],
        "total_distance_m": detailed_route.total_distance_m,
        "total_duration_s": detailed_route.total_duration_s,
        "summary": detailed_route.summary,
        "warnings": detailed_route.warnings,
        "geometry": detailed_route.coordinates,
        "bbox": detailed_route.bbox,
    }
