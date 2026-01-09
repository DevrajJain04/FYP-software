"""Graph service for road network operations using OSMnx."""

import osmnx as ox
import networkx as nx
import h3
from typing import Dict, List, Tuple, Optional
from cachetools import TTLCache
import logging
from functools import lru_cache
import hashlib

from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure OSMnx
ox.settings.use_cache = True
ox.settings.log_console = False


class GraphService:
    """Service for road network graph operations."""
    
    def __init__(self):
        # Cache for road graphs (keyed by bounding box hash)
        self._graph_cache: TTLCache = TTLCache(
            maxsize=10,
            ttl=settings.GRAPH_CACHE_TTL
        )
    
    def _get_cache_key(self, north: float, south: float, east: float, west: float) -> str:
        """Generate cache key for a bounding box."""
        # Round to 3 decimal places for cache efficiency
        key_str = f"{north:.3f}_{south:.3f}_{east:.3f}_{west:.3f}"
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def get_road_graph(
        self,
        north: float,
        south: float,
        east: float,
        west: float,
        network_type: str = "drive"
    ) -> nx.MultiDiGraph:
        """
        Fetch road network graph for a bounding box.
        
        Uses caching to avoid repeated API calls.
        """
        cache_key = self._get_cache_key(north, south, east, west)
        
        # Check cache first
        if cache_key in self._graph_cache:
            logger.info(f"Using cached graph for bbox: {cache_key}")
            return self._graph_cache[cache_key]
        
        logger.info(f"Fetching new graph for bbox: N={north}, S={south}, E={east}, W={west}")
        
        try:
            # Fetch the graph from OSM
            G = ox.graph_from_bbox(
                bbox=(north, south, east, west),
                network_type=network_type,
                simplify=True,
                truncate_by_edge=True
            )
            
            # Add edge attributes for routing
            G = ox.add_edge_speeds(G)
            G = ox.add_edge_travel_times(G)
            
            # Cache the graph
            self._graph_cache[cache_key] = G
            
            logger.info(f"Graph loaded: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
            
            return G
            
        except Exception as e:
            logger.error(f"Error fetching road graph: {e}")
            raise
    
    def get_graph_for_route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        buffer_km: float = 2.0
    ) -> nx.MultiDiGraph:
        """
        Get a road graph that covers the area between origin and destination.
        
        Adds a buffer around the bounding box to allow for route alternatives.
        """
        # Calculate bounding box with buffer
        buffer_deg = buffer_km / 111.0  # Approximate km to degrees
        
        north = max(origin_lat, dest_lat) + buffer_deg
        south = min(origin_lat, dest_lat) - buffer_deg
        east = max(origin_lng, dest_lng) + buffer_deg
        west = min(origin_lng, dest_lng) - buffer_deg
        
        return self.get_road_graph(north, south, east, west)
    
    def get_nearest_node(self, G: nx.MultiDiGraph, lat: float, lng: float) -> int:
        """Find the nearest node in the graph to a coordinate."""
        return ox.nearest_nodes(G, lng, lat)
    
    def get_edge_hexagons(
        self,
        G: nx.MultiDiGraph,
        u: int,
        v: int,
        resolution: int = None
    ) -> List[str]:
        """
        Get H3 hexagon IDs that an edge passes through.
        
        Uses the edge geometry if available, otherwise interpolates between nodes.
        """
        resolution = resolution or settings.H3_RESOLUTION
        
        # Get node coordinates
        u_data = G.nodes[u]
        v_data = G.nodes[v]
        
        # Get edge data (may have multiple edges between same nodes)
        edge_data = G.get_edge_data(u, v)
        if edge_data is None:
            return []
        
        # Use first edge if multiple exist
        if isinstance(edge_data, dict) and 0 in edge_data:
            edge_data = edge_data[0]
        
        hexagons = set()
        
        # If edge has geometry, use it
        if 'geometry' in edge_data:
            coords = list(edge_data['geometry'].coords)
            for lng, lat in coords:
                hex_id = h3.geo_to_h3(lat, lng, resolution)
                hexagons.add(hex_id)
        else:
            # Interpolate between nodes
            start_lat, start_lng = u_data['y'], u_data['x']
            end_lat, end_lng = v_data['y'], v_data['x']
            
            # Add start and end hexagons
            hexagons.add(h3.geo_to_h3(start_lat, start_lng, resolution))
            hexagons.add(h3.geo_to_h3(end_lat, end_lng, resolution))
            
            # Interpolate points along edge (every ~50m)
            edge_length = edge_data.get('length', 100)
            num_points = max(2, int(edge_length / 50))
            
            for i in range(1, num_points):
                t = i / num_points
                lat = start_lat + t * (end_lat - start_lat)
                lng = start_lng + t * (end_lng - start_lng)
                hexagons.add(h3.geo_to_h3(lat, lng, resolution))
        
        return list(hexagons)
    
    def enrich_graph_with_aqi(
        self,
        G: nx.MultiDiGraph,
        aqi_data: Dict[str, float],
        default_aqi: float = None
    ) -> nx.MultiDiGraph:
        """
        Add AQI values to graph edges based on hexagon data.
        
        For each edge, calculates the average AQI of hexagons it passes through.
        """
        default_aqi = default_aqi or settings.DEFAULT_AQI
        
        for u, v, key, data in G.edges(keys=True, data=True):
            # Get hexagons this edge passes through
            hexagons = self.get_edge_hexagons(G, u, v)
            
            # Collect AQI values for these hexagons
            edge_aqi_values = []
            for hex_id in hexagons:
                if hex_id in aqi_data:
                    edge_aqi_values.append(aqi_data[hex_id])
            
            # Calculate edge AQI
            if edge_aqi_values:
                data['aqi'] = sum(edge_aqi_values) / len(edge_aqi_values)
            else:
                data['aqi'] = default_aqi
            
            # Store hexagon coverage for debugging
            data['hexagon_count'] = len(hexagons)
            data['aqi_data_coverage'] = len(edge_aqi_values) / len(hexagons) if hexagons else 0
        
        return G
    
    def get_all_edge_hexagons(self, G: nx.MultiDiGraph) -> List[str]:
        """Get all unique hexagon IDs that the graph edges pass through."""
        all_hexagons = set()
        
        for u, v in G.edges():
            hexagons = self.get_edge_hexagons(G, u, v)
            all_hexagons.update(hexagons)
        
        return list(all_hexagons)
    
    def extract_route_geometry(
        self,
        G: nx.MultiDiGraph,
        path: List[int]
    ) -> List[List[float]]:
        """
        Extract route geometry as list of [lng, lat] coordinates.
        """
        coords = []
        
        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            
            # Get edge data
            edge_data = G.get_edge_data(u, v)
            if edge_data and 0 in edge_data:
                edge_data = edge_data[0]
            
            if edge_data and 'geometry' in edge_data:
                # Use edge geometry
                edge_coords = list(edge_data['geometry'].coords)
                coords.extend([[lng, lat] for lng, lat in edge_coords])
            else:
                # Use node coordinates
                coords.append([G.nodes[u]['x'], G.nodes[u]['y']])
        
        # Add final node
        if path:
            coords.append([G.nodes[path[-1]]['x'], G.nodes[path[-1]]['y']])
        
        # Remove duplicates while preserving order
        unique_coords = []
        for coord in coords:
            if not unique_coords or coord != unique_coords[-1]:
                unique_coords.append(coord)
        
        return unique_coords


# Global singleton instance
graph_service = GraphService()
