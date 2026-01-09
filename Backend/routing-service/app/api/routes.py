"""API routes for the Routing Service."""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import uuid
import logging
import h3

from app.models import (
    RouteRequest,
    RouteResponse,
    MultiRouteResponse,
    RouteStep,
    HexagonAQI,
    AreaAQIRequest,
    AreaAQIResponse,
    Coordinate,
    ErrorResponse,
    NavigationRequest,
    NavigationResponse,
    NavigationStepResponse,
    DetailedRouteResponse,
)
from app.services.redis_service import redis_service
from app.services.graph_service import graph_service
from app.services import (
    create_cost_function,
    find_alternative_routes,
    calculate_route_metrics,
    get_actionable_navigation,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/route", response_model=MultiRouteResponse)
async def calculate_route(request: RouteRequest):
    """
    Calculate optimal route(s) between origin and destination.
    
    The routing algorithm balances travel time and air quality based on the
    `balance` parameter:
    - balance = 0: Optimize purely for fastest route
    - balance = 1: Optimize purely for cleanest air
    - balance = 0.5: Equal weight to both factors
    
    Returns multiple alternative routes when available.
    """
    try:
        logger.info(
            f"Route request: {request.origin} -> {request.destination}, "
            f"balance={request.balance}, alternatives={request.alternatives}"
        )
        
        # Step 1: Fetch road network graph
        G = graph_service.get_graph_for_route(
            request.origin.lat,
            request.origin.lng,
            request.destination.lat,
            request.destination.lng,
            buffer_km=3.0  # Allow for route alternatives
        )
        
        # Step 2: Get all hexagons the graph covers
        all_hexagons = graph_service.get_all_edge_hexagons(G)
        logger.info(f"Graph covers {len(all_hexagons)} hexagons")
        
        # Step 3: Fetch AQI data for those hexagons from Redis
        aqi_data = await redis_service.get_multiple_hexagons_aqi(all_hexagons)
        logger.info(f"Got AQI data for {len(aqi_data)} hexagons")
        
        # Step 4: Enrich graph edges with AQI values
        G = graph_service.enrich_graph_with_aqi(G, aqi_data)
        
        # Step 5: Find nearest nodes to origin and destination
        origin_node = graph_service.get_nearest_node(
            G, request.origin.lat, request.origin.lng
        )
        dest_node = graph_service.get_nearest_node(
            G, request.destination.lat, request.destination.lng
        )
        
        logger.info(f"Routing from node {origin_node} to {dest_node}")
        
        # Step 6: Create weighted cost function
        cost_function = create_cost_function(request.balance)
        
        # Step 7: Find alternative routes
        routes_data = find_alternative_routes(
            G, origin_node, dest_node, cost_function,
            num_alternatives=request.alternatives
        )
        
        if not routes_data:
            raise HTTPException(
                status_code=404,
                detail="No route found between the specified points"
            )
        
        # Step 8: Build response
        routes = []
        for path, cost in routes_data:
            # Extract route geometry
            coordinates = graph_service.extract_route_geometry(G, path)
            
            # Calculate route metrics
            metrics = calculate_route_metrics(G, path)
            
            route = RouteResponse(
                route_id=str(uuid.uuid4()),
                coordinates=coordinates,
                total_distance_m=metrics['total_distance_m'],
                total_duration_s=metrics['total_duration_s'],
                average_aqi=metrics['average_aqi'],
                max_aqi=metrics['max_aqi'],
                weighted_cost=cost,
                steps=[],  # Simplified for now
                metadata={
                    "node_count": len(path),
                    "aqi_data_coverage": len(aqi_data) / len(all_hexagons) if all_hexagons else 0
                }
            )
            routes.append(route)
        
        return MultiRouteResponse(
            routes=routes,
            origin=request.origin,
            destination=request.destination,
            balance=request.balance,
            calculated_at=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Route calculation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate route: {str(e)}"
        )


@router.get("/aqi/hexagon/{hex_id}", response_model=HexagonAQI)
async def get_hexagon_aqi(hex_id: str):
    """
    Get AQI data for a specific hexagon.
    """
    try:
        # Validate hexagon ID
        if not h3.h3_is_valid(hex_id):
            raise HTTPException(status_code=400, detail="Invalid H3 hexagon ID")
        
        median_aqi, vehicle_count = await redis_service.get_hexagon_aqi_with_count(hex_id)
        
        if median_aqi is None:
            raise HTTPException(
                status_code=404,
                detail=f"No AQI data for hexagon {hex_id}"
            )
        
        # Get hexagon center
        lat, lng = h3.h3_to_geo(hex_id)
        
        return HexagonAQI(
            hexagon_id=hex_id,
            median_aqi=median_aqi,
            vehicle_count=vehicle_count,
            center=Coordinate(lat=lat, lng=lng)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting hexagon AQI: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/aqi/area", response_model=AreaAQIResponse)
async def get_area_aqi(request: AreaAQIRequest):
    """
    Get AQI heatmap data for an area defined by bounding box.
    
    Returns all hexagons with AQI data within the specified bounds.
    """
    try:
        # Get all hexagons with data
        all_hex_ids = await redis_service.get_all_hexagon_keys()
        
        # Filter to those within bounds
        hexagons_in_bounds = []
        
        for hex_id in all_hex_ids:
            try:
                lat, lng = h3.h3_to_geo(hex_id)
                
                if (request.south <= lat <= request.north and
                    request.west <= lng <= request.east):
                    
                    median_aqi, vehicle_count = await redis_service.get_hexagon_aqi_with_count(hex_id)
                    
                    if median_aqi is not None:
                        hexagons_in_bounds.append(HexagonAQI(
                            hexagon_id=hex_id,
                            median_aqi=median_aqi,
                            vehicle_count=vehicle_count,
                            center=Coordinate(lat=lat, lng=lng)
                        ))
            except Exception as e:
                logger.warning(f"Error processing hexagon {hex_id}: {e}")
                continue
        
        return AreaAQIResponse(
            hexagons=hexagons_in_bounds,
            bounds={
                "north": request.north,
                "south": request.south,
                "east": request.east,
                "west": request.west
            },
            total_hexagons=len(hexagons_in_bounds)
        )
        
    except Exception as e:
        logger.error(f"Error getting area AQI: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats():
    """
    Get routing service statistics.
    """
    try:
        all_hex_ids = await redis_service.get_all_hexagon_keys()
        
        return {
            "service": "routing-service",
            "hexagons_with_data": len(all_hex_ids),
            "h3_resolution": settings.H3_RESOLUTION,
            "graph_cache_ttl": settings.GRAPH_CACHE_TTL,
            "default_balance": settings.DEFAULT_BALANCE,
            "ors_enabled": bool(settings.ORS_API_KEY),
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/navigation", response_model=NavigationResponse)
async def get_turn_by_turn_navigation(request: NavigationRequest):
    """
    Get detailed turn-by-turn navigation for a route.
    
    Takes route coordinates from the /route endpoint and returns
    actionable navigation instructions including:
    - Turn-by-turn directions (e.g., "Turn left onto Main Street")
    - Flyover/bridge/tunnel information
    - Roundabout exits
    - Highway merge/exit instructions
    - Road names and distances
    
    Requires ORS_API_KEY environment variable to be set.
    Get a free key from: https://openrouteservice.org/dev/#/signup
    """
    try:
        if not settings.ORS_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="OpenRouteService not configured. Set ORS_API_KEY environment variable. "
                       "Get a free key from https://openrouteservice.org/dev/#/signup"
            )
        
        logger.info(
            f"Navigation request: {request.origin} -> {request.destination}, "
            f"profile={request.profile}, waypoints={len(request.route_coordinates)}"
        )
        
        navigation_data = await get_actionable_navigation(
            route_coordinates=request.route_coordinates,
            origin={"lat": request.origin.lat, "lng": request.origin.lng},
            destination={"lat": request.destination.lat, "lng": request.destination.lng},
            profile=request.profile,
        )
        
        if not navigation_data:
            raise HTTPException(
                status_code=502,
                detail="Failed to get navigation from OpenRouteService. Check API key and try again."
            )
        
        return NavigationResponse(
            steps=[
                NavigationStepResponse(**step) 
                for step in navigation_data["steps"]
            ],
            total_distance_m=navigation_data["total_distance_m"],
            total_duration_s=navigation_data["total_duration_s"],
            summary=navigation_data["summary"],
            warnings=navigation_data.get("warnings", []),
            geometry=navigation_data["geometry"],
            bbox=navigation_data.get("bbox", []),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Navigation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get navigation: {str(e)}"
        )


@router.post("/route/detailed", response_model=DetailedRouteResponse)
async def calculate_route_with_navigation(request: RouteRequest):
    """
    Calculate route with both AQI optimization AND turn-by-turn navigation.
    
    This is a combined endpoint that:
    1. Calculates the optimal AQI-weighted route using our algorithm
    2. Enriches it with detailed navigation from OpenRouteService
    
    Returns the best single route (not alternatives) with full navigation.
    Use /route for alternatives without navigation, then /navigation for details.
    
    Requires ORS_API_KEY for navigation portion.
    """
    try:
        logger.info(
            f"Detailed route request: {request.origin} -> {request.destination}, "
            f"balance={request.balance}"
        )
        
        # Step 1-7: Same as regular route calculation
        G = graph_service.get_graph_for_route(
            request.origin.lat,
            request.origin.lng,
            request.destination.lat,
            request.destination.lng,
            buffer_km=3.0
        )
        
        all_hexagons = graph_service.get_all_edge_hexagons(G)
        aqi_data = await redis_service.get_multiple_hexagons_aqi(all_hexagons)
        G = graph_service.enrich_graph_with_aqi(G, aqi_data)
        
        origin_node = graph_service.get_nearest_node(
            G, request.origin.lat, request.origin.lng
        )
        dest_node = graph_service.get_nearest_node(
            G, request.destination.lat, request.destination.lng
        )
        
        cost_function = create_cost_function(request.balance)
        routes_data = find_alternative_routes(
            G, origin_node, dest_node, cost_function, num_alternatives=1
        )
        
        if not routes_data:
            raise HTTPException(
                status_code=404,
                detail="No route found between the specified points"
            )
        
        path, cost = routes_data[0]
        coordinates = graph_service.extract_route_geometry(G, path)
        metrics = calculate_route_metrics(G, path)
        
        route_id = str(uuid.uuid4())
        
        # Step 8: Get turn-by-turn navigation if ORS is configured
        navigation = None
        if settings.ORS_API_KEY:
            try:
                navigation_data = await get_actionable_navigation(
                    route_coordinates=coordinates,
                    origin={"lat": request.origin.lat, "lng": request.origin.lng},
                    destination={"lat": request.destination.lat, "lng": request.destination.lng},
                )
                
                if navigation_data:
                    navigation = NavigationResponse(
                        steps=[
                            NavigationStepResponse(**step) 
                            for step in navigation_data["steps"]
                        ],
                        total_distance_m=navigation_data["total_distance_m"],
                        total_duration_s=navigation_data["total_duration_s"],
                        summary=navigation_data["summary"],
                        warnings=navigation_data.get("warnings", []),
                        geometry=navigation_data["geometry"],
                        bbox=navigation_data.get("bbox", []),
                    )
            except Exception as e:
                logger.warning(f"Failed to get ORS navigation: {e}")
                # Continue without navigation
        
        return DetailedRouteResponse(
            route_id=route_id,
            coordinates=coordinates,
            total_distance_m=metrics['total_distance_m'],
            total_duration_s=metrics['total_duration_s'],
            average_aqi=metrics['average_aqi'],
            max_aqi=metrics['max_aqi'],
            weighted_cost=cost,
            navigation=navigation,
            metadata={
                "node_count": len(path),
                "aqi_data_coverage": len(aqi_data) / len(all_hexagons) if all_hexagons else 0,
                "ors_enabled": bool(settings.ORS_API_KEY),
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detailed route calculation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate detailed route: {str(e)}"
        )
