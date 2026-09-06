import json
import sys
from app import app

client = app.test_client()

print("--- Testing Facebook Prophet & Searchable Mandi Integration ---")

# 1. Test Mandis API with comprehensive list
print("\n[1] Testing /api/mandis endpoint...")
res = client.get("/api/mandis?commodity=Pumpkin&all=true")
assert res.status_code == 200, f"Mandis API failed: {res.data}"
data = json.loads(res.data.decode("utf-8"))
mandis = data["mandis"]
assert len(mandis) > 100, f"Expected comprehensive India-wide mandis, got {len(mandis)}"

# Check Amrawati in list
amrawati_entries = [m for m in mandis if "amrawati" in m["market"].lower()]
assert len(amrawati_entries) > 0, "Amrawati must be in mandis list"
assert amrawati_entries[0]["has_crop_data"] is True, f"Amrawati should have crop data for Pumpkin: {amrawati_entries[0]}"
print(f"[OK] /api/mandis returned {len(mandis)} APMCs across India, including {amrawati_entries[0]['market']} (has_crop_data: True)")

# 2. Test Ajwan in Radhanpur in mandis
res_aj = client.get("/api/mandis?commodity=Ajwan&all=true")
data_aj = json.loads(res_aj.data.decode("utf-8"))["mandis"]
radhanpur = [m for m in data_aj if "radhanpur" in m["market"].lower()]
assert len(radhanpur) > 0, "Radhanpur must be in Ajwan mandis list"
assert radhanpur[0]["has_crop_data"] is True, f"Radhanpur should have crop data for Ajwan: {radhanpur[0]}"
print(f"[OK] Radhanpur APMC verified with active Ajwan arrival data ({radhanpur[0]['latest_price_kg']} Rs./kg)")

# 3. Test Facebook Prophet on Pumpkin + Amrawati (exact market)
print("\n[2] Testing Facebook Prophet on Pumpkin + Amrawati...")
res_fp1 = client.get("/api/fair-price?crop=Pumpkin&mandi=" + amrawati_entries[0]["market"])
assert res_fp1.status_code == 200, f"Fair price failed: {res_fp1.data}"
fp1_data = json.loads(res_fp1.data.decode("utf-8"))["data"]

assert fp1_data["model_engine"] == "Facebook Prophet", f"Expected Facebook Prophet, got {fp1_data['model_engine']}"
assert fp1_data["current_modal_price_kg"] == 9.57, f"Expected 9.57, got {fp1_data['current_modal_price_kg']}"
assert len(fp1_data["forecast_7_days"]) == 7, "Expected 7 daily predictions"
assert "min" in fp1_data["fair_price_band_kg"]
assert "fair" in fp1_data["fair_price_band_kg"]
assert "max" in fp1_data["fair_price_band_kg"]
print(f"[OK] Pumpkin at Amrawati: Engine = '{fp1_data['model_engine']}', Modal = Rs.{fp1_data['current_modal_price_kg']}/kg, Fair Band = Rs.{fp1_data['fair_price_band_kg']['min']} - Rs.{fp1_data['fair_price_band_kg']['max']}/kg")

# 4. Test Fuzzy query for Amrawati ("Amrawati")
print("\n[3] Testing Fuzzy Mandi Resolution on 'Pumpkin' + 'Amrawati'...")
res_fuzzy = client.get("/api/fair-price?crop=Pumpkin&mandi=Amrawati")
assert res_fuzzy.status_code == 200, f"Fuzzy Amrawati failed: {res_fuzzy.data}"
fuzzy_data = json.loads(res_fuzzy.data.decode("utf-8"))["data"]
assert fuzzy_data["model_engine"] == "Facebook Prophet"
assert fuzzy_data["current_modal_price_kg"] == 9.57
print(f"[OK] Fuzzy query 'Amrawati' cleanly resolved to: {fuzzy_data['mandi']} (Rs.{fuzzy_data['current_modal_price_kg']}/kg)")

# 5. Test Facebook Prophet on Ajwan + Radhanpur
print("\n[4] Testing Facebook Prophet on Ajwan + Radhanpur...")
res_fp2 = client.get("/api/fair-price?crop=Ajwan&mandi=Radhanpur%20Apmc")
assert res_fp2.status_code == 200, f"Ajwan Radhanpur failed: {res_fp2.data}"
fp2_data = json.loads(res_fp2.data.decode("utf-8"))["data"]
assert fp2_data["model_engine"] == "Facebook Prophet"
assert fp2_data["current_modal_price_kg"] == 140.51
print(f"[OK] Ajwan at Radhanpur: Engine = '{fp2_data['model_engine']}', Modal = Rs.{fp2_data['current_modal_price_kg']}/kg, Fair Band = Rs.{fp2_data['fair_price_band_kg']['min']} - Rs.{fp2_data['fair_price_band_kg']['max']}/kg")

# 6. Test Fuzzy query for Radhanpur ("Radhanpur")
res_radh_fuzzy = client.get("/api/fair-price?crop=Ajwan&mandi=Radhanpur")
assert res_radh_fuzzy.status_code == 200
radh_fuzzy_data = json.loads(res_radh_fuzzy.data.decode("utf-8"))["data"]
assert radh_fuzzy_data["model_engine"] == "Facebook Prophet"
assert radh_fuzzy_data["current_modal_price_kg"] == 140.51
print(f"[OK] Fuzzy query 'Radhanpur' cleanly resolved to: {radh_fuzzy_data['mandi']}")

# 7. Test Prototype/Fallback Data when mandi has no arrival data for that crop
print("\n[5] Testing Prototype/Fallback Data handling on Ajwan + Kustagi Apmc...")
res_fallback = client.get("/api/fair-price?crop=Ajwan&mandi=Kustagi%20Apmc")
assert res_fallback.status_code == 200, f"Fallback request should return 200 with fallback data, got: {res_fallback.status_code}"
fallback_data = json.loads(res_fallback.data.decode("utf-8"))["data"]
assert fallback_data["model_engine"] == "Prototype/Fallback Data", f"Expected Prototype/Fallback Data, got {fallback_data['model_engine']}"
assert fallback_data["is_fallback"] is True
assert "unavailable" in fallback_data["fallback_notice"].lower()
print(f"[OK] Fallback test passed: Engine = '{fallback_data['model_engine']}', is_fallback = {fallback_data['is_fallback']}")
print(f"  Notice: {fallback_data['fallback_notice']}")

print("\n>>> ALL FACEBOOK PROPHET & MANDI INTEGRATION TESTS PASSED WITH 100% SUCCESS! <<<")
sys.exit(0)
