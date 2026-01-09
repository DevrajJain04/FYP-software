"""
Test script for the complete Green Corridor system.

Tests:
1. Ingestion Service health
2. Telemetry ingestion
3. Routing Service health
4. Route calculation
"""

import asyncio
import aiohttp
import sys
from datetime import datetime, timezone


INGESTION_URL = "http://localhost:8080"
ROUTING_URL = "http://localhost:8000"

# Test data - Singapore coordinates
TEST_ORIGIN = {"lat": 1.3521, "lng": 103.8198}  # Singapore center
TEST_DEST = {"lat": 1.2966, "lng": 103.7764}    # Southwest Singapore


async def test_ingestion_health(session: aiohttp.ClientSession) -> bool:
    """Test ingestion service health endpoint."""
    print("\n📡 Testing Ingestion Service Health...")
    try:
        async with session.get(f"{INGESTION_URL}/api/v1/health") as response:
            data = await response.json()
            print(f"   Status: {data.get('status')}")
            print(f"   Redis: {data.get('dependencies', {}).get('redis')}")
            return data.get('status') == 'healthy'
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


async def test_telemetry_ingestion(session: aiohttp.ClientSession) -> bool:
    """Test telemetry data ingestion."""
    print("\n📤 Testing Telemetry Ingestion...")
    
    # Single telemetry
    payload = {
        "vehicle_id": "test_vehicle_001",
        "latitude": 1.3521,
        "longitude": 103.8198,
        "aqi": 55.5,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        async with session.post(
            f"{INGESTION_URL}/api/v1/telemetry",
            json=payload
        ) as response:
            data = await response.json()
            print(f"   Success: {data.get('success')}")
            print(f"   Hexagon ID: {data.get('hexagon_id')}")
            
            if not data.get('success'):
                print(f"   Message: {data.get('message')}")
                return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Batch telemetry
    print("\n📦 Testing Batch Ingestion...")
    batch_payload = {
        "data": [
            {"vehicle_id": f"test_batch_{i}", "latitude": 1.35 + i*0.001, 
             "longitude": 103.82 + i*0.001, "aqi": 50 + i}
            for i in range(10)
        ]
    }
    
    try:
        async with session.post(
            f"{INGESTION_URL}/api/v1/telemetry/batch",
            json=batch_payload
        ) as response:
            data = await response.json()
            print(f"   Processed: {data.get('processed')}")
            print(f"   Failed: {data.get('failed')}")
            print(f"   Time: {data.get('total_time')}")
            return data.get('success', False)
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


async def test_routing_health(session: aiohttp.ClientSession) -> bool:
    """Test routing service health endpoint."""
    print("\n🗺️  Testing Routing Service Health...")
    try:
        async with session.get(f"{ROUTING_URL}/health") as response:
            data = await response.json()
            print(f"   Status: {data.get('status')}")
            print(f"   Redis: {data.get('dependencies', {}).get('redis')}")
            return data.get('status') == 'healthy'
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


async def test_route_calculation(session: aiohttp.ClientSession) -> bool:
    """Test route calculation endpoint."""
    print("\n🛣️  Testing Route Calculation...")
    print(f"   Origin: {TEST_ORIGIN}")
    print(f"   Destination: {TEST_DEST}")
    
    payload = {
        "origin": TEST_ORIGIN,
        "destination": TEST_DEST,
        "balance": 0.5,
        "alternatives": 3
    }
    
    try:
        async with session.post(
            f"{ROUTING_URL}/api/v1/route",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=60)  # Route calculation can take time
        ) as response:
            if response.status != 200:
                error = await response.json()
                print(f"   ❌ Error: {error.get('detail')}")
                return False
            
            data = await response.json()
            routes = data.get('routes', [])
            print(f"   Routes found: {len(routes)}")
            
            for i, route in enumerate(routes):
                print(f"\n   Route {i + 1}:")
                print(f"      Distance: {route.get('total_distance_m', 0):.0f} m")
                print(f"      Duration: {route.get('total_duration_s', 0):.0f} s")
                print(f"      Avg AQI: {route.get('average_aqi', 0):.1f}")
                print(f"      Max AQI: {route.get('max_aqi', 0):.1f}")
                print(f"      Cost: {route.get('weighted_cost', 0):.2f}")
            
            return len(routes) > 0
            
    except asyncio.TimeoutError:
        print("   ❌ Timeout - route calculation took too long")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


async def test_aqi_endpoints(session: aiohttp.ClientSession) -> bool:
    """Test AQI data endpoints."""
    print("\n📊 Testing AQI Endpoints...")
    
    # Test area AQI
    payload = {
        "north": 1.36,
        "south": 1.34,
        "east": 103.83,
        "west": 103.81
    }
    
    try:
        async with session.post(
            f"{ROUTING_URL}/api/v1/aqi/area",
            json=payload
        ) as response:
            data = await response.json()
            print(f"   Hexagons with data: {data.get('total_hexagons', 0)}")
            return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


async def main():
    print("=" * 60)
    print("🌿 Green Corridor System Test Suite")
    print("=" * 60)
    
    results = {}
    
    async with aiohttp.ClientSession() as session:
        # Run tests
        results['Ingestion Health'] = await test_ingestion_health(session)
        results['Telemetry Ingestion'] = await test_telemetry_ingestion(session)
        results['Routing Health'] = await test_routing_health(session)
        results['AQI Endpoints'] = await test_aqi_endpoints(session)
        results['Route Calculation'] = await test_route_calculation(session)
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 Test Summary")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {test_name}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 All tests passed!")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Check the logs above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
