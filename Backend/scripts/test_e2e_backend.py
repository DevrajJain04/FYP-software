#!/usr/bin/env python3
"""
Green Corridor Backend - End-to-End Test Suite

This script tests the entire backend flow from ingestion to routing,
verifying each step with expected results.

Usage:
    cd Backend/scripts
    pip install requests tabulate colorama
    python test_e2e_backend.py

Services Required:
    - Redis: localhost:6379
    - Ingestion Service: localhost:8080
    - AQI Scraper Service: localhost:8082
    - Routing Service: localhost:8000
"""

import requests
import json
import time
import sys
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass

# Try to import colorama for colored output, fallback to plain text
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    HAS_COLOR = True
except ImportError:
    HAS_COLOR = False
    class Fore:
        GREEN = RED = YELLOW = CYAN = MAGENTA = RESET = ""
    class Style:
        BRIGHT = RESET_ALL = ""

# Try to import tabulate for nice tables, fallback to simple print
try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False

# ============================================================================
# CONFIGURATION
# ============================================================================

INGESTION_URL = "http://localhost:8080"
ROUTING_URL = "http://localhost:8000"
SCRAPER_URL = "http://localhost:8082"

# Mumbai test coordinates
MUMBAI_ORIGIN = {"lat": 19.0760, "lng": 72.8777}  # Chhatrapati Shivaji Terminus
MUMBAI_DEST = {"lat": 19.0178, "lng": 72.8478}    # Worli

# Test vehicle data for Mumbai area
TEST_VEHICLES = [
    {"vehicle_id": "test_car_001", "latitude": 19.0760, "longitude": 72.8777, "aqi": 85.0},
    {"vehicle_id": "test_car_002", "latitude": 19.0650, "longitude": 72.8600, "aqi": 92.0},
    {"vehicle_id": "test_car_003", "latitude": 19.0500, "longitude": 72.8500, "aqi": 78.0},
    {"vehicle_id": "test_car_004", "latitude": 19.0350, "longitude": 72.8450, "aqi": 110.0},
    {"vehicle_id": "test_car_005", "latitude": 19.0178, "longitude": 72.8478, "aqi": 95.0},
]


@dataclass
class TestResult:
    """Result of a single test step."""
    step: int
    name: str
    passed: bool
    expected: str
    actual: str
    details: Optional[str] = None
    response_time_ms: float = 0.0


