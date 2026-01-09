"""Configuration settings for the Routing Service."""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Server settings
    PORT: int = 8000
    DEBUG: bool = False
    
    # Redis settings
    REDIS_URL: str = "redis://localhost:6379"
    
    # H3 settings
    H3_RESOLUTION: int = 9
    
    # Graph settings
    GRAPH_CACHE_TTL: int = 3600  # 1 hour
    DEFAULT_NETWORK_TYPE: str = "drive"
    
    # Routing settings
    DEFAULT_BALANCE: float = 0.5  # 50% time, 50% AQI
    MAX_ROUTE_DISTANCE_KM: float = 100.0
    
    # AQI settings
    DEFAULT_AQI: float = 50.0  # Default AQI when no data available
    AQI_KEY_PREFIX: str = "aqi:h3:"
    
    # Station fallback settings (for scraped AQI data)
    USE_STATION_FALLBACK: bool = True  # Enable fallback to scraped station data
    SCRAPER_SERVICE_URL: Optional[str] = "http://aqiscraper:8082"  # AQI scraper service URL
    STATION_KEY_PREFIX: str = "station:h3:"  # Redis key prefix for station data
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
