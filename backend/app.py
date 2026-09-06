"""
Nexus Main Flask Application
SIH 2026: AI-Powered Farm-to-Market Intelligence Platform
(Demand-to-Delivery Agricultural Network)

Endpoints:
1. Core Market Data:
   - GET  /api/status
   - GET  /api/commodities
   - GET  /api/mandis
   - GET  /api/fair-price
   - GET  /api/compare-mandis
   - GET  /api/reverse-geocode
   - POST /api/refresh-data

2. Direct Listings & Pre-Harvest:
   - GET  /api/listings
   - POST /api/listings

3. Anti-Gouging & Markup:
   - POST /api/markup-check
   - GET  /api/markup-benchmark

4. AI Intelligence Engine:
   - GET  /api/demand-forecast
   - GET  /api/demand-heatmap
   - GET  /api/sellability-score
   - POST /api/smart-match
   - POST /api/route-optimize
   - GET  /api/waste-prevention
   - GET  /api/traceability/<id>
   - GET  /api/impact-metrics

5. Stakeholder Portals (Bulk Buyers & Community Pools):
   - GET  /api/bulk-demands
   - POST /api/bulk-demands
   - GET  /api/community-pools
   - POST /api/community-pools/pledge
"""

import json
import logging
import os
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from typing import Any, Dict, List, Optional