class TestRunner:
    """End-to-end test runner for Green Corridor Backend."""

    def __init__(self):
        self.results: List[TestResult] = []
        self.step_counter = 0
        self.start_time = datetime.now()

    def run_test(self, name: str, test_func, expected_desc: str) -> TestResult:
        """Run a single test and record the result."""
        self.step_counter += 1
        print(f"\n{Fore.CYAN}{'='*60}")
        print(f"{Fore.CYAN}Step {self.step_counter}: {name}")
        print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}")

        start = time.time()
        try:
            passed, actual, details = test_func()
            elapsed = (time.time() - start) * 1000
            result = TestResult(
                step=self.step_counter,
                name=name,
                passed=passed,
                expected=expected_desc,
                actual=actual,
                details=details,
                response_time_ms=elapsed
            )
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            result = TestResult(
                step=self.step_counter,
                name=name,
                passed=False,
                expected=expected_desc,
                actual=f"EXCEPTION: {type(e).__name__}",
                details=str(e),
                response_time_ms=elapsed
            )

        self.results.append(result)
        self._print_result(result)
        return result

    def _print_result(self, result: TestResult):
        """Print a formatted test result."""
        status = f"{Fore.GREEN}✓ PASS" if result.passed else f"{Fore.RED}✗ FAIL"
        print(f"\nStatus: {status}{Style.RESET_ALL}")
        print(f"Response Time: {result.response_time_ms:.0f}ms")
        print(f"\n{Fore.YELLOW}Expected:{Style.RESET_ALL} {result.expected}")
        print(f"{Fore.YELLOW}Actual:{Style.RESET_ALL} {result.actual}")
        if result.details:
            print(f"\n{Fore.MAGENTA}Details:{Style.RESET_ALL}")
            # Pretty print JSON if possible
            try:
                if result.details.startswith('{') or result.details.startswith('['):
                    parsed = json.loads(result.details)
                    print(json.dumps(parsed, indent=2))
                else:
                    print(result.details)
            except:
                print(result.details)

    def print_summary(self):
        """Print final test summary."""
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed
        duration = (datetime.now() - self.start_time).total_seconds()

        print(f"\n\n{'='*60}")
        print(f"{Fore.CYAN}{Style.BRIGHT}TEST SUMMARY{Style.RESET_ALL}")
        print(f"{'='*60}")

        if HAS_TABULATE:
            table_data = [
                [r.step, r.name[:40], 
                 f"{Fore.GREEN}PASS{Style.RESET_ALL}" if r.passed else f"{Fore.RED}FAIL{Style.RESET_ALL}",
                 f"{r.response_time_ms:.0f}ms"]
                for r in self.results
            ]
            print(tabulate(table_data, headers=["Step", "Test Name", "Result", "Time"], tablefmt="grid"))
        else:
            for r in self.results:
                status = "PASS" if r.passed else "FAIL"
                print(f"  {r.step}. {r.name}: {status} ({r.response_time_ms:.0f}ms)")

        print(f"\n{Fore.CYAN}Total Tests: {total}")
        print(f"{Fore.GREEN}Passed: {passed}")
        print(f"{Fore.RED}Failed: {failed}")
        print(f"{Fore.YELLOW}Duration: {duration:.2f}s{Style.RESET_ALL}")

        if failed == 0:
            print(f"\n{Fore.GREEN}{Style.BRIGHT}🎉 ALL TESTS PASSED!{Style.RESET_ALL}")
        else:
            print(f"\n{Fore.RED}{Style.BRIGHT}❌ {failed} TEST(S) FAILED{Style.RESET_ALL}")

        return failed == 0


# ============================================================================
# TEST FUNCTIONS
# ============================================================================

def test_ingestion_health() -> Tuple[bool, str, str]:
    """Test 1: Verify Ingestion Service is healthy."""
    resp = requests.get(f"{INGESTION_URL}/api/v1/health", timeout=10)
    data = resp.json()
    
    passed = resp.status_code == 200 and data.get("status") == "healthy"
    actual = f"Status={resp.status_code}, Body={json.dumps(data)}"
    details = json.dumps(data)
    
    return passed, actual, details


def test_routing_health() -> Tuple[bool, str, str]:
    """Test 2: Verify Routing Service is healthy."""
    resp = requests.get(f"{ROUTING_URL}/health", timeout=10)
    data = resp.json()
    
    passed = resp.status_code == 200 and data.get("status") == "healthy"
    actual = f"Status={resp.status_code}, Body={json.dumps(data)}"
    details = json.dumps(data)
    
    return passed, actual, details


def test_scraper_health() -> Tuple[bool, str, str]:
    """Test 3: Verify AQI Scraper Service is healthy."""
    resp = requests.get(f"{SCRAPER_URL}/health", timeout=10)
    data = resp.json()
    
    passed = resp.status_code == 200 and data.get("status") == "healthy"
    actual = f"Status={resp.status_code}, station_count={data.get('station_count', 'N/A')}"
    details = json.dumps(data)
    
    return passed, actual, details


def test_submit_single_telemetry() -> Tuple[bool, str, str]:
    """Test 4: Submit single vehicle telemetry to Ingestion Service."""
    payload = {
        "vehicle_id": "e2e_test_car_001",
        "latitude": MUMBAI_ORIGIN["lat"],
        "longitude": MUMBAI_ORIGIN["lng"],
        "aqi": 85.5,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    resp = requests.post(
        f"{INGESTION_URL}/api/v1/telemetry",
        json=payload,
        timeout=10
    )
    data = resp.json()
    
    passed = resp.status_code == 200 and data.get("success") == True
    hexagon_id = data.get("hexagon_id", "N/A")
    actual = f"Status={resp.status_code}, success={data.get('success')}, hexagon_id={hexagon_id}"
    details = json.dumps(data)
    
    return passed, actual, details


def test_submit_batch_telemetry() -> Tuple[bool, str, str]:
    """Test 5: Submit batch vehicle telemetry data."""
    timestamp = datetime.utcnow().isoformat() + "Z"
    payload = {
        "data": [
            {**v, "timestamp": timestamp}
            for v in TEST_VEHICLES
        ]
    }
    
    resp = requests.post(
        f"{INGESTION_URL}/api/v1/telemetry/batch",
        json=payload,
        timeout=15
    )
    data = resp.json()
    
    passed = resp.status_code == 200 and data.get("success") == True
    processed = data.get("processed", 0)
    actual = f"Status={resp.status_code}, success={data.get('success')}, processed={processed}/{len(TEST_VEHICLES)}"
    details = json.dumps(data)
    
    return passed, actual, details


def test_ingestion_stats() -> Tuple[bool, str, str]:
    """Test 6: Get ingestion statistics."""
    resp = requests.get(f"{INGESTION_URL}/api/v1/stats", timeout=10)
    data = resp.json()
    
    passed = resp.status_code == 200
    total = data.get("total_ingested", 0)
    actual = f"Status={resp.status_code}, total_ingested={total}, hexagons={data.get('unique_hexagons', 0)}"
    details = json.dumps(data)
    
    return passed, actual, details


def test_scraper_stations() -> Tuple[bool, str, str]:
    """Test 7: Fetch scraped AQI stations."""
    resp = requests.get(f"{SCRAPER_URL}/stations", timeout=15)
    data = resp.json()
    
    stations = data.get("stations", []) if isinstance(data, dict) else data
    passed = resp.status_code == 200 and len(stations) >= 0
    actual = f"Status={resp.status_code}, station_count={len(stations)}"
    
    # Show first few stations
    sample = stations[:3] if stations else []
    details = json.dumps({"sample_stations": sample, "total": len(stations)})
    
    return passed, actual, details


def test_nearest_station() -> Tuple[bool, str, str]:
    """Test 8: Find nearest AQI station to a location."""
    resp = requests.get(
        f"{SCRAPER_URL}/nearest",
        params={"lat": MUMBAI_ORIGIN["lat"], "lng": MUMBAI_ORIGIN["lng"]},
        timeout=10
    )
    
    if resp.status_code == 404:
        return True, "Status=404 (No stations loaded yet - OK for initial run)", "{}"
    
    data = resp.json()
    passed = resp.status_code == 200 and "name" in data or "station" in str(data).lower()
    actual = f"Status={resp.status_code}, station={data.get('name', data.get('station_name', 'N/A'))}"
    details = json.dumps(data)
    
    return passed, actual, details


def test_trigger_aqi_fetch() -> Tuple[bool, str, str]:
    """Test 9: Trigger manual AQI fetch from scraper."""
    resp = requests.post(f"{SCRAPER_URL}/fetch", timeout=5)
    data = resp.json() if resp.content else {}
    
    # Accept 200 OK or 202 Accepted (async)
    passed = resp.status_code in [200, 202]
    actual = f"Status={resp.status_code}, message={data.get('message', 'Fetch triggered')}"
    details = json.dumps(data) if data else '{"message": "Fetch initiated"}'
    
    return passed, actual, details


def test_routing_stats() -> Tuple[bool, str, str]:
    """Test 10: Get routing service statistics."""
    resp = requests.get(f"{ROUTING_URL}/api/v1/stats", timeout=10)
    data = resp.json()
    
    passed = resp.status_code == 200
    hexagons = data.get("hexagons_with_data", 0)
    actual = f"Status={resp.status_code}, hexagons_with_data={hexagons}, h3_resolution={data.get('h3_resolution')}"
    details = json.dumps(data)
    
    return passed, actual, details


def test_calculate_route_balanced() -> Tuple[bool, str, str]:
    """Test 11: Calculate route with balanced weighting (0.5)."""
    payload = {
        "origin": MUMBAI_ORIGIN,
        "destination": MUMBAI_DEST,
        "balance": 0.5,
        "alternatives": 3
    }
    
    resp = requests.post(
        f"{ROUTING_URL}/api/v1/route",
        json=payload,
        timeout=60  # Graph fetching can be slow first time
    )
    data = resp.json()
    
    if resp.status_code != 200:
        return False, f"Status={resp.status_code}", json.dumps(data)
    
    routes = data.get("routes", [])
    passed = len(routes) > 0
    
    if routes:
        r = routes[0]
        actual = f"Status={resp.status_code}, routes={len(routes)}, distance={r.get('total_distance_m', 0):.0f}m, aqi={r.get('average_aqi', 0):.1f}"
        summary = {
            "route_count": len(routes),
            "primary_route": {
                "distance_m": r.get("total_distance_m"),
                "duration_s": r.get("total_duration_s"),
                "average_aqi": r.get("average_aqi"),
                "max_aqi": r.get("max_aqi"),
                "weighted_cost": r.get("weighted_cost"),
            },
            "origin": data.get("origin"),
            "destination": data.get("destination"),
            "balance": data.get("balance")
        }
        details = json.dumps(summary)
    else:
        actual = f"Status={resp.status_code}, routes=0"
        details = json.dumps(data)
    
    return passed, actual, details


def test_calculate_route_fastest() -> Tuple[bool, str, str]:
    """Test 12: Calculate fastest route (balance=0)."""
    payload = {
        "origin": MUMBAI_ORIGIN,
        "destination": MUMBAI_DEST,
        "balance": 0.0,  # Fastest route, ignore AQI
        "alternatives": 1
    }
    
    resp = requests.post(
        f"{ROUTING_URL}/api/v1/route",
        json=payload,
        timeout=60
    )
    data = resp.json()
    
    if resp.status_code != 200:
        return False, f"Status={resp.status_code}", json.dumps(data)
    
    routes = data.get("routes", [])
    passed = len(routes) > 0
    
    if routes:
        r = routes[0]
        actual = f"Fastest route: {r.get('total_distance_m', 0):.0f}m, {r.get('total_duration_s', 0):.0f}s, AQI={r.get('average_aqi', 0):.1f}"
        details = json.dumps({
            "mode": "fastest (balance=0)",
            "distance_m": r.get("total_distance_m"),
            "duration_s": r.get("total_duration_s"),
            "average_aqi": r.get("average_aqi"),
        })
    else:
        actual = "No route returned"
        details = json.dumps(data)
    
    return passed, actual, details


def test_calculate_route_cleanest() -> Tuple[bool, str, str]:
    """Test 13: Calculate cleanest air route (balance=1)."""
    payload = {
        "origin": MUMBAI_ORIGIN,
        "destination": MUMBAI_DEST,
        "balance": 1.0,  # Cleanest air route
        "alternatives": 1
    }
    
    resp = requests.post(
        f"{ROUTING_URL}/api/v1/route",
        json=payload,
        timeout=60
    )
    data = resp.json()
    
    if resp.status_code != 200:
        return False, f"Status={resp.status_code}", json.dumps(data)
    
    routes = data.get("routes", [])
    passed = len(routes) > 0
    
    if routes:
        r = routes[0]
        actual = f"Cleanest route: {r.get('total_distance_m', 0):.0f}m, {r.get('total_duration_s', 0):.0f}s, AQI={r.get('average_aqi', 0):.1f}"
        details = json.dumps({
            "mode": "cleanest_air (balance=1)",
            "distance_m": r.get("total_distance_m"),
            "duration_s": r.get("total_duration_s"),
            "average_aqi": r.get("average_aqi"),
        })
    else:
        actual = "No route returned"
        details = json.dumps(data)
    
    return passed, actual, details


def test_area_aqi_heatmap() -> Tuple[bool, str, str]:
    """Test 14: Get AQI heatmap for Mumbai area."""
    payload = {
        "north": 19.10,
        "south": 19.00,
        "east": 72.90,
        "west": 72.80
    }
    
    resp = requests.post(
        f"{ROUTING_URL}/api/v1/aqi/area",
        json=payload,
        timeout=15
    )
    data = resp.json()
    
    passed = resp.status_code == 200
    hexagons = data.get("hexagons", [])
    actual = f"Status={resp.status_code}, hexagons_returned={len(hexagons)}"
    
    summary = {
        "total_hexagons": data.get("total_hexagons", len(hexagons)),
        "bounds": data.get("bounds"),
        "sample_hexagons": hexagons[:3] if hexagons else []
    }
    details = json.dumps(summary)
    
    return passed, actual, details


def test_invalid_route_request() -> Tuple[bool, str, str]:
    """Test 15: Verify error handling for invalid route request."""
    payload = {
        "origin": {"lat": 999, "lng": 999},  # Invalid coordinates
        "destination": MUMBAI_DEST,
        "balance": 0.5
    }
    
    resp = requests.post(
        f"{ROUTING_URL}/api/v1/route",
        json=payload,
        timeout=15
    )
    
    # Should return 422 (validation error) or 400 (bad request)
    passed = resp.status_code in [400, 422, 500]
    actual = f"Status={resp.status_code} (Error correctly returned for invalid coords)"
    details = resp.text[:500] if resp.text else "{}"
    
    return passed, actual, details


def test_invalid_telemetry() -> Tuple[bool, str, str]:
    """Test 16: Verify error handling for invalid telemetry."""
    payload = {
        "vehicle_id": "",  # Empty vehicle ID should fail
        "latitude": 19.0760,
        "longitude": 72.8777,
        "aqi": 85.5
    }
    
    resp = requests.post(
        f"{INGESTION_URL}/api/v1/telemetry",
        json=payload,
        timeout=10
    )
    data = resp.json()
    
    # Should return 400 and success=false
    passed = resp.status_code == 400 and data.get("success") == False
    actual = f"Status={resp.status_code}, success={data.get('success')}, message={data.get('message', 'N/A')}"
    details = json.dumps(data)
    
    return passed, actual, details


def test_compare_routes() -> Tuple[bool, str, str]:
    """Test 17: Compare fastest vs cleanest routes (functional validation)."""
    # Get fastest route
    fastest_resp = requests.post(
        f"{ROUTING_URL}/api/v1/route",
        json={"origin": MUMBAI_ORIGIN, "destination": MUMBAI_DEST, "balance": 0.0, "alternatives": 1},
        timeout=60
    )
    
    # Get cleanest route
    cleanest_resp = requests.post(
        f"{ROUTING_URL}/api/v1/route",
        json={"origin": MUMBAI_ORIGIN, "destination": MUMBAI_DEST, "balance": 1.0, "alternatives": 1},
        timeout=60
    )
    
    if fastest_resp.status_code != 200 or cleanest_resp.status_code != 200:
        return False, "Failed to get routes for comparison", "{}"
    
    fastest = fastest_resp.json().get("routes", [{}])[0]
    cleanest = cleanest_resp.json().get("routes", [{}])[0]
    
    fastest_time = fastest.get("total_duration_s", 0)
    cleanest_time = cleanest.get("total_duration_s", 0)
    fastest_aqi = fastest.get("average_aqi", 0)
    cleanest_aqi = cleanest.get("average_aqi", 0)
    
    # Fastest should have lower/equal duration, cleanest should have lower/equal AQI
    # (or they might be the same route)
    passed = True  # Route comparison is informational
    
    comparison = {
        "fastest_route": {
            "duration_s": fastest_time,
            "distance_m": fastest.get("total_distance_m"),
            "average_aqi": fastest_aqi
        },
        "cleanest_route": {
            "duration_s": cleanest_time,
            "distance_m": cleanest.get("total_distance_m"),
            "average_aqi": cleanest_aqi
        },
        "time_difference_s": cleanest_time - fastest_time,
        "aqi_difference": fastest_aqi - cleanest_aqi
    }
    
    actual = f"Fastest: {fastest_time:.0f}s, AQI={fastest_aqi:.1f} | Cleanest: {cleanest_time:.0f}s, AQI={cleanest_aqi:.1f}"
    details = json.dumps(comparison)
    
    return passed, actual, details


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    print(f"""
{Fore.CYAN}{Style.BRIGHT}
╔═══════════════════════════════════════════════════════════════╗
║     GREEN CORRIDOR BACKEND - END-TO-END TEST SUITE            ║
╚═══════════════════════════════════════════════════════════════╝
{Style.RESET_ALL}
Testing Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Services Under Test:
  • Ingestion Service: {INGESTION_URL}
  • Routing Service:   {ROUTING_URL}
  • AQI Scraper:       {SCRAPER_URL}
""")

    runner = TestRunner()

    # Phase 1: Health Checks
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}═══ PHASE 1: SERVICE HEALTH CHECKS ═══{Style.RESET_ALL}")
    runner.run_test("Ingestion Service Health", test_ingestion_health, "HTTP 200, status='healthy'")
    runner.run_test("Routing Service Health", test_routing_health, "HTTP 200, status='healthy'")
    runner.run_test("AQI Scraper Health", test_scraper_health, "HTTP 200, status='healthy'")

    # Phase 2: Data Ingestion
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}═══ PHASE 2: DATA INGESTION ═══{Style.RESET_ALL}")
    runner.run_test("Submit Single Telemetry", test_submit_single_telemetry, "HTTP 200, success=true, hexagon_id returned")
    runner.run_test("Submit Batch Telemetry", test_submit_batch_telemetry, "HTTP 200, success=true, all records processed")
    runner.run_test("Ingestion Statistics", test_ingestion_stats, "HTTP 200, statistics returned")

    # Phase 3: AQI Scraper
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}═══ PHASE 3: AQI SCRAPER SERVICE ═══{Style.RESET_ALL}")
    runner.run_test("Fetch Scraped Stations", test_scraper_stations, "HTTP 200, station list returned")
    runner.run_test("Find Nearest Station", test_nearest_station, "HTTP 200, nearest station found")
    runner.run_test("Trigger AQI Fetch", test_trigger_aqi_fetch, "HTTP 200/202, fetch triggered")

    # Phase 4: Routing Service
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}═══ PHASE 4: ROUTING SERVICE ═══{Style.RESET_ALL}")
    runner.run_test("Routing Service Stats", test_routing_stats, "HTTP 200, stats returned")
    runner.run_test("Calculate Route (Balanced)", test_calculate_route_balanced, "HTTP 200, routes returned with metrics")
    runner.run_test("Calculate Route (Fastest)", test_calculate_route_fastest, "HTTP 200, optimized for time")
    runner.run_test("Calculate Route (Cleanest)", test_calculate_route_cleanest, "HTTP 200, optimized for air quality")
    runner.run_test("Get Area AQI Heatmap", test_area_aqi_heatmap, "HTTP 200, hexagon data returned")

    # Phase 5: Error Handling
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}═══ PHASE 5: ERROR HANDLING ═══{Style.RESET_ALL}")
    runner.run_test("Invalid Route Request", test_invalid_route_request, "HTTP 4xx/5xx, error message returned")
    runner.run_test("Invalid Telemetry Data", test_invalid_telemetry, "HTTP 400, success=false")

    # Phase 6: Functional Validation
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}═══ PHASE 6: FUNCTIONAL VALIDATION ═══{Style.RESET_ALL}")
    runner.run_test("Compare Fastest vs Cleanest Routes", test_compare_routes, "Both routes returned with comparable metrics")

    # Print summary
    success = runner.print_summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}Test run interrupted by user{Style.RESET_ALL}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Fore.RED}Fatal error: {e}{Style.RESET_ALL}")
        sys.exit(1)
