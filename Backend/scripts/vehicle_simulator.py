"""
Vehicle Telemetry Simulator

Simulates multiple vehicles sending AQI telemetry data to the ingestion service.
Useful for testing the system end-to-end.
"""

import asyncio
import aiohttp
import random
import math
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import List
import argparse


@dataclass
class Vehicle:
    """Simulated vehicle with position and movement."""
    id: str
    lat: float
    lng: float
    heading: float  # degrees
    speed: float    # m/s
    base_aqi: float


class VehicleSimulator:
    """Simulates multiple vehicles moving and reporting telemetry."""
    
    def __init__(
        self,
        ingestion_url: str = "http://localhost:8080",
        num_vehicles: int = 100,
        center_lat: float = 1.3521,  # Singapore
        center_lng: float = 103.8198,
        area_radius_km: float = 5.0,
        update_interval: float = 5.0,  # seconds
    ):
        self.ingestion_url = ingestion_url
        self.num_vehicles = num_vehicles
        self.center_lat = center_lat
        self.center_lng = center_lng
        self.area_radius_km = area_radius_km
        self.update_interval = update_interval
        self.vehicles: List[Vehicle] = []
        self.running = False
        
    def initialize_vehicles(self):
        """Create initial vehicle fleet with random positions."""
        self.vehicles = []
        
        for i in range(self.num_vehicles):
            # Random position within radius
            angle = random.uniform(0, 2 * math.pi)
            distance = random.uniform(0, self.area_radius_km)
            
            # Convert to lat/lng offset (approximate)
            lat_offset = (distance * math.cos(angle)) / 111.0
            lng_offset = (distance * math.sin(angle)) / (111.0 * math.cos(math.radians(self.center_lat)))
            
            vehicle = Vehicle(
                id=f"vehicle_{i:04d}",
                lat=self.center_lat + lat_offset,
                lng=self.center_lng + lng_offset,
                heading=random.uniform(0, 360),
                speed=random.uniform(5, 20),  # 5-20 m/s
                base_aqi=random.uniform(30, 80),  # Base AQI varies by area
            )
            self.vehicles.append(vehicle)
        
        print(f"Initialized {len(self.vehicles)} vehicles")
    
    def update_vehicle(self, vehicle: Vehicle):
        """Update vehicle position based on speed and heading."""
        # Add some randomness to heading
        vehicle.heading += random.uniform(-15, 15)
        vehicle.heading = vehicle.heading % 360
        
        # Move vehicle
        distance_m = vehicle.speed * self.update_interval
        distance_deg = distance_m / 111000  # Approximate
        
        lat_delta = distance_deg * math.cos(math.radians(vehicle.heading))
        lng_delta = distance_deg * math.sin(math.radians(vehicle.heading)) / math.cos(math.radians(vehicle.lat))
        
        vehicle.lat += lat_delta
        vehicle.lng += lng_delta
        
        # Keep within bounds (bounce off edges)
        dist_from_center = math.sqrt(
            ((vehicle.lat - self.center_lat) * 111) ** 2 +
            ((vehicle.lng - self.center_lng) * 111 * math.cos(math.radians(self.center_lat))) ** 2
        )
        
        if dist_from_center > self.area_radius_km:
            # Reverse heading
            vehicle.heading = (vehicle.heading + 180) % 360
    
    def get_vehicle_aqi(self, vehicle: Vehicle) -> float:
        """
        Calculate AQI for vehicle based on position and time.
        
        Simulates:
        - Higher AQI near city center
        - Time-based variations (rush hours)
        - Random noise
        """
        # Distance from center affects AQI
        dist_from_center = math.sqrt(
            ((vehicle.lat - self.center_lat) * 111) ** 2 +
            ((vehicle.lng - self.center_lng) * 111 * math.cos(math.radians(self.center_lat))) ** 2
        )
        
        # Higher AQI closer to center
        center_factor = max(0, 1 - dist_from_center / self.area_radius_km) * 30
        
        # Time-based factor (simulate rush hours)
        hour = datetime.now().hour
        if 7 <= hour <= 9 or 17 <= hour <= 19:
            time_factor = 20  # Rush hour
        elif 10 <= hour <= 16:
            time_factor = 10  # Daytime
        else:
            time_factor = 0   # Off-peak
        
        # Random noise
        noise = random.uniform(-10, 10)
        
        # Calculate final AQI
        aqi = vehicle.base_aqi + center_factor + time_factor + noise
        return max(0, min(500, aqi))  # Clamp to valid range
    
    async def send_telemetry(self, session: aiohttp.ClientSession, vehicle: Vehicle):
        """Send telemetry for a single vehicle."""
        aqi = self.get_vehicle_aqi(vehicle)
        
        payload = {
            "vehicle_id": vehicle.id,
            "latitude": vehicle.lat,
            "longitude": vehicle.lng,
            "aqi": round(aqi, 2),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            async with session.post(
                f"{self.ingestion_url}/api/v1/telemetry",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status != 200:
                    print(f"Error for {vehicle.id}: {response.status}")
        except Exception as e:
            print(f"Request failed for {vehicle.id}: {e}")
    
    async def send_batch_telemetry(self, session: aiohttp.ClientSession):
        """Send batch telemetry for all vehicles."""
        data = []
        for vehicle in self.vehicles:
            aqi = self.get_vehicle_aqi(vehicle)
            data.append({
                "vehicle_id": vehicle.id,
                "latitude": vehicle.lat,
                "longitude": vehicle.lng,
                "aqi": round(aqi, 2),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        try:
            async with session.post(
                f"{self.ingestion_url}/api/v1/telemetry/batch",
                json={"data": data},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                result = await response.json()
                print(f"Batch sent: {result.get('processed', 0)} processed, "
                      f"{result.get('failed', 0)} failed, "
                      f"time: {result.get('total_time', 'N/A')}")
        except Exception as e:
            print(f"Batch request failed: {e}")
    
    async def run(self, use_batch: bool = True):
        """Main simulation loop."""
        self.initialize_vehicles()
        self.running = True
        
        print(f"Starting simulation with {self.num_vehicles} vehicles")
        print(f"Center: ({self.center_lat}, {self.center_lng})")
        print(f"Radius: {self.area_radius_km} km")
        print(f"Update interval: {self.update_interval}s")
        print(f"Mode: {'Batch' if use_batch else 'Individual'}")
        print("-" * 50)
        
        async with aiohttp.ClientSession() as session:
            iteration = 0
            while self.running:
                iteration += 1
                
                # Update all vehicle positions
                for vehicle in self.vehicles:
                    self.update_vehicle(vehicle)
                
                # Send telemetry
                if use_batch:
                    await self.send_batch_telemetry(session)
                else:
                    tasks = [
                        self.send_telemetry(session, vehicle)
                        for vehicle in self.vehicles
                    ]
                    await asyncio.gather(*tasks)
                    print(f"Iteration {iteration}: Sent {len(self.vehicles)} telemetry points")
                
                # Wait for next update
                await asyncio.sleep(self.update_interval)
    
    def stop(self):
        """Stop the simulation."""
        self.running = False


async def main():
    parser = argparse.ArgumentParser(description="Vehicle Telemetry Simulator")
    parser.add_argument("--url", default="http://localhost:8080", help="Ingestion service URL")
    parser.add_argument("--vehicles", type=int, default=100, help="Number of vehicles")
    parser.add_argument("--lat", type=float, default=1.3521, help="Center latitude")
    parser.add_argument("--lng", type=float, default=103.8198, help="Center longitude")
    parser.add_argument("--radius", type=float, default=5.0, help="Area radius in km")
    parser.add_argument("--interval", type=float, default=5.0, help="Update interval in seconds")
    parser.add_argument("--individual", action="store_true", help="Send individual requests instead of batch")
    
    args = parser.parse_args()
    
    simulator = VehicleSimulator(
        ingestion_url=args.url,
        num_vehicles=args.vehicles,
        center_lat=args.lat,
        center_lng=args.lng,
        area_radius_km=args.radius,
        update_interval=args.interval,
    )
    
    try:
        await simulator.run(use_batch=not args.individual)
    except KeyboardInterrupt:
        print("\nStopping simulation...")
        simulator.stop()


if __name__ == "__main__":
    asyncio.run(main())
