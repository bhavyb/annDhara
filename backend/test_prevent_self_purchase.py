import unittest
import json
from app import app
from marketplace_db import create_listing, get_listing_by_id, get_db_connection

class TestPreventSelfPurchase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

        # Create a test listing owned by Farmer Haresh Patel (user_id 999)
        self.listing = create_listing(
            farmer_name="Haresh Patel",
            phone="+91 98989 12345",
            crop="Capsicum",
            quantity_kg=300.0,
            asking_price_kg=35.0,
            location="Gondal APMC, Rajkot, Gujarat",
            user_id=999
        )
        self.lid = self.listing["id"]

    def tearDown(self):
        with get_db_connection() as conn:
            conn.execute("DELETE FROM delivery_updates WHERE listing_id = ?", (self.lid,))
            conn.execute("DELETE FROM listings WHERE id = ?", (self.lid,))
            conn.commit()

    def test_other_buyer_can_purchase(self):
        """A different buyer should be able to purchase normally."""
        res = self.app.post("/api/deliveries", json={
            "crop": "Capsicum",
            "quantity_kg": 50.0,
            "farmer_name": "Haresh Patel",
            "buyer_name": "Surat Fresh Foods",
            "pickup_location": "Gondal APMC, Rajkot, Gujarat",
            "destination": "Surat Market",
            "listing_id": self.lid,
            "buyer_user_id": 888,
            "buyer_phone": "+91 97123 45678"
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["delivery"]["remaining_quantity_kg"], 250.0)

    def test_farmer_cannot_purchase_own_listing_by_name(self):
        """A farmer trying to buy their own listing using identical name must be blocked."""
        res = self.app.post("/api/deliveries", json={
            "crop": "Capsicum",
            "quantity_kg": 20.0,
            "farmer_name": "Haresh Patel",
            "buyer_name": "Haresh Patel",
            "pickup_location": "Gondal APMC, Rajkot, Gujarat",
            "destination": "Rajkot City",
            "listing_id": self.lid
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("cannot purchase their own produce", data["error"])

    def test_farmer_cannot_purchase_own_listing_by_phone(self):
        """A farmer trying to buy using matching phone number must be blocked."""
        res = self.app.post("/api/deliveries", json={
            "crop": "Capsicum",
            "quantity_kg": 20.0,
            "farmer_name": "Haresh Patel",
            "buyer_name": "Alias Name",
            "pickup_location": "Gondal APMC, Rajkot, Gujarat",
            "destination": "Rajkot City",
            "listing_id": self.lid,
            "buyer_phone": "9898912345"
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("cannot purchase their own produce", data["error"])

    def test_farmer_cannot_purchase_own_listing_by_user_id(self):
        """A farmer trying to buy using matching user_id must be blocked."""
        res = self.app.post("/api/deliveries", json={
            "crop": "Capsicum",
            "quantity_kg": 20.0,
            "farmer_name": "Haresh Patel",
            "buyer_name": "Different Display Name",
            "pickup_location": "Gondal APMC, Rajkot, Gujarat",
            "destination": "Rajkot City",
            "listing_id": self.lid,
            "buyer_user_id": 999
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("cannot purchase their own produce", data["error"])

if __name__ == "__main__":
    unittest.main()
