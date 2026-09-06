"""
Automated Test Suite for AnnDhara:
Farmer Produce -> Buyer Marketplace -> Order Flow Automatic Inventory Deduction

Verifies:
1. Listed lot quantity acts as available inventory.
2. Orders automatically deduct quantity from the database lot.
3. Remaining lot quantity and total lot value (Remaining Qty * Price/kg) update dynamically.
4. Prevents ordering more than currently available quantity.
5. Concurrent/atomic update guards prevent overselling and race conditions.
6. When quantity hits 0 kg, status becomes 'sold_out' and is removed from active marketplace listings.
7. Sold-out lot and deliveries remain safely preserved in historical records.
8. Order cancellation before fulfillment restores the cancelled quantity back to the lot and reactivates it.
9. Verified for Banana and generic produce types (Tomato, Groundnut, etc.).
"""

import sys
import os
import unittest

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from marketplace_db import (
    create_listing,
    get_listing_by_id,
    get_listings,
    get_delivery_by_reference,
)
from app import app


class TestInventoryDeductionFlow(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_complete_banana_inventory_lifecycle(self):
        print("\n--- TEST: Complete Banana Inventory Lifecycle ---")
        # 1. Farmer lists 500 kg Banana at ₹30/kg
        listing = create_listing(
            farmer_name="Rameshwar Patel",
            phone="+91 98251 11111",
            crop="Banana",
            variety="Grand Naine (Fresh)",
            quantity_kg=500.0,
            asking_price_kg=30.0,
            location="Anand APMC, Gujarat",
            state="Gujarat",
            notes="Farmgate fresh banana batch"
        )
        lid = listing["id"]
        self.assertIsNotNone(lid)
        self.assertEqual(listing["quantity_kg"], 500.0)
        self.assertEqual(listing["status"], "active")

        # Verify listing is present in active marketplace
        active_listings = get_listings(crop="Banana")
        banana_ids = [l["id"] for l in active_listings]
        self.assertIn(lid, banana_ids)

        # 2. Buyer 1 orders 100 kg -> automatically update available quantity to 400 kg
        res1 = self.app.post("/api/deliveries", json={
            "crop": "Banana",
            "quantity_kg": 100.0,
            "farmer_name": "Rameshwar Patel",
            "buyer_name": "Buyer Rajesh",
            "pickup_location": "Anand APMC, Gujarat",
            "destination": "Ahmedabad Market",
            "listing_id": lid
        })
        self.assertEqual(res1.status_code, 201)
        data1 = res1.get_json()
        self.assertTrue(data1["success"])
        ref1 = data1["delivery"]["reference"]

        # Check database lot state
        lot_after_order1 = get_listing_by_id(lid)
        self.assertEqual(lot_after_order1["quantity_kg"], 400.0)
        self.assertEqual(lot_after_order1["status"], "active")
        # Calculate Total Lot Value: 400 kg * 30 = ₹12,000
        lot_value1 = lot_after_order1["quantity_kg"] * lot_after_order1["asking_price_kg"]
        self.assertEqual(lot_value1, 12000.0)
        self.assertEqual(data1["delivery"]["remaining_quantity_kg"], 400.0)
        self.assertEqual(data1["delivery"]["remaining_lot_value"], 12000.0)
        print("[OK] Buyer 1 ordered 100 kg -> Available: 400 kg, Lot Value: Rs. 12,000")

        # 3. Buyer 2 orders 150 kg -> automatically update available quantity to 250 kg
        res2 = self.app.post("/api/deliveries", json={
            "crop": "Banana",
            "quantity_kg": 150.0,
            "farmer_name": "Rameshwar Patel",
            "buyer_name": "Buyer Priya",
            "pickup_location": "Anand APMC, Gujarat",
            "destination": "Vadodara Superstore",
            "listing_id": lid
        })
        self.assertEqual(res2.status_code, 201)
        data2 = res2.get_json()
        self.assertTrue(data2["success"])
        ref2 = data2["delivery"]["reference"]

        # Check database lot state
        lot_after_order2 = get_listing_by_id(lid)
        self.assertEqual(lot_after_order2["quantity_kg"], 250.0)
        self.assertEqual(lot_after_order2["status"], "active")
        # Calculate Total Lot Value: 250 kg * 30 = ₹7,500
        lot_value2 = lot_after_order2["quantity_kg"] * lot_after_order2["asking_price_kg"]
        self.assertEqual(lot_value2, 7500.0)
        self.assertEqual(data2["delivery"]["remaining_quantity_kg"], 250.0)
        self.assertEqual(data2["delivery"]["remaining_lot_value"], 7500.0)
        print("[OK] Buyer 2 ordered 150 kg -> Available: 250 kg, Lot Value: Rs. 7,500")

        # 4. Attempt to order more than available quantity (300 kg > 250 kg available)
        res_over = self.app.post("/api/deliveries", json={
            "crop": "Banana",
            "quantity_kg": 300.0,
            "farmer_name": "Rameshwar Patel",
            "buyer_name": "Buyer Greedy",
            "pickup_location": "Anand APMC, Gujarat",
            "destination": "Surat Warehouse",
            "listing_id": lid
        })
        self.assertEqual(res_over.status_code, 400)
        data_over = res_over.get_json()
        self.assertFalse(data_over["success"])
        self.assertIn("Only 250", data_over["error"])
        # Verify lot quantity was not changed
        self.assertEqual(get_listing_by_id(lid)["quantity_kg"], 250.0)
        print("[OK] Overselling correctly blocked: attempt to order 300 kg from 250 kg was rejected")

        # 5. Order the remaining 250 kg -> quantity becomes 0 kg, marked 'sold_out'
        res3 = self.app.post("/api/deliveries", json={
            "crop": "Banana",
            "quantity_kg": 250.0,
            "farmer_name": "Rameshwar Patel",
            "buyer_name": "Buyer Vikram",
            "pickup_location": "Anand APMC, Gujarat",
            "destination": "Rajkot Distribution",
            "listing_id": lid
        })
        self.assertEqual(res3.status_code, 201)
        data3 = res3.get_json()
        self.assertTrue(data3["success"])
        ref3 = data3["delivery"]["reference"]

        # Check database lot state
        lot_after_order3 = get_listing_by_id(lid)
        self.assertEqual(lot_after_order3["quantity_kg"], 0.0)
        self.assertEqual(lot_after_order3["status"], "sold_out")
        self.assertEqual(data3["delivery"]["remaining_quantity_kg"], 0.0)
        self.assertEqual(data3["delivery"]["lot_status"], "sold_out")
        self.assertEqual(data3["delivery"]["remaining_lot_value"], 0.0)
        print("[OK] Remaining 250 kg sold -> Quantity is 0 kg, status is 'sold_out'")

        # 6. Active marketplace listing check: sold-out listing must be removed from active marketplace
        active_listings_now = get_listings(crop="Banana", status="active")
        active_ids = [l["id"] for l in active_listings_now]
        self.assertNotIn(lid, active_ids)
        print("[OK] Sold-out listing is automatically excluded from active Buyer Marketplace")

        # 7. Verify listing is preserved in all/history records
        all_listings = get_listings(crop="Banana", status="all")
        all_ids = [l["id"] for l in all_listings]
        self.assertIn(lid, all_ids)
        history_lot = get_listing_by_id(lid)
        self.assertIsNotNone(history_lot)
        self.assertEqual(history_lot["status"], "sold_out")

        # Verify all 3 delivery records are preserved in database
        self.assertIsNotNone(get_delivery_by_reference(ref1))
        self.assertIsNotNone(get_delivery_by_reference(ref2))
        self.assertIsNotNone(get_delivery_by_reference(ref3))
        print("[OK] Historical records intact: sold-out lot and all delivery orders preserved in database")

        # 8. Order cancellation and inventory restoration
        # Cancel Buyer 1's order (100 kg)
        res_cancel = self.app.post(f"/api/deliveries/{ref1}/cancel", json={
            "reason": "Buyer change of schedule"
        })
        self.assertEqual(res_cancel.status_code, 200)
        cancel_data = res_cancel.get_json()
        self.assertTrue(cancel_data["success"])
        self.assertEqual(cancel_data["delivery"]["status"], "Cancelled")

        # Verify lot inventory is restored by 100 kg and status reverts to 'active'
        lot_after_cancel = get_listing_by_id(lid)
        self.assertEqual(lot_after_cancel["quantity_kg"], 100.0)
        self.assertEqual(lot_after_cancel["status"], "active")
        self.assertEqual(lot_after_cancel["quantity_kg"] * lot_after_cancel["asking_price_kg"], 3000.0)

        # Listing should now reappear in active marketplace!
        reappeared_listings = get_listings(crop="Banana", status="active")
        self.assertIn(lid, [l["id"] for l in reappeared_listings])
        print("[OK] Order cancellation successfully restored 100 kg to lot, status restored to 'active'")

    def test_generic_produce_types_and_atomic_guards(self):
        print("\n--- TEST: Generic Produce Types & Atomic Guards ---")
        # Test with Tomato
        tomato_lot = create_listing(
            farmer_name="Gopalbhai Ahir",
            phone="+91 94282 22222",
            crop="Tomato",
            variety="Hybrid Grade 1",
            quantity_kg=800.0,
            asking_price_kg=22.0,
            location="Gondal APMC, Rajkot",
            state="Gujarat"
        )
        t_id = tomato_lot["id"]

        # Order 500 kg Tomato
        res = self.app.post("/api/deliveries", json={
            "crop": "Tomato",
            "quantity_kg": 500.0,
            "farmer_name": "Gopalbhai Ahir",
            "buyer_name": "Hotel Taj Saurashtra",
            "pickup_location": "Gondal APMC, Rajkot",
            "destination": "Rajkot City",
            "listing_id": t_id
        })
        self.assertEqual(res.status_code, 201)
        t_updated = get_listing_by_id(t_id)
        self.assertEqual(t_updated["quantity_kg"], 300.0)
        self.assertEqual(t_updated["status"], "active")
        print("[OK] Generic crop 'Tomato' successfully deducted: 800 kg -> 300 kg")

        # Test cancellation via status update endpoint
        del_ref = res.get_json()["delivery"]["reference"]
        res_status_cancel = self.app.patch(f"/api/deliveries/{del_ref}/status", json={
            "status": "Cancelled",
            "current_location": "Cancelled before transit"
        })
        self.assertEqual(res_status_cancel.status_code, 200)
        t_restored = get_listing_by_id(t_id)
        self.assertEqual(t_restored["quantity_kg"], 800.0)
        print("[OK] Cancellation via PATCH /status correctly restored 500 kg to Tomato lot (back to 800 kg)")

    def test_concurrent_orders_race_condition_protection(self):
        print("\n--- TEST: Concurrent Race Condition Protection ---")
        import threading
        # Farmer lists 200 kg Cotton
        cotton_lot = create_listing(
            farmer_name="Tribhovandas Patel",
            phone="+91 97230 44444",
            crop="Cotton",
            variety="Shankar-6",
            quantity_kg=200.0,
            asking_price_kg=85.0,
            location="Gondal APMC",
            state="Gujarat"
        )
        c_id = cotton_lot["id"]

        results = []
        # Buyer A and Buyer B both try to order 150 kg at the exact same time (Total = 300 kg > 200 kg available)
        def place_order(buyer_name):
            with app.test_client() as client:
                res = client.post("/api/deliveries", json={
                    "crop": "Cotton",
                    "quantity_kg": 150.0,
                    "farmer_name": "Tribhovandas Patel",
                    "buyer_name": buyer_name,
                    "pickup_location": "Gondal APMC",
                    "destination": "Ahmedabad",
                    "listing_id": c_id
                })
                results.append((buyer_name, res.status_code, res.get_json()))

        t1 = threading.Thread(target=place_order, args=("Buyer Alpha",))
        t2 = threading.Thread(target=place_order, args=("Buyer Beta",))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        successes = [r for r in results if r[1] == 201]
        failures = [r for r in results if r[1] == 400]

        # Exactly ONE must succeed and ONE must fail
        self.assertEqual(len(successes), 1)
        self.assertEqual(len(failures), 1)

        # Remaining quantity must be exactly 50.0 kg (200 - 150)
        final_lot = get_listing_by_id(c_id)
        self.assertEqual(final_lot["quantity_kg"], 50.0)
        self.assertEqual(final_lot["status"], "active")
        print(f"[OK] Concurrency race condition prevented: 1 succeeded, 1 safely rejected. Remaining stock: {final_lot['quantity_kg']} kg")


if __name__ == "__main__":
    unittest.main()
