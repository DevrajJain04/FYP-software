"""
Green Corridor Routing Service

A FastAPI service for AQI-aware route optimization using OSMnx and NetworkX.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.api.routes import router as api_router
from app.core.config import settings
from app.services.redis_service import redis_service
from app.services.graph_service import graph_service

# Configure logging
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress noisy httpx/httpcore logs (chatty "HTTP Request: GET ... 200 OK" lines)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("🚀 Starting Green Corridor Routing Service...")
    logger.info(f"📊 H3 Resolution: {settings.H3_RESOLUTION}")
    logger.info(f"🗺️  Graph Cache TTL: {settings.GRAPH_CACHE_TTL}s")
    
    # Initialize Redis connection
    await redis_service.connect()
    logger.info("✅ Redis connected")
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down Routing Service...")
    await redis_service.disconnect()
    logger.info("✅ Redis disconnected")


# Create FastAPI application
app = FastAPI(
    title="Green Corridor Routing Service",
    description="AQI-aware route optimization using OSMnx and NetworkX",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check(request: Request):
    """
    Health check endpoint.
    
    Note: This endpoint is excluded from access logging to reduce noise.
    """
    redis_healthy = await redis_service.ping()
    
    return {
        "status": "healthy" if redis_healthy else "degraded",
        "service": "routing-service",
        "dependencies": {
            "redis": "healthy" if redis_healthy else "unhealthy"
        }
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Green Corridor Routing Service",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }
