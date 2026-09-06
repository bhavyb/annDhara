import json
from app import app
from marketplace_db import create_delivery_assignment, get_db_connection

def test_farmer_specific_doorstep_routing():
    client = app.test_client()
    print("\n--- TEST: Multi-Farmer Selection Strict Customer Delivery Routing ---")

    # Step 1: Create 3 orders from 3 different farmers to 3 different customers
    o1 = create_delivery_assignment(
        crop="Cauliflower",
        quantity_kg=200.0,
        farmer_name="Rameshbhai Patel",
        buyer_name="Ahmedabad Organic Cafe",
        pickup_location="Sanand",
        destination="Prahlad Nagar, Ahmedabad"
    )
    o2 = create_delivery_assignment(
        crop="Cabbage",
        quantity_kg=300.0,
        farmer_name="Mukeshbhai Desai",
        buyer_name="Gandhinagar SuperStore",
        pickup_location="Bavla",
        destination="Sector 21, Gandhinagar"
    )
    o3 = create_delivery_assignment(
        crop="Capsicum",
        quantity_kg=150.0,
        farmer_name="Sureshbhai Vaghela",
        buyer_name="Vadodara Hotel Taj",
        pickup_location="Dholka",
        destination="Alkapuri, Vadodara"
    )

    print(f"Order 1: Farmer '{o1['farmer_name']}' -> Customer '{o1['buyer_name']}' (Ref: {o1['reference']})")
    print(f"Order 2: Farmer '{o2['farmer_name']}' -> Customer '{o2['buyer_name']}' (Ref: {o2['reference']})")
    print(f"Order 3: Farmer '{o3['farmer_name']}' -> Customer '{o3['buyer_name']}' (Ref: {o3['reference']})")

    # Step 2: Select ONLY 2 Farmers: Rameshbhai Patel & Mukeshbhai Desai
    selected = ["Rameshbhai Patel", "Mukeshbhai Desai"]
    print(f"\nOperator selects 2 Farmers for pickup: {selected}")
    
    resp = client.post("/api/route-optimize", json={
        "selected_farmers": selected,
        "mode": "live",
        "vehicle_capacity_kg": 1000.0,
        "cost_per_km": 24.0
    })
    try:
        assert resp.status_code == 200, f"Error: {resp.data}"
        data = resp.get_json()["data"]
        stops = data.get("route_sequence") or data.get("route_stops")

        pickup_entities = [s["entity"] for s in stops if s["type"] == "PICKUP"]
        delivery_entities = [s["entity"] for s in stops if s["type"] == "DELIVERY"]

        print("\nGenerated Stops:")
        for s in stops:
            from_tag = f" (Harvest from: {s.get('from_farmer')})" if s.get("from_farmer") else ""
            cust_tag = f" (Target: {s.get('target_customers')})" if s.get("target_customers") else ""
            print(f"  Step #{s['step']} [{s['type']}]: {s['entity']}{from_tag}{cust_tag}")

        assert any(o1["farmer_name"] == e for e in pickup_entities), f"{o1['farmer_name']} must be in pickup stops"
        assert any(o2["farmer_name"] == e for e in pickup_entities), f"{o2['farmer_name']} must be in pickup stops"
        assert not any(o3["farmer_name"] == e for e in pickup_entities), f"{o3['farmer_name']} must NOT be in pickup stops"

        assert any(o1["buyer_name"].lower() == e.lower() for e in delivery_entities), f"{o1['buyer_name']} must be in delivery stops"
        assert any(o2["buyer_name"].lower() == e.lower() for e in delivery_entities), f"{o2['buyer_name']} must be in delivery stops"
        assert not any(o3["buyer_name"].lower() == e.lower() for e in delivery_entities), f"{o3['buyer_name']} must NEVER be in delivery stops!"

        # Verify each delivery stop correctly attributes the harvest source farmer
        d1 = next(s for s in stops if s["type"] == "DELIVERY" and s["entity"].lower() == o1["buyer_name"].lower())
        assert d1["from_farmer"] == o1["farmer_name"], f"Expected '{o1['farmer_name']}', got '{d1['from_farmer']}'"

        d2 = next(s for s in stops if s["type"] == "DELIVERY" and s["entity"].lower() == o2["buyer_name"].lower())
        assert d2["from_farmer"] == o2["farmer_name"], f"Expected '{o2['farmer_name']}', got '{d2['from_farmer']}'"

        # Verify OTP Verification on the generated stops
        p1 = next(s for s in stops if s["type"] == "PICKUP" and s["entity"] == "Rameshbhai Patel")
        otp_verify_p1 = client.post("/api/route-optimize/verify-stop", json={
            "stop_id": p1["stop_id"],
            "otp": str(o1["pickup_otp"]),
            "reference": o1["reference"],
            "stop_type": "pickup",
            "entity": p1["entity"]
        })
        assert otp_verify_p1.status_code == 200 and otp_verify_p1.get_json()["success"]
        print("\nVerified Farmer Pickup OTP successfully.")

        otp_verify_d1 = client.post("/api/route-optimize/verify-stop", json={
            "stop_id": d1["stop_id"],
            "otp": str(o1["delivery_otp"]),
            "reference": o1["reference"],
            "stop_type": "delivery",
            "entity": d1["entity"]
        })
        assert otp_verify_d1.status_code == 200 and otp_verify_d1.get_json()["success"]
        print("Verified Customer Doorstep Delivery OTP successfully.")
    finally:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM delivery_updates WHERE reference IN (?, ?, ?)", (o1["reference"], o2["reference"], o3["reference"]))
            conn.commit()
        print("Cleaned up temporary test orders from database.")

    print("\nALL FARMER-SPECIFIC DOORSTEP ROUTING TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_farmer_specific_doorstep_routing()
