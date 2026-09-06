import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def test_all():
    print("==================================================")
    print("1. Testing AI Best Buyer Match for Farmers")
    print("==================================================")
    payload_farmer = {
        "commodity": "Tomato",
        "quantity_kg": 500,
        "asking_price_kg": 22.0,
        "farmer_location": "Gondal APMC, Rajkot"
    }
    req1 = urllib.request.Request(
        "http://127.0.0.1:5000/api/smart-match/best-buyer",
        data=json.dumps(payload_farmer).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req1) as resp:
        res1 = json.loads(resp.read().decode("utf-8"))
        assert res1["success"] is True
        bb = res1["best_buyer"]
        print(f"Top #1 Best Buyer: {bb['buyer_name']} ({bb['buyer_type']})")
        print(f"Badge: {bb['badge']}")
        print(f"Offer Price: Rs {bb['buyer_offer_price_kg']}/kg | Transport Cost: Rs {bb['transport_cost_per_kg']}/kg")
        print(f"Estimated Net Realization: Rs {bb['estimated_net_realization_kg']}/kg | In-Pocket Total: Rs {bb['total_net_realization_inr']}")
        print(f"AI Score: {bb['match_score']}%")
        print(f"Ranking Reason: {bb['ranking_reason']}")
        print("\nTop Alternatives:")
        for alt in res1.get("top_alternatives", []):
            print(f"  * {alt['badge']}: {alt['buyer_name']} ({alt['match_score']}%) | Offer: Rs {alt['buyer_offer_price_kg']}/kg | Net: Rs {alt['estimated_net_realization_kg']}/kg")
            print(f"    Reason: {alt['ranking_reason']}")

    print("\n==================================================")
    print("2. Testing AI Best Farmer Match for Buyers")
    print("==================================================")
    payload_buyer = {
        "commodity": "Tomato",
        "quantity_kg": 100,
        "budget_kg": 25.0,
        "delivery_city": "Ahmedabad"
    }
    req2 = urllib.request.Request(
        "http://127.0.0.1:5000/api/smart-match/best-farmer",
        data=json.dumps(payload_buyer).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req2) as resp:
        res2 = json.loads(resp.read().decode("utf-8"))
        assert res2["success"] is True
        bf = res2["best_farmer"]
        print(f"Top #1 Best Farmer: {bf['farmer_name']}")
        print(f"Badge: {bf['badge']}")
        print(f"Price: Rs {bf['price_per_kg']}/kg | Distance: {bf['distance_km']} km | Savings: Rs {bf['savings_vs_mandi_kg']}/kg")
        print(f"AI Score: {bf['match_score']}%")
        print(f"Rationale: {bf['match_reason']}")
        candidates = res2.get("all_ranked_farmers", [])
        if len(candidates) > 1:
            print(f"Alternatives available: {len(candidates) - 1}")
            for c in candidates[1:3]:
                print(f"  * {c.get('badge')}: {c['farmer_name']} ({c['match_score']}%) - Rs {c['price_per_kg']}/kg")

    print("\n==================================================")
    print("3. Testing Multi-Buyer Lot Allocation (For Farmers)")
    print("==================================================")
    payload_allocation = {
        "commodity": "Tomato",
        "quantity_kg": 500,
        "asking_price_kg": 22.0,
        "location": "Gondal"
    }
    req3 = urllib.request.Request(
        "http://127.0.0.1:5000/api/smart-match",
        data=json.dumps(payload_allocation).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req3) as resp:
        res3 = json.loads(resp.read().decode("utf-8"))
        assert res3["success"] is True
        d = res3["data"]
        print(f"AI Verdict: {d['ai_verdict']}")
        print(f"Fulfillment Rate: {d['fulfillment_rate_pct']}% | Total Revenue: Rs {d['total_revenue_inr']}")
        print(f"Allocated buyers count: {len(d['allocations'])}")

    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    test_all()