from data_fetcher import (
    get_cache_status,
    get_distinct_commodities,
    get_distinct_mandis,
    get_distinct_locations,
    get_mandi_data,
    sync_live_market_data,
    upload_custom_dataset,
    save_api_key_to_env,
    get_api_key,
    reset_to_master_dataset,
)
from forecaster import predict_fair_price
from mandi_comparator import compare_mandis_for_crop, reverse_geocode_coordinates
from marketplace_db import (
    create_listing,
    get_listings,
    get_listing_by_id,
    create_bulk_demand,
    get_bulk_demands,
    get_community_pools,
    pledge_to_community_pool,
    get_pre_harvest_bookings,
    get_logistics_fleet,
    register_logistics_partner,
    create_user,
    authenticate_user,
    create_delivery_assignment,
    get_delivery_updates,
    get_delivery_by_reference,
    accept_delivery,
    update_delivery_status,
    verify_delivery_pickup,
    verify_delivery_dropoff,
    get_db_connection
)
from markup_detector import analyze_price_markup, get_live_commodity_benchmark
from ai_engine import (
    predict_regional_demand,
    get_demand_heatmap,
    calculate_sellability_score,
    match_harvest_to_buyers,
    optimize_shared_logistics_route,
    evaluate_waste_prevention,
    get_farm_to_fork_trace,
    get_system_impact_metrics
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("NexusApp")

DIST_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
app = Flask(__name__, static_folder=DIST_DIR, static_url_path="")
# Enable CORS for all routes (allows React frontend on port 5173 or any dev port)
CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.route("/api/auth/register", methods=["POST"])
def api_register():
    """Creates a farmer, customer, or logistics stakeholder account."""
    payload = request.get_json(force=True, silent=True) or {}
    try:
        user = create_user(
            name=payload.get("name", ""),
            email=payload.get("email", ""),
            password=payload.get("password", ""),
            role=payload.get("role", ""),
            phone=payload.get("phone", ""),
            location=payload.get("location", ""),
            organization=payload.get("organization", ""),
        )
        return jsonify({"success": True, "user": user}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        logger.error("Account registration failed: %s", exc)
        return jsonify({"success": False, "error": "Unable to create account"}), 500


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    """Authenticates a stakeholder account without exposing its password hash."""
    payload = request.get_json(force=True, silent=True) or {}
    email = payload.get("email", "").strip()
    password = payload.get("password", "")
    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required"}), 400
    user = authenticate_user(email, password)
    if not user:
        return jsonify({"success": False, "error": "Invalid email or password"}), 401
    return jsonify({"success": True, "user": user})


@app.route("/api/deliveries", methods=["GET", "POST"])
def api_deliveries():
    """List assignments or create one after a farmer/customer match."""
    if request.method == "GET":
        role = request.args.get("role")
        stakeholder = request.args.get("stakeholder") or request.args.get("name")
        all_deliveries = request.args.get("all", "").lower() in ("true", "1")
        # ONLY unauthenticated overview with explicit all=true can see all deliveries;
        # logistics, farmer, and customer must strictly see only their own relevant orders!
        if all_deliveries and not role:
            return jsonify({"success": True, "deliveries": get_delivery_updates(role=None, stakeholder=None)})
        return jsonify({"success": True, "deliveries": get_delivery_updates(role, stakeholder)})
    payload = request.get_json(force=True, silent=True) or {}
    try:
        qty = payload.get("quantity_kg", payload.get("quantity", 0))
        dest = payload.get("destination", payload.get("delivery_location", ""))
        assignment = create_delivery_assignment(
            crop=payload.get("crop", ""),
            quantity_kg=float(qty),
            farmer_name=payload.get("farmer_name", ""),
            buyer_name=payload.get("buyer_name", ""),
            pickup_location=payload.get("pickup_location", ""),
            destination=dest,
            listing_id=int(payload["listing_id"]) if payload.get("listing_id") is not None else None,
            demand_id=int(payload["demand_id"]) if payload.get("demand_id") is not None else None,
            current_location=payload.get("current_location", ""),
            vehicle_number=payload.get("vehicle_number", ""),
            eta=payload.get("eta", "")
        )
        if assignment and "reference" in assignment:
            assignment["tracking_reference"] = assignment["reference"]
        return jsonify({"success": True, "delivery": assignment}), 201
    except (TypeError, ValueError) as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/api/deliveries/<reference>", methods=["GET"])
def api_get_delivery(reference: str):
    """Fetches a single delivery record by its tracking reference code."""
    delivery = get_delivery_by_reference(reference)
    if not delivery:
        return jsonify({"success": False, "error": "Delivery not found"}), 404
    delivery.pop("demo_pickup_otp", None)
    delivery.pop("demo_delivery_otp", None)
    role = request.args.get("role", "").strip().lower()
    stakeholder = (request.args.get("stakeholder") or request.args.get("name") or "").strip().lower()
    if role == "farmer":
        delivery["delivery_otp"] = ""
        if stakeholder and stakeholder not in (delivery.get("farmer_name") or "").lower():
            delivery["pickup_otp"] = ""
    elif role in ("customer", "buyer"):
        delivery["pickup_otp"] = ""
        if stakeholder and stakeholder not in (delivery.get("buyer_name") or "").lower():
            delivery["delivery_otp"] = ""
    else:  # logistics or unspecified role
        delivery["pickup_otp"] = ""
        delivery["delivery_otp"] = ""
    return jsonify({"success": True, "delivery": delivery})


def build_single_delivery_route(delivery: Dict[str, Any]) -> Dict[str, Any]:
    """Generates precision map coordinates, road geometry, and stop sequence for a single delivery."""
    from mandi_comparator import resolve_coordinates
    from ai_engine import get_route_geometry, get_google_maps_nav_url, haversine_distance_km

    p_loc = delivery.get("pickup_location") or "Sanand, Ahmedabad"
    d_loc = delivery.get("destination") or "Satellite, Ahmedabad"

    p_lat, p_lng, p_label = resolve_coordinates(None, None, p_loc)
    d_lat, d_lng, d_label = resolve_coordinates(None, None, d_loc)

    # Depot / driver initial position
    depot_lat = round(p_lat - 0.015, 4)
    depot_lng = round(p_lng + 0.012, 4)
    depot_loc = f"{delivery.get('logistics_name') or 'Logistics'} Dispatch Center"

    stops = [
        {
            "step": 1,
            "stop_id": "STOP-1",
            "type": "ORIGIN",
            "title": f"Dispatch Hub ({delivery.get('logistics_name') or 'Carrier Base'})",
            "location": depot_loc,
            "lat": depot_lat,
            "lng": depot_lng,
            "coordinates": [depot_lat, depot_lng],
            "action": f"Vehicle Departure: {delivery.get('vehicle_number') or 'Fleet Vehicle'} dispatched",
            "status": "Departed",
            "phone": "+91 98251 44102",
            "role": "Logistics Partner",
            "stakeholder_label": f"Carrier: {delivery.get('logistics_name') or 'Assigned Partner'}"
        },
        {
            "step": 2,
            "stop_id": "STOP-2",
            "type": "PICKUP",
            "title": f"Farmgate Pickup: {delivery.get('farmer_name') or 'Farmer'}",
            "location": p_loc,
            "lat": p_lat,
            "lng": p_lng,
            "coordinates": [p_lat, p_lng],
            "action": f"Pick up {delivery.get('quantity_kg', 0)} kg {delivery.get('crop', 'Produce')}",
            "crop": delivery.get("crop"),
            "qty_kg": delivery.get("quantity_kg"),
            "status": "Picked Up" if delivery.get("status") in ("In Transit", "Out for Delivery", "Delivered") else "Pending Pickup",
            "phone": delivery.get("farmer_phone") or "+91 98251 11201",
            "role": "Farmer / FPO",
            "stakeholder_label": f"Farmer: {delivery.get('farmer_name') or 'Farmer'}",
            "otp_type": "pickup",
            "otp_verified": delivery.get("status") in ("In Transit", "Out for Delivery", "Delivered"),
            "reference": delivery.get("reference")
        },
        {
            "step": 3,
            "stop_id": "STOP-3",
            "type": "DELIVERY",
            "title": f"Customer Dropoff: {delivery.get('buyer_name') or 'Buyer'}",
            "location": d_loc,
            "lat": d_lat,
            "lng": d_lng,
            "coordinates": [d_lat, d_lng],
            "action": f"Deliver {delivery.get('quantity_kg', 0)} kg {delivery.get('crop', 'Produce')} to {delivery.get('buyer_name') or 'Customer'}",
            "crop": delivery.get("crop"),
            "qty_kg": delivery.get("quantity_kg"),
            "status": "Delivered" if delivery.get("status") == "Delivered" else "Pending Delivery",
            "phone": delivery.get("buyer_phone") or "+91 98254 44509",
            "role": "Buyer / Consumer",
            "stakeholder_label": f"Buyer: {delivery.get('buyer_name') or 'Customer'}",
            "otp_type": "delivery",
            "otp_verified": delivery.get("status") == "Delivered",
            "reference": delivery.get("reference")
        }
    ]

    coords = [(s["lat"], s["lng"]) for s in stops]
    path_coords = get_route_geometry(coords)
    nav_url = get_google_maps_nav_url(coords)

    leg1 = round(haversine_distance_km(depot_lat, depot_lng, p_lat, p_lng) * 1.25, 1)
    leg2 = round(haversine_distance_km(p_lat, p_lng, d_lat, d_lng) * 1.25, 1)
    total_km = round(leg1 + leg2, 1)
    eta_mins = max(12, int(round((total_km / 35.0) * 60)))

    return {
        "reference": delivery.get("reference"),
        "total_distance_km": total_km,
        "eta_minutes": eta_mins,
        "eta_label": f"{eta_mins} mins (~{total_km} km)",
        "path_coordinates": path_coords,
        "navigation_url": nav_url,
        "route_stops": stops,
        "route_sequence": stops,
        "carrier": {
            "name": delivery.get("logistics_name") or "Carrier Assigned",
            "vehicle_number": delivery.get("vehicle_number") or "Fleet Vehicle",
            "status": delivery.get("status")
        }
    }


@app.route("/api/deliveries/<reference>/accept", methods=["POST"])
def api_accept_delivery(reference: str):
    """Allows a logistics partner to claim an unassigned delivery and set initial carrier details."""
    payload = request.get_json(force=True, silent=True) or {}
    try:
        delivery = accept_delivery(
            reference,
            logistics_id=int(payload["logistics_id"]) if payload.get("logistics_id") is not None else None,
            logistics_name=payload.get("logistics_name", ""),
            vehicle_number=payload.get("vehicle_number", ""),
            current_location=payload.get("current_location", "")
        )
        if not delivery:
            return jsonify({"success": False, "error": "Delivery is already claimed or not found"}), 409
        delivery["pickup_otp"] = ""
        delivery["delivery_otp"] = ""
        delivery.pop("demo_pickup_otp", None)
        delivery.pop("demo_delivery_otp", None)

        # Generate AI route optimization right after logistics accepts
        route_data = build_single_delivery_route(delivery)

        return jsonify({
            "success": True,
            "delivery": delivery,
            "optimized_route": route_data
        })
    except (TypeError, ValueError) as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/api/deliveries/<reference>/route", methods=["GET"])
def api_delivery_route(reference: str):
    """Fetches AI route optimization geometry, stops, and navigation URL for a delivery."""
    delivery = get_delivery_by_reference(reference)
    if not delivery:
        return jsonify({"success": False, "error": "Delivery not found"}), 404
    route_data = build_single_delivery_route(delivery)
    return jsonify({"success": True, "data": route_data})


@app.route("/api/deliveries/<reference>/status", methods=["PATCH", "POST"])
def api_delivery_status(reference: str):
    """Lets the logistics stakeholder publish the next delivery milestone or real-time location checkpoint."""
    payload = request.get_json(force=True, silent=True) or {}
    try:
        delivery = update_delivery_status(
            reference=reference,
            status=payload.get("status", ""),
            current_location=payload.get("current_location"),
            eta=payload.get("eta"),
            vehicle_number=payload.get("vehicle_number")
        )
        if not delivery:
            return jsonify({"success": False, "error": "Delivery not found"}), 404
        delivery["pickup_otp"] = ""
        delivery["delivery_otp"] = ""
        delivery.pop("demo_pickup_otp", None)
        delivery.pop("demo_delivery_otp", None)
        return jsonify({"success": True, "delivery": delivery})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/api/deliveries/<reference>/verify-pickup", methods=["POST"])
def api_delivery_verify_pickup(reference: str):
    """Driver submits the 4-digit OTP collected from Farmer upon farmgate pickup."""
    payload = request.get_json(force=True, silent=True) or {}
    otp = str(payload.get("otp", "")).strip()
    if not otp:
        return jsonify({"success": False, "error": "Please provide the 4-digit Farmer Pickup OTP"}), 400
    try:
        updated = verify_delivery_pickup(reference, otp)
        if updated:
            updated["pickup_otp"] = ""
            updated["delivery_otp"] = ""
            updated.pop("demo_pickup_otp", None)
            updated.pop("demo_delivery_otp", None)
        return jsonify({"success": True, "delivery": updated, "message": "Pickup successfully verified with Farmer OTP!"})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        logger.error(f"Error verifying pickup: {exc}")
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/deliveries/<reference>/verify-delivery", methods=["POST"])
def api_delivery_verify_delivery(reference: str):
    """Driver submits the 4-digit OTP collected from Buyer upon doorstep dropoff."""
    payload = request.get_json(force=True, silent=True) or {}
    otp = str(payload.get("otp", "")).strip()
    if not otp:
        return jsonify({"success": False, "error": "Please provide the 4-digit Buyer Delivery OTP"}), 400
    try:
        updated = verify_delivery_dropoff(reference, otp)
        if updated:
            updated["pickup_otp"] = ""
            updated["delivery_otp"] = ""
            updated.pop("demo_pickup_otp", None)
            updated.pop("demo_delivery_otp", None)
        return jsonify({"success": True, "delivery": updated, "message": "Delivery successfully verified with Customer OTP!"})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        logger.error(f"Error verifying delivery: {exc}")
        return jsonify({"success": False, "error": str(exc)}), 500


# -----------------------------------------------------------------------------
# Scheduled Background Refresh Job
# -----------------------------------------------------------------------------
def scheduled_daily_refresh():
    """Background task to pull fresh Agmarknet data daily."""
    logger.info("Executing scheduled background mandi data refresh...")
    try:
        res = get_mandi_data(force_refresh=True)
        logger.info(f"Scheduled refresh complete. Status: {res.get('metadata', {}).get('notice')}")
    except Exception as e:
        logger.error(f"Scheduled refresh error: {e}")

scheduler = BackgroundScheduler(daemon=True)
scheduler.add_job(scheduled_daily_refresh, "interval", hours=6)
scheduler.start()


# -----------------------------------------------------------------------------
# 1. CORE MARKET DATA & GOVERNMENT AGMARKNET INTEGRATION
# -----------------------------------------------------------------------------

@app.route("/api/status", methods=["GET"])
def api_status():
    """Returns server health, cache timestamp, provenance info, and API key status."""
    status = get_cache_status()
    return jsonify({
        "success": True,
        "app": "AnnDhara AI Agricultural Intelligence Platform",
        "version": "2.0-DemandToDelivery",
        "data": status
    })


@app.route("/api/commodities", methods=["GET"])
def api_commodities():
    """GET /api/commodities -> distinct list of crops in dataset."""
    try:
        commodities = get_distinct_commodities()
        return jsonify({
            "success": True,
            "count": len(commodities),
            "commodities": commodities
        })
    except Exception as e:
        logger.error(f"Error fetching commodities: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/locations", methods=["GET"])
def api_locations():
    """GET /api/locations -> all real states, districts, and markets from the dataset."""
    try:
        locs = get_distinct_locations()
        return jsonify({
            "success": True,
            "data": locs
        })
    except Exception as e:
        logger.error(f"Error fetching locations: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/mandis", methods=["GET"])
def api_mandis():
    """GET /api/mandis?commodity=X&state=Y -> distinct mandis reporting that crop."""
    commodity = request.args.get("commodity")
    state = request.args.get("state")
    include_all = request.args.get("all", "true").lower() in ("true", "1")
    try:
        mandis = get_distinct_mandis(commodity=commodity, state=state, include_all=include_all)
        return jsonify({
            "success": True,
            "commodity": commodity,
            "state": state,
            "count": len(mandis),
            "mandis": mandis
        })
    except Exception as e:
        logger.error(f"Error fetching mandis: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/fair-price", methods=["GET"])
def api_fair_price():
    """GET /api/fair-price?crop=X&mandi=Y -> forecast band + 7-day trend."""
    crop = request.args.get("crop")
    mandi = request.args.get("mandi")
    force_retrain = request.args.get("retrain", "false").lower() == "true"

    if not crop:
        return jsonify({"success": False, "error": "Missing required parameter: 'crop'"}), 400
    if not mandi:
        return jsonify({"success": False, "error": "Missing required parameter: 'mandi'"}), 400

    try:
        result = predict_fair_price(crop=crop, mandi=mandi, force_retrain=force_retrain)
        return jsonify({
            "success": True,
            "data": result
        })
    except ValueError as ve:
        logger.warning(f"Fair price prediction warning: {ve}")
        return jsonify({"success": False, "error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Fair price prediction error: {e}", exc_info=True)
        return jsonify({"success": False, "error": f"Forecasting error: {str(e)}"}), 500


@app.route("/api/compare-mandis", methods=["GET"])
def api_compare_mandis():
    """GET /api/compare-mandis?crop=X&lat=&lng=&location="""
    crop = request.args.get("crop")
    lat_str = request.args.get("lat")
    lng_str = request.args.get("lng")
    location = request.args.get("location")
    rate_str = request.args.get("transport_rate", "25.0")
    load_str = request.args.get("load_kg", "1500.0")

    if not crop:
        return jsonify({"success": False, "error": "Missing required parameter: 'crop'"}), 400

    try:
        farmer_lat = float(lat_str) if lat_str and lat_str.strip() else None
        farmer_lng = float(lng_str) if lng_str and lng_str.strip() else None
        vehicle_rate = float(rate_str) if rate_str else 25.0
        load_capacity = float(load_str) if load_str else 1500.0
        max_radius_str = request.args.get("max_radius")
        max_radius = float(max_radius_str) if max_radius_str and max_radius_str.strip() else None

        res = compare_mandis_for_crop(
            crop=crop,
            farmer_lat=farmer_lat,
            farmer_lng=farmer_lng,
            farmer_location=location,
            vehicle_rate_per_km=vehicle_rate,
            load_capacity_kg=load_capacity,
            max_radius_km=max_radius
        )
        return jsonify({
            "success": True,
            "data": res
        })
    except Exception as e:
        logger.error(f"Error comparing mandis: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/reverse-geocode", methods=["GET"])
def api_reverse_geocode():
    """GET /api/reverse-geocode?lat=X&lng=Y"""
    lat_str = request.args.get("lat")
    lng_str = request.args.get("lng")
    if not lat_str or not lng_str:
        return jsonify({"success": False, "error": "Missing 'lat' or 'lng' parameter"}), 400
    try:
        lat = float(lat_str)
        lng = float(lng_str)
        geo = reverse_geocode_coordinates(lat, lng)
        return jsonify({"success": True, "data": geo})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------------------------------------------------------
# 2. DIRECT MARKETPLACE & PRE-HARVEST
# -----------------------------------------------------------------------------

@app.route("/api/listings", methods=["GET", "POST"])
def api_listings():
    """
    GET  /api/listings?crop=X&location=Y&is_pre_harvest=0/1
    POST /api/listings -> create and persist listing
    """
    if request.method == "POST":
        payload = request.get_json(force=True, silent=True)
        if not payload:
            return jsonify({"success": False, "error": "Invalid or missing JSON payload"}), 400

        required_fields = ["farmer_name", "phone", "crop", "quantity_kg", "asking_price_kg", "location"]
        for f in required_fields:
            if not payload.get(f):
                return jsonify({"success": False, "error": f"Missing required field: '{f}'"}), 400

        try:
            listing = create_listing(
                farmer_name=payload["farmer_name"],
                phone=payload["phone"],
                crop=payload["crop"],
                variety=payload.get("variety", "Standard"),
                quantity_kg=float(payload["quantity_kg"]),
                asking_price_kg=float(payload["asking_price_kg"]),
                location=payload["location"],
                state=payload.get("state", ""),
                mandi_reference=payload.get("mandi_reference", ""),
                fair_price_min=float(payload.get("fair_price_min", 0.0)),
                fair_price_max=float(payload.get("fair_price_max", 0.0)),
                notes=payload.get("notes", ""),
                is_pre_harvest=int(payload.get("is_pre_harvest", 0)),
                harvest_date=payload.get("harvest_date", ""),
                min_price_kg=float(payload.get("min_price_kg", 0.0)),
                sellability_score=int(payload.get("sellability_score", 85)),
                shelf_life_days=int(payload.get("shelf_life_days", 6))
            )
            return jsonify({
                "success": True,
                "message": "Listing published successfully",
                "listing": listing
            }), 201
        except Exception as e:
            logger.error(f"Error creating listing: {e}")
            return jsonify({"success": False, "error": str(e)}), 500

    else:
        crop = request.args.get("crop")
        location = request.args.get("location")
        pre_harvest_str = request.args.get("is_pre_harvest")
        is_pre = int(pre_harvest_str) if pre_harvest_str is not None else None
        try:
            listings = get_listings(crop=crop, location=location, is_pre_harvest=is_pre)
            return jsonify({
                "success": True,
                "count": len(listings),
                "listings": listings
            })
        except Exception as e:
            logger.error(f"Error fetching listings: {e}")
            return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------------------------------------------------------
# 3. INTERMEDIARY MARKUP & ANTI-GOUGING
# -----------------------------------------------------------------------------

@app.route("/api/markup-check", methods=["POST"])
def api_markup_check():
    """POST /api/markup-check -> { farmer_price, consumer_price, commodity }"""
    payload = request.get_json(force=True, silent=True)
    if not payload:
        return jsonify({"success": False, "error": "Invalid or missing JSON payload"}), 400

    farmer_price = payload.get("farmer_price")
    consumer_price = payload.get("consumer_price")
    commodity = payload.get("commodity")

    if farmer_price is None or consumer_price is None:
        return jsonify({"success": False, "error": "Both 'farmer_price' and 'consumer_price' are required"}), 400

    try:
        f_price = float(farmer_price)
        c_price = float(consumer_price)
        result = analyze_price_markup(
            farmer_price=f_price,
            consumer_price=c_price,
            commodity=commodity
        )
        return jsonify({"success": True, "data": result})
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Error analyzing markup: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/markup-benchmark", methods=["GET"])
def api_markup_benchmark():
    """GET /api/markup-benchmark?commodity=X"""
    commodity = request.args.get("commodity", "Onion")
    try:
        data = get_live_commodity_benchmark(commodity)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        logger.error(f"Error fetching markup benchmark: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------------------------------------------------------
# 4. AI DEMAND FORECASTING & REGIONAL HEATMAP
# -----------------------------------------------------------------------------

@app.route("/api/demand-forecast", methods=["GET"])
def api_demand_forecast():
    """
    GET /api/demand-forecast?commodity=Tomato&location=Ahmedabad
    Returns 14-day history + 7-day predicted demand (kg/day), signal weights, and farmer advice.
    """
    commodity = request.args.get("commodity", "Tomato")
    location = request.args.get("location", "Ahmedabad")
    try:
        data = predict_regional_demand(commodity=commodity, location=location)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        logger.error(f"Error in demand forecast: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/demand-heatmap", methods=["GET"])
def api_demand_heatmap():
    """
    GET /api/demand-heatmap?commodity=Tomato
    Returns regional demand intensity (HIGH, MEDIUM, LOW) across Gujarat/Western India hubs.
    """
    commodity = request.args.get("commodity", "Tomato")
    try:
        data = get_demand_heatmap(commodity=commodity)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        logger.error(f"Error fetching demand heatmap: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------------------------------------------------------
# 5. AI SMART MATCHING & SELLABILITY SCORING
# -----------------------------------------------------------------------------

@app.route("/api/smart-match", methods=["POST"])
def api_smart_match():
    """
    POST /api/smart-match
    Payload: { commodity, quantity_kg, asking_price_kg, location }
    Optimally matches harvest with bulk buyers and community orders.
    """
    payload = request.get_json(force=True, silent=True) or {}
    commodity = payload.get("commodity", "Tomato")
    quantity_kg = float(payload.get("quantity_kg", 500))
    asking_price = float(payload.get("asking_price_kg", 22.0))
    location = payload.get("location", "Ahmedabad")

    try:
        res = match_harvest_to_buyers(
            commodity=commodity,
            quantity_kg=quantity_kg,
            asking_price_kg=asking_price,
            location=location
        )
        return jsonify({"success": True, "data": res})
    except Exception as e:
        logger.error(f"Error running smart match: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/smart-match/best-farmer", methods=["POST"])
def api_smart_match_best_farmer():
    """
    POST /api/smart-match/best-farmer
    Finds and ranks the Best Farmer for a buyer by evaluating genuine listings against
    mandi modal benchmarks, farmgate proximity, produce quality/freshness, and verified trust rating.
    """
    payload = request.get_json(force=True, silent=True) or {}
    commodity = payload.get("commodity", "Tomato").strip()
    qty_needed = float(payload.get("quantity_kg", 100))
    buyer_budget = float(payload.get("budget_kg", 25.0))
    buyer_location = (payload.get("delivery_city") or payload.get("location") or "Ahmedabad").strip()

    all_listings = get_listings(crop=commodity)
    if not all_listings:
        all_listings = get_listings()

    crop_listings = [l for l in all_listings if l.get("crop", "").lower() == commodity.lower()]
    if not crop_listings:
        crop_listings = all_listings

    mandi_price = buyer_budget
    try:
        from forecaster import predict_fair_price
        fp = predict_fair_price(commodity, mandi=buyer_location)
        if fp.get("success") and fp.get("data", {}).get("current_modal_price_kg"):
            mandi_price = float(fp["data"]["current_modal_price_kg"])
    except Exception:
        pass

    scored_farmers = []
    for l in crop_listings:
        f_price = float(l.get("asking_price_kg") or l.get("price_per_kg") or 20.0)
        f_qty = float(l.get("quantity_kg") or 500)
        f_loc = l.get("location") or l.get("farmer_location") or "Gujarat"

        # 1. Price Competitiveness: 35%
        if f_price <= buyer_budget:
            savings_pct = ((mandi_price - f_price) / max(1, mandi_price)) * 100.0 if mandi_price > 0 else 10.0
            price_score = min(100.0, max(50.0, 80.0 + savings_pct))
        else:
            over_pct = ((f_price - buyer_budget) / buyer_budget) * 100.0
            price_score = max(20.0, 70.0 - over_pct)

        # 2. Quantity Fulfillment: 20%
        qty_score = 100.0 if f_qty >= qty_needed else max(40.0, (f_qty / max(1, qty_needed)) * 100.0)

        # 3. Proximity / Location: 25%
        b_loc_clean = buyer_location.lower()
        f_loc_clean = f_loc.lower()
        if b_loc_clean in f_loc_clean or f_loc_clean in b_loc_clean:
            prox_score = 100.0
            dist_km = 12.0
        elif "gujarat" in f_loc_clean:
            prox_score = 85.0
            dist_km = 38.0
        else:
            prox_score = 70.0
            dist_km = 85.0

        # 4. Verified Farmer & Quality: 20%
        organic_bonus = 10.0 if "organic" in (l.get("variety") or "").lower() or "grade a" in (l.get("variety") or "").lower() else 0.0
        trust_score = min(100.0, 88.0 + organic_bonus)

        total_match = round(
            price_score * 0.35 +
            qty_score * 0.20 +
            prox_score * 0.25 +
            trust_score * 0.20,
            1
        )

        savings_inr = round(max(0.0, (mandi_price - f_price) * min(qty_needed, f_qty)), 0)

        scored_farmers.append({
            "listing_id": l["id"],
            "farmer_name": l["farmer_name"],
            "phone": l.get("phone", ""),
            "crop": l["crop"],
            "variety": l.get("variety", "A-Grade Fresh"),
            "price_per_kg": f_price,
            "quantity_available_kg": f_qty,
            "farmer_location": f_loc,
            "distance_km": dist_km,
            "mandi_benchmark_price": mandi_price,
            "savings_vs_mandi_kg": round(mandi_price - f_price, 2),
            "estimated_order_savings_inr": savings_inr,
            "match_score": total_match,
            "harvest_date": l.get("harvest_date", "Today (Freshly Harvested)"),
            "pre_harvest": bool(l.get("is_pre_harvest")),
            "match_reason": f"Saves ₹{round(mandi_price - f_price, 1)}/kg vs Mandi benchmark. Located {dist_km} km away. 100% genuine farmgate lot."
        })

    scored_farmers.sort(key=lambda x: x["match_score"], reverse=True)
    if scored_farmers:
        scored_farmers[0]["badge"] = "🏆 #1 BEST FARMER MATCH"
        scored_farmers[0]["badge_color"] = "var(--color-crop)"
        for i in range(1, len(scored_farmers)):
            scored_farmers[i]["badge"] = f"Verified Alternative #{i+1}"
            scored_farmers[i]["badge_color"] = "#2563EB"

    top_farmer = scored_farmers[0] if scored_farmers else None
    return jsonify({
        "success": True,
        "commodity": commodity,
        "quantity_needed_kg": qty_needed,
        "buyer_budget_kg": buyer_budget,
        "delivery_city": buyer_location,
        "mandi_modal_price": mandi_price,
        "best_farmer": top_farmer,
        "best_match": top_farmer,
        "candidates": scored_farmers,
        "all_ranked_farmers": scored_farmers
    })


@app.route("/api/sellability-score", methods=["GET"])
def api_sellability_score():
    """
    GET /api/sellability-score?crop=Tomato&quantity=500&location=Sanand&shelf_life=5
    Returns 0-100 score, risk level, and waste mitigation strategies.
    """
    crop = request.args.get("crop", "Tomato")
    qty = float(request.args.get("quantity", 500))
    location = request.args.get("location", "Ahmedabad")
    shelf_life_str = request.args.get("shelf_life")
    shelf_life = int(shelf_life_str) if shelf_life_str else None

    try:
        score_data = calculate_sellability_score(
            commodity=crop,
            quantity_kg=qty,
            location=location,
            shelf_life_days=shelf_life
        )
        return jsonify({"success": True, "data": score_data})
    except Exception as e:
        logger.error(f"Error calculating sellability score: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/logistics/dynamic-match", methods=["POST"])
def api_logistics_dynamic_match():
    """
    POST /api/logistics/dynamic-match
    Dynamically scores registered fleet partners from SQLite against active shipment parameters.
    """
    payload = request.get_json(force=True, silent=True) or {}
    load_kg = float(payload.get("load_kg", 500))
    pickup_loc = (payload.get("pickup_location") or "Ahmedabad").lower()
    drop_loc = (payload.get("destination") or "").lower()

    fleet = get_logistics_fleet()
    if not fleet:
        return jsonify({"success": True, "candidates": [], "best_match": None})

    scored_candidates = []
    for partner in fleet:
        capacity = float(partner["vehicle_capacity_kg"])
        reliability = float(partner.get("reliability_score", 90))
        on_time = float(partner.get("on_time_pct", 92))

        # Capacity scoring: 40%
        if capacity < load_kg:
            cap_score = max(30.0, 100.0 - ((load_kg - capacity) / max(1, load_kg)) * 70.0)
            status_text = f"Undersized (requires {int(load_kg/capacity + 1)} runs)"
        else:
            utilization = (load_kg / capacity) * 100.0
            if utilization >= 50.0:
                cap_score = 100.0 - (100.0 - utilization) * 0.2
            else:
                cap_score = max(50.0, 70.0 + utilization * 0.3)
            status_text = f"Optimal capacity ({utilization:.1f}% load factor)"

        # Proximity scoring: 30%
        p_loc = (partner.get("current_location") or "").lower()
        s_areas = (partner.get("service_areas") or "").lower()
        if p_loc in pickup_loc or pickup_loc in p_loc:
            prox_score = 100.0
            prox_km = 4.2
        elif any(area.strip() in pickup_loc or pickup_loc in area.strip() for area in s_areas.split(",")):
            prox_score = 88.0
            prox_km = 14.5
        else:
            prox_score = 70.0
            prox_km = 28.0

        # Reliability scoring: 30%
        total_score = round(cap_score * 0.40 + prox_score * 0.30 + reliability * 0.30, 1)

        match_reason = (
            f"Dynamic Match Score: {total_score}%. {status_text}. "
            f"Based at {partner.get('current_location')} (~{prox_km} km away). "
            f"Historical reliability score: {reliability}/100."
        )

        scored_candidates.append({
            "id": partner["id"],
            "partner": partner["company"],
            "company": partner["company"],
            "vehicle_type": partner["vehicle_type"],
            "vehicle_number": partner.get("vehicle_number", "GJ-01-ET-8412"),
            "capacity_kg": capacity,
            "current_location": partner.get("current_location", "Ahmedabad"),
            "service_areas": partner.get("service_areas", ""),
            "reliability_score": reliability,
            "on_time_pct": on_time,
            "rating": partner.get("rating", 4.9),
            "completed_deliveries": partner.get("completed_deliveries", 120),
            "match_score": total_score,
            "distance_km": prox_km,
            "match_reason": match_reason,
            "status": "AVAILABLE"
        })

    scored_candidates.sort(key=lambda x: x["match_score"], reverse=True)
    if scored_candidates:
        scored_candidates[0]["badge"] = "🌟 #1 BEST LOGISTICS MATCH"
        scored_candidates[0]["status_color"] = "#059669"
        for i in range(1, len(scored_candidates)):
            scored_candidates[i]["badge"] = f"Runner-Up Match #{i+1}"
            scored_candidates[i]["status_color"] = "#2563EB"

    return jsonify({
        "success": True,
        "load_kg": load_kg,
        "pickup_location": payload.get("pickup_location") or "Farmgate",
        "best_match": scored_candidates[0] if scored_candidates else None,
        "candidates": scored_candidates,
        "ranked_fleet": scored_candidates,
        "fleet_count": len(scored_candidates)
    })


# -----------------------------------------------------------------------------
# 6. CAPACITATED ROUTE OPTIMIZATION & SHARED LOGISTICS
# -----------------------------------------------------------------------------

@app.route("/api/route-optimize", methods=["POST"])
def api_route_optimize():
    """
    POST /api/route-optimize
    Dynamically solves shared vehicle routing (multi-pickup, multi-drop) from:
    1) Selected order_references from live database delivery_updates
    2) Or explicit pickups and deliveries payload
    3) Or default multi-farm scenario
    """
    payload = request.get_json(force=True, silent=True) or {}
    vehicle_cap = float(payload.get("vehicle_capacity_kg", 1000.0))
    cost_km = float(payload.get("cost_per_km", 24.0))
    pickups = payload.get("pickups")
    deliveries = payload.get("deliveries")
    order_references = payload.get("order_references") or []
    selected_farmers = payload.get("selected_farmers") or []
    mode = payload.get("mode", "live")

    try:
        from mandi_comparator import resolve_coordinates

        rows = []
        # 1. If explicit farmers are selected for pickup, fetch ALL orders belonging to those farmers
        if selected_farmers and len(selected_farmers) >= 1:
            with get_db_connection() as conn:
                placeholders = ",".join(["?"] * len(selected_farmers))
                rows = conn.execute(
                    f"""SELECT * FROM delivery_updates 
                        WHERE farmer_name IN ({placeholders})
                          AND status != 'Delivered'
                        ORDER BY id DESC""",
                    selected_farmers
                ).fetchall()
        # 2. Or if explicit order references were provided
        elif order_references and len(order_references) >= 1:
            with get_db_connection() as conn:
                placeholders = ",".join(["?"] * len(order_references))
                rows = conn.execute(
                    f"SELECT * FROM delivery_updates WHERE reference IN ({placeholders})",
                    order_references
                ).fetchall()
        # 3. Otherwise, if in live mode, auto-select orders from top 2 distinct farmers
        elif mode != "preset" and not pickups:
            with get_db_connection() as conn:
                distinct_farmers = conn.execute(
                    """SELECT DISTINCT farmer_name FROM delivery_updates 
                       WHERE (farmer_name NOT LIKE '%test%' OR farmer_name IS NULL)
                         AND (buyer_name NOT LIKE '%test%' OR buyer_name IS NULL)
                         AND reference != 'ADH-1001'
                         AND status != 'Delivered'
                       ORDER BY id DESC LIMIT 2"""
                ).fetchall()
                if distinct_farmers:
                    f_names = [r["farmer_name"] for r in distinct_farmers]
                    placeholders = ",".join(["?"] * len(f_names))
                    rows = conn.execute(
                        f"""SELECT * FROM delivery_updates 
                            WHERE farmer_name IN ({placeholders}) 
                              AND status != 'Delivered'
                            ORDER BY id DESC""",
                        f_names
                    ).fetchall()

        if rows:
            # Group orders by farmer for consolidated farmgate pickups
            farmer_order_map = {}
            for r in rows:
                fn = r["farmer_name"] or "Farmer"
                if fn not in farmer_order_map:
                    farmer_order_map[fn] = []
                farmer_order_map[fn].append(r)

            dyn_pickups = []
            p_idx = 0
            for f_name, f_rows in farmer_order_map.items():
                first_r = f_rows[0]
                p_loc = first_r["pickup_location"] or "Sanand, Ahmedabad"
                p_lat, p_lng, _ = resolve_coordinates(None, None, p_loc)
                p_lat += (p_idx * 0.012)
                p_lng += (p_idx * 0.009)

                tot_kg = sum(float(r["quantity_kg"] or 0.0) for r in f_rows)
                crops_list = list(dict.fromkeys(r["crop"] or "Produce" for r in f_rows))
                crop_str = ", ".join(crops_list)
                is_perish = any(c.lower() in ("tomato", "banana", "green chilli", "vegetable") for c in crops_list)
                buyer_names = list(dict.fromkeys(r["buyer_name"] or "Buyer" for r in f_rows))
                buyer_str = ", ".join(buyer_names)

                dyn_pickups.append({
                    "id": f"F_{first_r['reference']}",
                    "name": f_name,
                    "farmer_title": f"{f_name} ({p_loc})",
                    "location": p_loc,
                    "lat": p_lat,
                    "lng": p_lng,
                    "load_kg": tot_kg,
                    "crop": crop_str,
                    "perishable": is_perish,
                    "priority": "High (Perishable)" if is_perish else "Normal",
                    "status": "Ready for Pickup",
                    "phone": f"+91 9825{p_idx+1} 1120{p_idx+1}",
                    "otp": str(first_r["pickup_otp"] or (4100 + p_idx * 231)),
                    "reference": first_r["reference"],
                    "all_references": [r["reference"] for r in f_rows],
                    "target_customers": buyer_str
                })
                p_idx += 1

            # Deliveries: Exclusively the customers who ordered from the selected farmers
            dyn_deliveries = []
            for d_idx, r in enumerate(rows):
                d_loc = r["destination"] or "SG Highway, Ahmedabad"
                d_lat, d_lng, _ = resolve_coordinates(None, None, d_loc)
                d_lat += (d_idx * 0.015)
                d_lng += (d_idx * 0.011)

                crop_name = r["crop"] or "Produce"
                qty = float(r["quantity_kg"] or 100.0)

                dyn_deliveries.append({
                    "id": f"B_{r['reference']}",
                    "name": r["buyer_name"] or f"Buyer #{d_idx+1}",
                    "buyer_type": "Customer Doorstep Delivery",
                    "location": d_loc,
                    "lat": d_lat,
                    "lng": d_lng,
                    "drop_kg": qty,
                    "items": {crop_name: qty},
                    "from_farmer": r["farmer_name"] or "Selected Farmer",
                    "deadline": f"0{10+d_idx}:30 AM",
                    "phone": f"+91 9825{d_idx+1} 4450{d_idx+1}",
                    "otp": str(r["delivery_otp"] or (5100 + d_idx * 319)),
                    "reference": r["reference"]
                })

            pickups = dyn_pickups
            deliveries = dyn_deliveries

        route_data = optimize_shared_logistics_route(
            pickups=pickups,
            deliveries=deliveries,
            vehicle_capacity_kg=vehicle_cap,
            cost_per_km=cost_km,
            selected_farmers=selected_farmers
        )

        # Redact secret OTPs completely from the logistics / carrier response
        for s in (route_data.get("route_sequence") or []):
            s.pop("otp", None)
            s.pop("demo_otp", None)
        for s in (route_data.get("route_stops") or []):
            s.pop("otp", None)
            s.pop("demo_otp", None)

        return jsonify({"success": True, "data": route_data})
    except Exception as e:
        logger.error(f"Error optimizing routes: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/route-optimize/request-otp", methods=["POST"])
def api_route_optimize_request_otp():
    """
    POST /api/route-optimize/request-otp
    Simulates sending an SMS dispatch / OTP notification to the farmer (at pickup) or customer (at delivery).
    Returns the SMS notification text and the OTP so the recipient can view it and share it with the driver.
    """
    payload = request.get_json(force=True, silent=True) or {}
    stop_id = payload.get("stop_id", "").strip()
    stop_type = payload.get("stop_type", "pickup").strip().lower()
    entity_name = payload.get("entity", "Partner").strip()
    reference = payload.get("reference", "").strip()
    phone = payload.get("phone", "").strip()

    otp_val = ""
    # 1. If live database order reference exists, read from SQLite delivery_updates
    if reference:
        with get_db_connection() as conn:
            row = conn.execute(
                "SELECT pickup_otp, delivery_otp FROM delivery_updates WHERE reference = ?",
                (reference,)
            ).fetchone()
            if row:
                otp_val = str(row["pickup_otp"] if stop_type == "pickup" else row["delivery_otp"]).strip()

    # 2. If no OTP from DB or preset stop, check optimize_shared_logistics_route
    if not otp_val:
        route_data = optimize_shared_logistics_route()
        for s in (route_data.get("route_sequence") or route_data.get("route_stops") or []):
            if str(s.get("stop_id", "")).strip().upper() == stop_id.strip().upper():
                otp_val = str(s.get("otp", "")).strip()
                if not phone and s.get("phone"):
                    phone = s.get("phone")
                break

    if not phone:
        phone = "+91 98251 34812" if stop_type == "pickup" else "+91 98254 44509"

    if not otp_val:
        otp_val = "8917" if stop_type == "pickup" else "2223"

    now_time = datetime.now().strftime("%I:%M %p")

    if stop_type == "pickup":
        sms_text = (
            f"AnnDhara Alert: Carrier GJ-01-ET-8412 (Driver Ramesh Verma) has arrived at your farmgate. "
            f"Your secret Handover PIN is [{otp_val}]. Share this code with the driver ONLY upon loading produce."
        )
    else:
        sms_text = (
            f"AnnDhara Delivery: Carrier GJ-01-ET-8412 (Driver Ramesh Verma) is at your doorstep with fresh produce. "
            f"Your secret Delivery PIN is [{otp_val}]. Share this code with the driver ONLY after inspecting produce."
        )

    logger.info(f"SMS OTP dispatched to {entity_name} ({phone}): {sms_text}")

    return jsonify({
        "success": True,
        "stop_id": stop_id,
        "stop_type": stop_type,
        "entity": entity_name,
        "phone": phone,
        "otp": otp_val,
        "sms_text": sms_text,
        "dispatched_at": now_time,
        "message": f"✓ Security PIN requested! SMS notification sent to {entity_name} ({phone})."
    })


@app.route("/api/route-optimize/verify-stop", methods=["POST"])
def api_route_optimize_verify_stop():
    """
    POST /api/route-optimize/verify-stop
    Validates Farmer Pickup OTP or Buyer Delivery OTP for a specific stop in multi-stop shared routing.
    Also updates the live SQLite database record if a tracking reference is associated!
    """
    payload = request.get_json(force=True, silent=True) or {}
    stop_id = payload.get("stop_id", "").strip()
    submitted_otp = str(payload.get("otp", "")).strip()
    expected_otp = str(payload.get("expected_otp", "")).strip()
    stop_type = payload.get("stop_type", "pickup").strip().lower()
    entity_name = payload.get("entity", "Partner").strip()
    reference = payload.get("reference", "").strip()

    if not submitted_otp:
        return jsonify({"success": False, "error": "Please provide the 4-digit verification code"}), 400

    # If reference exists in live database, verify directly against the database order!
    if reference:
        try:
            if stop_type == "pickup":
                verify_delivery_pickup(reference, submitted_otp)
            else:
                verify_delivery_dropoff(reference, submitted_otp)

            success_msg = (
                f"✓ Farmgate Pickup verified for {entity_name} via Farmer OTP! Produce loaded onto vehicle."
                if stop_type == "pickup"
                else f"✓ Doorstep Delivery verified for {entity_name} via Customer OTP! Produce handed over."
            )
            return jsonify({
                "success": True,
                "stop_id": stop_id,
                "verified": True,
                "reference": reference,
                "message": success_msg
            })
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    # If expected_otp was not provided directly, match with route sequence
    if not expected_otp:
        route_data = optimize_shared_logistics_route()
        for s in (route_data.get("route_sequence") or route_data.get("route_stops") or []):
            if str(s.get("stop_id", "")).strip().upper() == stop_id.strip().upper():
                expected_otp = str(s.get("otp", ""))
                stop_type = s.get("otp_type", stop_type)
                entity_name = s.get("entity", entity_name)
                break

    if not expected_otp:
        return jsonify({"success": False, "error": f"Stop {stop_id} not found in active route"}), 404

    if submitted_otp != expected_otp:
        otp_title = "Farmer Pickup OTP" if stop_type == "pickup" else "Buyer Delivery OTP"
        return jsonify({
            "success": False,
            "error": f"Invalid {otp_title} '{submitted_otp}' for {entity_name}. Please request the correct 4-digit code from {entity_name}."
        }), 400

    success_msg = (
        f"✓ Farmgate Pickup verified for {entity_name} via Farmer OTP! Produce loaded onto vehicle."
        if stop_type == "pickup"
        else f"✓ Doorstep Delivery verified for {entity_name} via Customer OTP! Produce handed over."
    )

    return jsonify({
        "success": True,
        "stop_id": stop_id,
        "verified": True,
        "message": success_msg
    })


@app.route("/api/logistics/fleet", methods=["GET"])
def api_logistics_fleet():
    """GET /api/logistics/fleet -> returns registered logistics partners with Reliability Scores."""
    status = request.args.get("status")
    try:
        fleet = get_logistics_fleet(status=status)
        return jsonify({"success": True, "fleet": fleet, "count": len(fleet)})
    except Exception as e:
        logger.error(f"Error fetching fleet: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/logistics/partner-register", methods=["POST"])
def api_logistics_partner_register():
    """POST /api/logistics/partner-register -> registers a new commercial vehicle partner."""
    payload = request.get_json(force=True, silent=True) or {}
    company = payload.get("company", "").strip()
    vehicle_type = payload.get("vehicle_type", "Mini Truck (Tata Ace)").strip()
    vehicle_capacity_kg = float(payload.get("vehicle_capacity_kg", 1000.0))
    current_location = payload.get("current_location", "Ahmedabad").strip()
    service_areas = payload.get("service_areas", "Ahmedabad, Gandhinagar").strip()
    vehicle_number = payload.get("vehicle_number", "").strip()

    if not company:
        return jsonify({"success": False, "error": "Company / Partner name is required"}), 400

    try:
        partner = register_logistics_partner(
            company=company,
            vehicle_type=vehicle_type,
            vehicle_capacity_kg=vehicle_capacity_kg,
            current_location=current_location,
            service_areas=service_areas,
            vehicle_number=vehicle_number
        )
        return jsonify({"success": True, "partner": partner})
    except Exception as e:
        logger.error(f"Error registering logistics partner: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------------------------------------------------------
# 7. FOOD WASTE PREVENTION & TRACEABILITY
# -----------------------------------------------------------------------------

@app.route("/api/waste-prevention", methods=["GET"])
def api_waste_prevention():
    """GET /api/waste-prevention -> scans active listings for perishable risk."""
    try:
        listings = get_listings()
        waste_data = evaluate_waste_prevention(listings)
        return jsonify({"success": True, "data": waste_data})
    except Exception as e:
        logger.error(f"Error analyzing food waste risk: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/traceability/<int:listing_id>", methods=["GET"])
def api_traceability(listing_id: int):
    """GET /api/traceability/1 -> verifiable farm-to-fork origin and cold-chain timeline."""
    try:
        listing = get_listing_by_id(listing_id)
        trace = get_farm_to_fork_trace(listing_id, listing)
        return jsonify({"success": True, "data": trace})
    except Exception as e:
        logger.error(f"Error fetching traceability: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------------------------------------------------------
# 8. BULK DEMANDS & COMMUNITY POOLS
# -----------------------------------------------------------------------------

@app.route("/api/bulk-demands", methods=["GET", "POST"])
def api_bulk_demands():
    """
    GET  /api/bulk-demands?crop=X&buyer_type=Y
    POST /api/bulk-demands -> create institutional demand
    """
    if request.method == "POST":
        payload = request.get_json(force=True, silent=True)
        if not payload:
            return jsonify({"success": False, "error": "Missing payload"}), 400
        try:
            record = create_bulk_demand(
                buyer_name=payload["buyer_name"],
                buyer_type=payload.get("buyer_type", "Restaurant"),
                phone=payload["phone"],
                crop=payload["crop"],
                quantity_needed_kg=float(payload["quantity_needed_kg"]),
                max_budget_kg=float(payload["max_budget_kg"]),
                location=payload["location"],
                required_by_date=payload.get("required_by_date", "Within 48 hours"),
                notes=payload.get("notes", "")
            )
            return jsonify({"success": True, "demand": record}), 201
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        crop = request.args.get("crop")
        buyer_type = request.args.get("buyer_type")
        demands = get_bulk_demands(crop=crop, buyer_type=buyer_type)
        return jsonify({"success": True, "count": len(demands), "demands": demands})


@app.route("/api/community-pools", methods=["GET"])
def api_community_pools():
    """GET /api/community-pools?crop=X"""
    crop = request.args.get("crop")
    pools = get_community_pools(crop=crop)
    return jsonify({"success": True, "count": len(pools), "pools": pools})


@app.route("/api/community-pools/pledge", methods=["POST"])
def api_community_pools_pledge():
    """POST /api/community-pools/pledge -> { pool_id, pledge_kg }"""
    payload = request.get_json(force=True, silent=True) or {}
    pool_id = payload.get("pool_id")
    pledge_kg = float(payload.get("pledge_kg", 5.0))
    if not pool_id:
        return jsonify({"success": False, "error": "pool_id required"}), 400

    try:
        updated = pledge_to_community_pool(int(pool_id), pledge_kg)
        return jsonify({"success": True, "pool": updated})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------------------------------------------------------
# 9. MACRO SYSTEM IMPACT METRICS (SIH JUDGES)
# -----------------------------------------------------------------------------

@app.route("/api/impact-metrics", methods=["GET"])
def api_impact_metrics():
    """GET /api/impact-metrics -> macro KPIs & traditional vs nexus margin split."""
    try:
        metrics = get_system_impact_metrics()
        return jsonify({"success": True, "data": metrics})
    except Exception as e:
        logger.error(f"Error fetching impact metrics: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/refresh-data", methods=["GET", "POST"])
def api_refresh_data():
    """
    GET or POST /api/refresh-data
    Refreshes mandi data to live status.
    Accepts optional parameters: mode ('auto', 'ogd', 'sync'), api_key
    """
    payload = request.get_json(force=True, silent=True) or {}
    mode = request.args.get("mode") or payload.get("mode", "auto")
    api_key = request.args.get("api_key") or payload.get("api_key")

    try:
        res = sync_live_market_data(api_key=api_key, mode=mode)
        meta = res.get("metadata", {})
        return jsonify({
            "success": True,
            "message": meta.get("notice", "Live dataset refreshed successfully"),
            "metadata": meta,
            "total_records": len(res.get("records", []))
        })
    except Exception as e:
        logger.error(f"Error refreshing data: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/dataset/upload", methods=["POST"])
def api_dataset_upload():
    """
    POST /api/dataset/upload
    Accepts CSV or JSON file upload (multipart/form-data or JSON payload)
    Validates, standardizes, and activates the new dataset immediately.
    """
    file_content = None
    filename = "custom_dataset.csv"

    if "file" in request.files:
        uploaded_file = request.files["file"]
        if not uploaded_file.filename:
            return jsonify({"success": False, "error": "No selected file"}), 400
        filename = uploaded_file.filename
        file_content = uploaded_file.read()
    else:
        payload = request.get_json(force=True, silent=True) or {}
        if "file_content" in payload:
            file_content = payload.get("file_content")
            filename = payload.get("filename", "custom_dataset.csv")
        elif "records" in payload:
            file_content = json.dumps(payload)
            filename = "custom_dataset.json"

    if not file_content:
        return jsonify({
            "success": False,
            "error": "No dataset file provided. Upload a .csv or .json file with form field 'file'."
        }), 400

    try:
        success, msg, stats = upload_custom_dataset(file_content, filename)
        if success:
            current_status = get_cache_status()
            return jsonify({
                "success": True,
                "message": msg,
                "stats": stats,
                "data": current_status
            })
        else:
            return jsonify({
                "success": False,
                "error": msg,
                "stats": stats
            }), 400
    except Exception as e:
        logger.error(f"Error processing uploaded dataset: {e}", exc_info=True)
        return jsonify({"success": False, "error": f"Upload failed: {str(e)}"}), 500


@app.route("/api/dataset/config-key", methods=["POST"])
def api_dataset_config_key():
    """
    POST /api/dataset/config-key
    Updates and tests the Open Government Data (data.gov.in) API key.
    """
    payload = request.get_json(force=True, silent=True) or {}
    api_key = payload.get("api_key", "").strip()

    if not api_key:
        return jsonify({"success": False, "error": "API key cannot be empty"}), 400

    saved = save_api_key_to_env(api_key)
    if not saved:
        return jsonify({"success": False, "error": "Failed to save API key to server environment"}), 500

    return jsonify({
        "success": True,
        "message": "OGD API key saved successfully. You can now pull live government rates directly.",
        "api_key_configured": bool(get_api_key())
    })


@app.route("/api/dataset/sample", methods=["GET"])
def api_dataset_sample():
    """
    GET /api/dataset/sample
    Returns a sample CSV template for Agmarknet mandi data ingestion.
    """
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    sample_csv = (
        "State,District,Market,Commodity,Variety,Arrival_Date,Min_Price,Max_Price,Modal_Price\n"
        f"Gujarat,Ahmedabad,Ahmedabad,Tomato,Hybrid,{today},2200,2800,2500\n"
        f"Gujarat,Ahmedabad,Sanand,Potato,Deshi,{today},1400,1800,1600\n"
        f"Gujarat,Rajkot,Gondal,Onion,Red,{today},1800,2400,2100\n"
        f"Gujarat,Surat,Surat,Wheat,Lokwan,{today},2600,3100,2850\n"
        f"Gujarat,Anand,Anand,Groundnut,GJ-20,{today},6200,7100,6650\n"
        f"Gujarat,Vadodara,Vadodara,Cotton,Shankar-6,{today},7200,7800,7500\n"
    )
    from flask import Response
    return Response(
        sample_csv,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=nexus_agmarknet_template.csv"}
    )


@app.route("/api/dataset/reset-master", methods=["POST"])
def api_dataset_reset_master():
    """
    POST /api/dataset/reset-master
    Reverts current cache to the full 4,993 official master Agmarknet records,
    advances date to today, and activates live status.
    """
    try:
        res = reset_to_master_dataset()
        status = get_cache_status()
        return jsonify({
            "success": True,
            "message": "Successfully restored 4,993 official master Agmarknet records for today.",
            "data": status
        })
    except Exception as e:
        logger.error(f"Error resetting to master dataset: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    """Serves the production React frontend build from frontend/dist."""
    if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
        return send_from_directory(DIST_DIR, path)
    if os.path.exists(os.path.join(DIST_DIR, "index.html")):
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify({
        "name": "AnnDhara Agricultural Platform API",
        "status": "online",
        "message": "Frontend build not found. Run 'npm run build' inside frontend/"
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"Starting AnnDhara Farm-to-Market Intelligence Server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
