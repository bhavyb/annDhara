"""
Automated Verification for Map Integration & AI Route Optimization:
1. Verification of Precision Micro-Locations & Geocoding
2. Verification of Single Delivery Route Generation
3. Verification of Logistics Accept Delivery & Route Return
4. Verification of GET /api/deliveries/<reference>/route
5. Verification of Shared Logistics CVRP Multi-Stop Routing & Polyline Geometry
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mandi_comparator import resolve_coordinates
from ai_engine import optimize_shared_logistics_route, get_route_geometry, get_google_maps_nav_url
from app import app, build_single_delivery_route
from marketplace_db import create_delivery_assignment, get_db_connection

def test_precision_geocoding():
    print("--- 1. Testing Precision Geocoding for Indian & Gujarat Locations ---")
    test_cases = [
        ("Sanand Farm Gate, Ahmedabad", (22.9840, 72.3780)),
        ("Bhavya Supermarket, Satellite, Ahmedabad", (23.0280, 72.5250)),
        ("Sg Highway, Ahmedabad", (23.0380, 72.5120)),
        ("Prahlad Nagar, Ahmedabad", (23.0120, 72.5080)),
        ("Vastrapur, Ahmedabad", (23.0350, 72.5280)),
        ("Alkapuri, Vadodara", (22.3120, 73.1720)),
        ("Sector 21, Gandhinagar", (23.2156, 72.6369)),
        ("Bavla Agri Belt", (22.8360, 72.3610)),
        ("Dholka Rural", (22.7210, 72.4410)),
        ("Surat", (21.1702, 72.8311)),
        ("Rajkot", (22.3039, 70.8022)),
        ("Rythu Bazar Falaknuma, Hyderabad", (17.3320, 78.4720)),
    ]

    for query, (expected_lat, expected_lng) in test_cases:
        lat, lng, label = resolve_coordinates(location_query=query)
        assert lat is not None and lng is not None, f"Failed to resolve {query}"
        # Make sure not falling back to old dummy Nashik coords (19.9975, 73.7898)
        assert not (round(lat, 3) == 19.998 and round(lng, 3) == 73.790), f"{query} fell back to dummy Nashik coordinates!"
        # Check within reasonable proximity (approx 0.1 degree)
        assert abs(lat - expected_lat) < 0.15, f"{query}: lat {lat} differs from expected {expected_lat}"
        assert abs(lng - expected_lng) < 0.15, f"{query}: lng {lng} differs from expected {expected_lng}"
        print(f"  [OK] {query:40} -> ({lat:.4f}, {lng:.4f}) [{label}]")

    print("[SUCCESS] All 12 precision geocoding tests passed!\n")


def test_delivery_route_and_acceptance():
    print("--- 2. Testing Delivery Acceptance & AI Route Generation ---")
    client = app.test_client()

    # Create a fresh test delivery
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO delivery_updates 
               (reference, farmer_name, buyer_name, crop, quantity_kg, pickup_location, destination, status, logistics_name, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'Assigned', 'Unassigned', datetime('now'), datetime('now'))""",
            ("MAP-TEST-2026", "Kantilal Patel", "FreshBasket Mart", "Tomato", 400.0, "Sanand Farm Gate, Ahmedabad", "Satellite, Ahmedabad")
        )
        conn.commit()

    # Test GET /api/deliveries/<ref>/route before acceptance
    res = client.get("/api/deliveries/MAP-TEST-2026/route")
    assert res.status_code == 200, f"Route fetch failed: {res.data}"
    data = res.get_json()
    assert data["success"] is True
    route = data["data"]
    assert len(route["route_stops"]) == 3
    assert len(route["path_coordinates"]) >= 3
    assert "https://www.google.com/maps" in route["navigation_url"]
    assert route["total_distance_km"] > 0
    print(f"  [OK] Pre-accept route generated: {route['total_distance_km']} km, {route['eta_label']}")

    # Test POST /api/deliveries/<ref>/accept
    accept_payload = {
        "logistics_name": "FastTrack Transporters",
        "vehicle_number": "GJ-01-AB-1234",
        "current_location": "Ahmedabad Logistics Hub"
    }
    accept_res = client.post("/api/deliveries/MAP-TEST-2026/accept", json=accept_payload)
    assert accept_res.status_code == 200, f"Accept failed: {accept_res.data}"
    accept_data = accept_res.get_json()
    assert accept_data["success"] is True
    assert accept_data["delivery"]["status"] == "Accepted"
    assert "optimized_route" in accept_data
    opt_route = accept_data["optimized_route"]
    assert opt_route["total_distance_km"] > 0
    assert len(opt_route["path_coordinates"]) >= 3
    assert opt_route["route_stops"][0]["type"] == "ORIGIN"
    assert opt_route["route_stops"][1]["type"] == "PICKUP"
    assert opt_route["route_stops"][2]["type"] == "DELIVERY"
    print(f"  [OK] Post-accept response includes AI optimized route with {len(opt_route['path_coordinates'])} road points")

    # Clean up test row
    with get_db_connection() as conn:
        conn.execute("DELETE FROM delivery_updates WHERE reference = 'MAP-TEST-2026'")
        conn.commit()

    print("[SUCCESS] Delivery acceptance & route endpoints verified!\n")


def test_shared_logistics_route_optimization():
    print("--- 3. Testing Multi-Stop Shared Logistics CVRP Route Optimization ---")
    client = app.test_client()

    opt_res = client.post("/api/route-optimize", json={"mode": "preset"})
    assert opt_res.status_code == 200, f"Shared route optimization failed: {opt_res.data}"
    res_data = opt_res.get_json()
    assert res_data["success"] is True
    data = res_data["data"]

    assert "path_coordinates" in data
    assert len(data["path_coordinates"]) >= 6
    assert "navigation_url" in data
    assert len(data["route_stops"]) >= 4

    for stop in data["route_stops"]:
        assert "lat" in stop and "lng" in stop, f"Stop {stop.get('stop_id')} missing lat/lng!"
        assert stop["lat"] != 0 and stop["lng"] != 0, f"Stop {stop.get('stop_id')} has zero coordinates!"

    print(f"  [OK] Shared route contains {len(data['route_stops'])} stops with coordinates")
    print(f"  [OK] Road geometry path contains {len(data['path_coordinates'])} polyline points")
    print(f"  [OK] Google Maps navigation link: {data['navigation_url'][:60]}...")
    print("[SUCCESS] Shared CVRP Route Optimization verified!\n")


if __name__ == "__main__":
    print("==========================================================")
    print("STARTING FULL MAP INTEGRATION & ROUTE OPTIMIZATION AUDIT")
    print("==========================================================")
    test_precision_geocoding()
    test_delivery_route_and_acceptance()
    test_shared_logistics_route_optimization()
    print(">>> ALL MAP INTEGRATION & AI ROUTE OPTIMIZATION TESTS PASSED! <<<")
