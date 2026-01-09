"""Custom A* routing algorithm with AQI-weighted cost function."""

import networkx as nx
from heapq import heappush, heappop
from typing import List, Dict, Tuple, Optional, Callable
import math
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points in meters.
    """
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def create_cost_function(balance: float, default_aqi: float = None) -> Callable:
    """
    Create a weighted cost function for A* routing.
    
    Cost = (travel_time * (1 - balance)) + (aqi * balance * normalization_factor)
    
    Args:
        balance: Float between 0 and 1
                 0 = optimize purely for time
                 1 = optimize purely for AQI
                 0.5 = equal weight
        default_aqi: Default AQI value when no data available
    
    Returns:
        Cost function compatible with NetworkX
    """
    default_aqi = default_aqi or settings.DEFAULT_AQI
    
    # Normalization factor to make AQI and time comparable
    # Assuming average travel time per edge is ~30 seconds and average AQI is 50
    # We want them to contribute equally at balance=0.5
    aqi_normalization = 0.6  # Tune this based on real-world testing
    
    def cost_function(u: int, v: int, edge_data: dict) -> float:
        """
        Calculate the weighted cost for an edge.
        """
        # Get travel time (in seconds)
        travel_time = edge_data.get('travel_time', 30)  # Default 30 seconds
        
        # Get AQI value
        aqi = edge_data.get('aqi', default_aqi)
        
        # Calculate weighted cost
        time_cost = travel_time * (1 - balance)
        aqi_cost = aqi * aqi_normalization * balance
        
        return time_cost + aqi_cost
    
    return cost_function


def astar_path(
    G: nx.MultiDiGraph,
    source: int,
    target: int,
    cost_function: Callable,
    heuristic: Callable = None
) -> Tuple[List[int], float]:
    """
    Custom A* implementation with weighted cost function.
    
    Returns:
        Tuple of (path as list of node IDs, total cost)
    """
    if source == target:
        return [source], 0.0
    
    if source not in G or target not in G:
        raise nx.NodeNotFound(f"Source or target not in graph")
    
    # Default heuristic: straight-line distance
    if heuristic is None:
        target_lat = G.nodes[target]['y']
        target_lng = G.nodes[target]['x']
        
        def heuristic(node):
            node_lat = G.nodes[node]['y']
            node_lng = G.nodes[node]['x']
            # Return distance-based estimate (convert to approximate time)
            dist = haversine_distance(node_lat, node_lng, target_lat, target_lng)
            return dist / 50  # Assume 50 m/s max speed for admissibility
    
    # Priority queue: (f_score, counter, node)
    counter = 0
    open_set = [(heuristic(source), counter, source)]
    
    # Track where we came from
    came_from: Dict[int, int] = {}
    
    # g_score[node] = cost of cheapest path from source to node
    g_score: Dict[int, float] = {source: 0}
    
    # f_score[node] = g_score[node] + heuristic(node)
    f_score: Dict[int, float] = {source: heuristic(source)}
    
    # Track visited nodes
    closed_set = set()
    
    while open_set:
        _, _, current = heappop(open_set)
        
        if current == target:
            # Reconstruct path
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            path.reverse()
            return path, g_score[target]
        
        if current in closed_set:
            continue
        
        closed_set.add(current)
        
        # Explore neighbors
        for neighbor in G.successors(current):
            if neighbor in closed_set:
                continue
            
            # Get edge data (handle multi-edges by taking minimum cost)
            edge_data = G.get_edge_data(current, neighbor)
            if edge_data is None:
                continue
            
            # For MultiDiGraph, find minimum cost edge
            min_edge_cost = float('inf')
            for key, data in edge_data.items():
                edge_cost = cost_function(current, neighbor, data)
                min_edge_cost = min(min_edge_cost, edge_cost)
            
            tentative_g_score = g_score[current] + min_edge_cost
            
            if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                # This path is better
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score
                f_score[neighbor] = tentative_g_score + heuristic(neighbor)
                
                counter += 1
                heappush(open_set, (f_score[neighbor], counter, neighbor))
    
    raise nx.NetworkXNoPath(f"No path between {source} and {target}")


def find_alternative_routes(
    G: nx.MultiDiGraph,
    source: int,
    target: int,
    cost_function: Callable,
    num_alternatives: int = 3,
    penalty_factor: float = 1.5
) -> List[Tuple[List[int], float]]:
    """
    Find alternative routes using penalty-based approach.
    
    After finding the optimal route, penalize edges on that route
    and search again to find alternatives.
    
    Returns:
        List of (path, cost) tuples
    """
    routes = []
    penalized_edges = {}  # Track penalty multipliers for edges
    
    # Make a copy of the graph to avoid modifying original
    G_work = G.copy()
    
    for i in range(num_alternatives):
        try:
            # Create modified cost function with penalties
            def penalized_cost(u, v, data):
                base_cost = cost_function(u, v, data)
                penalty = penalized_edges.get((u, v), 1.0)
                return base_cost * penalty
            
            # Find path
            path, cost = astar_path(G_work, source, target, penalized_cost)
            
            # Check if this path is sufficiently different from existing routes
            if routes:
                is_unique = True
                for existing_path, _ in routes:
                    overlap = len(set(path) & set(existing_path)) / len(set(path) | set(existing_path))
                    if overlap > 0.8:  # More than 80% overlap
                        is_unique = False
                        break
                
                if not is_unique:
                    # Increase penalties and try again
                    for j in range(len(path) - 1):
                        edge = (path[j], path[j + 1])
                        penalized_edges[edge] = penalized_edges.get(edge, 1.0) * penalty_factor * 2
                    continue
            
            routes.append((path, cost))
            
            # Apply penalty to edges in this path
            for j in range(len(path) - 1):
                edge = (path[j], path[j + 1])
                penalized_edges[edge] = penalized_edges.get(edge, 1.0) * penalty_factor
                
        except nx.NetworkXNoPath:
            logger.warning(f"No path found for alternative {i + 1}")
            break
        except Exception as e:
            logger.error(f"Error finding alternative route {i + 1}: {e}")
            break
    
    return routes


def calculate_route_metrics(
    G: nx.MultiDiGraph,
    path: List[int]
) -> Dict[str, float]:
    """
    Calculate detailed metrics for a route.
    
    Returns:
        Dict with total_distance_m, total_duration_s, average_aqi, max_aqi
    """
    total_distance = 0.0
    total_duration = 0.0
    aqi_values = []
    
    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        
        edge_data = G.get_edge_data(u, v)
        if edge_data and 0 in edge_data:
            edge_data = edge_data[0]
        
        if edge_data:
            total_distance += edge_data.get('length', 0)
            total_duration += edge_data.get('travel_time', 0)
            aqi_values.append(edge_data.get('aqi', settings.DEFAULT_AQI))
    
    return {
        'total_distance_m': total_distance,
        'total_duration_s': total_duration,
        'average_aqi': sum(aqi_values) / len(aqi_values) if aqi_values else settings.DEFAULT_AQI,
        'max_aqi': max(aqi_values) if aqi_values else settings.DEFAULT_AQI,
    }
