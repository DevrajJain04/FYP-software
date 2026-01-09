"""Redis service for AQI data retrieval."""

import redis.asyncio as redis
from typing import Dict, List, Optional, Tuple
import statistics
import logging
import json
import httpx
import h3
import asyncio

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
        Uses batch API call to scraper service for better performance.
        
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
            
            # Fallback for missing hexagons using station data (batch API)
            if settings.USE_STATION_FALLBACK and missing_hexagons:
                batch_results = await self._get_batch_station_aqi_fallback(missing_hexagons)
                result.update(batch_results)
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting AQI for multiple hexagons: {e}")
            return {}
    
    async def _get_batch_station_aqi_fallback(self, hexagon_ids: List[str]) -> Dict[str, float]:
        """
        Batch fallback to scraped station AQI data using the /h3/batch endpoint.
        Much more efficient than individual requests for hundreds of hexagons.
        
        Args:
            hexagon_ids: List of H3 hexagon IDs to look up
            
        Returns:
            Dict mapping hexagon_id to AQI value
        """
        if not settings.SCRAPER_SERVICE_URL or not self._http_client:
            return {}
        
        result = {}
        
        try:
            # Use batch endpoint for efficiency (single HTTP call vs hundreds)
            response = await self._http_client.post(
                f"{settings.SCRAPER_SERVICE_URL}/h3/batch",
                json={"h3_indexes": hexagon_ids},
                timeout=30.0  # Longer timeout for batch requests
            )
            
            if response.status_code == 200:
                data = response.json()
                batch_results = data.get('results', {})
                
                for hex_id, res in batch_results.items():
                    if res.get('found') and res.get('station'):
                        aqi = res['station'].get('aqi', settings.DEFAULT_AQI)
                        result[hex_id] = float(aqi)
                
                logger.debug(f"Batch AQI fallback: {data.get('found', 0)}/{data.get('total', 0)} hexagons resolved")
            else:
                # Fallback to individual requests if batch endpoint unavailable
                logger.warning(f"Batch endpoint returned {response.status_code}, falling back to individual requests")
                result = await self._get_individual_station_aqi_fallback(hexagon_ids)
                
        except httpx.TimeoutException:
            logger.warning("Batch AQI request timed out, falling back to individual requests")
            result = await self._get_individual_station_aqi_fallback(hexagon_ids)
        except Exception as e:
            logger.warning(f"Batch AQI fallback failed: {e}, falling back to individual requests")
            result = await self._get_individual_station_aqi_fallback(hexagon_ids)
        
        return result
    
    async def _get_individual_station_aqi_fallback(self, hexagon_ids: List[str]) -> Dict[str, float]:
        """
        Fallback to individual station AQI lookups (used when batch endpoint unavailable).
        Uses semaphore to limit concurrent requests.
        """
        result = {}
        
        # Limit concurrency to avoid overwhelming the scraper service
        semaphore = asyncio.Semaphore(50)
        
        async def fetch_single(hex_id: str) -> Tuple[str, Optional[float]]:
            async with semaphore:
                aqi = await self._get_station_aqi_fallback(hex_id)
                return hex_id, aqi
        
        # Gather all requests concurrently (with limited parallelism)
        tasks = [fetch_single(hex_id) for hex_id in hexagon_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for item in results:
            if isinstance(item, Exception):
                continue
            hex_id, aqi = item
            if aqi is not None:
                result[hex_id] = aqi
        
        return result
    
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
