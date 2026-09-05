from app import app
import json
import sys

client = app.test_client()

print("--- Testing AI Route Optimization Multi-Farmer & Multi-Customer With OTP ---")

# 1. Fetch Route Optimization Data
res = client.post("/api/route-optimize", json={"vehicle_capacity_kg": 1000, "cost_per_km": 24})
assert res.status_code == 200, f"Route optimize failed: {res.data}"
data = json.loads(res.data.decode("utf-8"))["data"]

stops = data.get("route_sequence") or data.get("route_stops")
assert stops is not None, "Stops must not be empty"

pickups = [s for s in stops if s.get("type") == "PICKUP"]
deliveries = [s for s in stops if s.get("type") == "DELIVERY"]

assert len(pickups) >= 2, f"Expected >= 2 farmer pickups, got {len(pickups)}"
assert len(deliveries) >= 2, f"Expected >= 2 customer deliveries, got {len(deliveries)}"
print(f"[OK] Route contains {len(pickups)} Farmer Pickups and {len(deliveries)} Customer Deliveries")

# Verify that cleartext OTP is NOT exposed in the route client response
for p in pickups:
    assert p.get("otp") is None, f"Privacy violation: Pickup {p['stop_id']} exposed cleartext OTP!"
    assert p.get("otp_type") == "pickup"
    print(f"   - {p['stop_id']}: {p['entity']} ({p['action']}) -> OTP redacted (Secure)")

for d in deliveries:
    assert d.get("otp") is None, f"Privacy violation: Delivery {d['stop_id']} exposed cleartext OTP!"
    assert d.get("otp_type") == "delivery"
    print(f"   - {d['stop_id']}: {d['entity']} ({d['action']}) -> OTP redacted (Secure)")

# 2. Test Invalid OTP Rejection
first_pickup = pickups[0]
res_bad = client.post("/api/route-optimize/verify-stop", json={
    "stop_id": first_pickup["stop_id"],
    "otp": "0000",
    "reference": first_pickup.get("reference", ""),
    "stop_type": "pickup",
    "entity": first_pickup["entity"]
})
assert res_bad.status_code == 400
bad_data = json.loads(res_bad.data.decode("utf-8"))
assert not bad_data.get("success")
print(f"[OK] Invalid OTP correctly rejected: {bad_data.get('error')}")

# 3. Test Valid OTP Verification for all stops using server-side OTPs
from marketplace_db import get_db_connection
with get_db_connection() as conn:
    rows = conn.execute("SELECT reference, pickup_otp, delivery_otp FROM delivery_updates").fetchall()
    db_otps = {r["reference"]: {"pickup": str(r["pickup_otp"]), "delivery": str(r["delivery_otp"])} for r in rows}

for s in stops:
    if s["type"] == "ORIGIN":
        continue
    ref = s.get("reference")
    correct_otp = db_otps.get(ref, {}).get(s["otp_type"]) if ref else "4821"
    if not correct_otp:
        continue
    res_ok = client.post("/api/route-optimize/verify-stop", json={
        "stop_id": s["stop_id"],
        "otp": correct_otp,
        "reference": ref or "",
        "stop_type": s["otp_type"],
        "entity": s["entity"]
    })
    assert res_ok.status_code == 200, f"Failed for {s['stop_id']}: {res_ok.data}"
    ok_data = json.loads(res_ok.data.decode("utf-8"))
    assert ok_data.get("success")
    msg = ok_data.get('message', '').encode('ascii', errors='replace').decode('ascii')
    print(f"[OK] Stop {s['stop_id']} ({s['entity']}) verified: {msg}")

print("\n>>> ALL MULTI-STOP ROUTE OTP VERIFICATION TESTS PASSED WITH 100% SUCCESS! <<<")
sys.exit(0)
