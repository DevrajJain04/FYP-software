"""Redis service for AQI data retrieval."""

import redis.asyncio as redis
from typing import Dict, List, Optional, Tuple
import statistics
import logging
import json
import httpx
import h3

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisService:
    """Async Redis service for AQI data operations."""
    
    def __init__(self):
        self.client: Optional[redis.Redis] = None
        self.connected = False
        self._http_client: Optional[httpx.AsyncClient] = None
    
    async def connect(self) -> None:
        """Establish Redis connection."""
        try:
            self.client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            # Test connection
            await self.client.ping()
            self.connected = True
            logger.info(f"Connected to Redis at {settings.REDIS_URL}")
            
            # Initialize HTTP client for scraper service fallback
            self._http_client = httpx.AsyncClient(timeout=10.0)
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.connected = False
            raise
    
    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self.client:
            await self.client.close()
            self.connected = False
            logger.info("Disconnected from Redis")
        if self._http_client:
            await self._http_client.aclose()
    
    async def ping(self) -> bool:
        """Check Redis connectivity."""
        if not self.client:
            return False
        try:
            await self.client.ping()
            return True
        except Exception:
            return False
    
    async def _get_station_aqi_fallback(self, hexagon_id: str) -> Optional[float]:
        """
        Fallback to scraped station AQI data when no vehicle readings available.
        
        First checks Redis for cached station data, then queries the scraper service.
        """
        if not self.client:
            return None
            
        try:
            # Check Redis for cached station data
            station_key = f"{settings.STATION_KEY_PREFIX}{hexagon_id}"
            station_data = await self.client.get(station_key)
            
            if station_data:
                data = json.loads(station_data)
                logger.debug(f"Using cached station AQI for {hexagon_id}: {data.get('aqi')}")
                return float(data.get('aqi', settings.DEFAULT_AQI))
            
            # If not in Redis, query scraper service for nearest station
            if settings.SCRAPER_SERVICE_URL and self._http_client:
                try:
                    # Get H3 cell center coordinates (h3 v3.x API)
                    lat, lng = h3.h3_to_geo(hexagon_id)
                    
                    # First try exact H3 lookup
                    response = await self._http_client.get(
                        f"{settings.SCRAPER_SERVICE_URL}/h3",
                        params={"h3": hexagon_id}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('found') and data.get('station'):
                            aqi = data['station'].get('aqi', settings.DEFAULT_AQI)
                            logger.debug(f"Using scraper station AQI for {hexagon_id}: {aqi}")
                            return float(aqi)
                    
                    # Fallback to nearest station lookup
                    response = await self._http_client.get(
                        f"{settings.SCRAPER_SERVICE_URL}/nearest",
                        params={"lat": lat, "lng": lng}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('found') and data.get('station'):
                            aqi = data['station'].get('aqi', settings.DEFAULT_AQI)
                            logger.debug(f"Using nearest station AQI for {hexagon_id}: {aqi}")
                            return float(aqi)
                            
                except Exception as e:
                    logger.warning(f"Failed to query scraper service: {e}")
            
            return None
            
        except Exception as e:
            logger.error(f"Error in station AQI fallback for {hexagon_id}: {e}")
            return None
    
    async def get_hexagon_aqi(self, hexagon_id: str) -> Optional[float]:
        """
        Get the median AQI for a hexagon.
        
        The data is stored as a hash map where:
        - Key: aqi:h3:{hexagon_id}
        - Value: {vehicle_id: aqi_value, ...}
        
        Returns the median AQI of all vehicles in the hexagon.
        Falls back to scraped station data if no vehicle readings available.
        """
        if not self.client:
            return None
        
        try:
            key = f"{settings.AQI_KEY_PREFIX}{hexagon_id}"
            data = await self.client.hgetall(key)
            
            if not data:
                # Fallback to scraped station data
                if settings.USE_STATION_FALLBACK:
                    return await self._get_station_aqi_fallback(hexagon_id)
                return None
            
            # Convert string values to floats and calculate median
            aqi_values = [float(v) for v in data.values()]
            return statistics.median(aqi_values)
            
        except Exception as e:
            logger.error(f"Error getting AQI for hexagon {hexagon_id}: {e}")
            return None
    
    async def get_hexagon_aqi_with_count(self, hexagon_id: str) -> Tuple[Optional[float], int]:
        """
        Get the median AQI and vehicle count for a hexagon.
        
        Returns:
            Tuple of (median_aqi, vehicle_count)
            If using station fallback, vehicle_count will be -1 to indicate fallback data.
        """
        if not self.client:
            return None, 0
        
        try:
            key = f"{settings.AQI_KEY_PREFIX}{hexagon_id}"
            data = await self.client.hgetall(key)
            
            if not data:
                # Fallback to scraped station data
                if settings.USE_STATION_FALLBACK:
                    aqi = await self._get_station_aqi_fallback(hexagon_id)
                    if aqi is not None:
                        return aqi, -1  # -1 indicates fallback data
                return None, 0
            
            aqi_values = [float(v) for v in data.values()]
            return statistics.median(aqi_values), len(aqi_values)
            
        except Exception as e:
            logger.error(f"Error getting AQI for hexagon {hexagon_id}: {e}")
            return None, 0
    
    async def get_multiple_hexagons_aqi(self, hexagon_ids: List[str]) -> Dict[str, float]:
        """
        Get AQI for multiple hexagons efficiently using pipeline.
        Falls back to scraped station data for hexagons without vehicle readings.
        
        Returns:
            Dict mapping hexagon_id to median AQI
        """
        if not self.client or not hexagon_ids:
            return {}
        
        try:
            result = {}
            missing_hexagons = []
            
            # Use pipeline for efficiency
            pipe = self.client.pipeline()
            for hex_id in hexagon_ids:
                key = f"{settings.AQI_KEY_PREFIX}{hex_id}"
                pipe.hgetall(key)
            
            responses = await pipe.execute()
            
            for hex_id, data in zip(hexagon_ids, responses):
                if data:
                    aqi_values = [float(v) for v in data.values()]
                    result[hex_id] = statistics.median(aqi_values)
                else:
                    missing_hexagons.append(hex_id)
            
            # Fallback for missing hexagons using station data
            if settings.USE_STATION_FALLBACK and missing_hexagons:
                for hex_id in missing_hexagons:
                    fallback_aqi = await self._get_station_aqi_fallback(hex_id)
                    if fallback_aqi is not None:
                        result[hex_id] = fallback_aqi
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting AQI for multiple hexagons: {e}")
            return {}
    
    async def get_all_hexagon_keys(self) -> List[str]:
        """Get all hexagon keys from Redis."""
        if not self.client:
            return []
        
        try:
            keys = []
            cursor = 0
            pattern = f"{settings.AQI_KEY_PREFIX}*"
            
            while True:
                cursor, batch = await self.client.scan(
                    cursor=cursor,
                    match=pattern,
                    count=1000
                )
                keys.extend(batch)
                if cursor == 0:
                    break
            
            # Strip prefix to get just hexagon IDs
            prefix_len = len(settings.AQI_KEY_PREFIX)
            return [k[prefix_len:] for k in keys]
            
        except Exception as e:
            logger.error(f"Error getting all hexagon keys: {e}")
            return []


# Global singleton instance
redis_service = RedisService()
