"""
Nexus Mandi Comparator Module
Module 2: Mandi Comparison Dashboard
Ranks reporting mandis for any crop based on net realized price:
Net Price = Mandi Modal Price - Estimated Transport Cost

Features:
- Geo-lookup: Supports latitude & longitude or district name
- Dual distance calculation:
  - Free, zero-API fallback: High-precision Haversine formula against verified Indian mandi coordinates
  - Google Maps Distance Matrix API (optional if GOOGLE_MAPS_API_KEY provided)
- Configurable transport economics:
  - Vehicle rate per km (default ₹25/km for small commercial vehicle / Tata Ace)
  - Estimated load capacity (default 1500 kg / 15 quintals)
  - Net price per kg and per quintal
- Ranks mandis descending by net realized price
- Highlights the top-earning mandi with economic gain summary
"""

import json
import logging
import math
import os
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

from data_cleaner import clean_text
from data_fetcher import get_mandi_data

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))
load_dotenv()
logger = logging.getLogger("NexusComparator")
COORDS_FILE = os.path.join(BASE_DIR, "data", "mandi_coordinates.json")

# Load coordinates dictionary
with open(COORDS_FILE, "r", encoding="utf-8") as f:
    MANDI_COORDINATES = json.load(f)

STATE_CENTROIDS = {
    "gujarat": {"lat": 22.2587, "lng": 71.1924},
    "maharashtra": {"lat": 19.7515, "lng": 75.7139},
    "rajasthan": {"lat": 27.0238, "lng": 74.2179},
    "madhya pradesh": {"lat": 22.9734, "lng": 78.6569},
    "punjab": {"lat": 31.1471, "lng": 75.3412},
    "haryana": {"lat": 29.0588, "lng": 76.0856},
    "delhi": {"lat": 28.7041, "lng": 77.1025},
    "uttar pradesh": {"lat": 26.8467, "lng": 80.9462},
    "karnataka": {"lat": 15.3173, "lng": 75.7139},
    "keralam": {"lat": 10.8505, "lng": 76.2711},
    "kerala": {"lat": 10.8505, "lng": 76.2711},
    "tamil nadu": {"lat": 11.1271, "lng": 78.6569},
    "andhra pradesh": {"lat": 15.9129, "lng": 79.7400},
    "telangana": {"lat": 18.1124, "lng": 79.0193},
    "odisha": {"lat": 20.9517, "lng": 85.0985},
    "west bengal": {"lat": 22.9868, "lng": 87.8550},
    "bihar": {"lat": 25.0961, "lng": 85.3131},
    "chhattisgarh": {"lat": 21.2787, "lng": 81.8661},
    "chattisgarh": {"lat": 21.2787, "lng": 81.8661},
    "jharkhand": {"lat": 23.6102, "lng": 85.2799},
    "himachal pradesh": {"lat": 31.1048, "lng": 77.1734},
    "uttarakhand": {"lat": 30.0668, "lng": 79.0193},
    "assam": {"lat": 26.2006, "lng": 92.9376},
    "tripura": {"lat": 23.9408, "lng": 91.9882},
    "meghalaya": {"lat": 25.4670, "lng": 91.3662},
    "nagaland": {"lat": 26.1584, "lng": 94.5624},
    "jammu and kashmir": {"lat": 33.7782, "lng": 76.5762},
    "goa": {"lat": 15.2993, "lng": 74.1240}
}

ALL_INDIAN_DISTRICTS = {
    # Gujarat All 33 Districts
    "junagadh": {"lat": 21.5222, "lng": 70.4579},
    "rajkot": {"lat": 22.3039, "lng": 70.8022},
    "gondal": {"lat": 21.9619, "lng": 70.7933},
    "amreli": {"lat": 21.6032, "lng": 71.2221},
    "bhavnagar": {"lat": 21.7645, "lng": 72.1519},
    "jamnagar": {"lat": 22.4707, "lng": 70.0577},
    "porbandar": {"lat": 21.6417, "lng": 69.6293},
    "morbi": {"lat": 22.8120, "lng": 70.8378},
    "surendranagar": {"lat": 22.7275, "lng": 71.6370},
    "botad": {"lat": 22.1700, "lng": 71.6600},
    "gir somnath": {"lat": 20.9000, "lng": 70.3600},
    "devbhumi dwarka": {"lat": 22.2400, "lng": 68.9600},
    "kachchh": {"lat": 23.2420, "lng": 69.6669},
    "ahmedabad": {"lat": 23.0225, "lng": 72.5714},
    "gandhinagar": {"lat": 23.2156, "lng": 72.6369},
    "mehsana": {"lat": 23.5880, "lng": 72.3693},
    "patan": {"lat": 23.8493, "lng": 72.1266},
    "banaskantha": {"lat": 24.1724, "lng": 72.4346},
    "banaskanth": {"lat": 24.1724, "lng": 72.4346},
    "sabarkantha": {"lat": 23.5977, "lng": 72.9698},
    "aravalli": {"lat": 23.5300, "lng": 73.2700},
    "kheda": {"lat": 22.7500, "lng": 72.6800},
    "anand": {"lat": 22.5645, "lng": 72.9289},
    "vadodara": {"lat": 22.3072, "lng": 73.1812},
    "panchmahal": {"lat": 22.7758, "lng": 73.6149},
    "dahod": {"lat": 22.8373, "lng": 74.2536},
    "mahisagar": {"lat": 23.1700, "lng": 73.5600},
    "chhotaudepur": {"lat": 22.3000, "lng": 74.0100},
    "bharuch": {"lat": 21.7051, "lng": 72.9959},
    "narmada": {"lat": 21.8700, "lng": 73.5000},
    "surat": {"lat": 21.1702, "lng": 72.8311},
    "tapi": {"lat": 21.2500, "lng": 73.5700},
    "navsari": {"lat": 20.9500, "lng": 72.9300},
    "valsad": {"lat": 20.5992, "lng": 72.9342},
    "dang": {"lat": 20.7600, "lng": 73.7000},

    # Key Maharashtra Districts
    "nashik": {"lat": 19.9975, "lng": 73.7898},
    "pune": {"lat": 18.5204, "lng": 73.8567},
    "solapur": {"lat": 17.6599, "lng": 75.9064},
    "ahmednagar": {"lat": 19.0948, "lng": 74.7480},
    "kolhapur": {"lat": 16.7050, "lng": 74.2433},
    "jalgaon": {"lat": 21.0077, "lng": 75.5626},
    "nagpur": {"lat": 21.1458, "lng": 79.0882},
    "amravati": {"lat": 20.9374, "lng": 77.7796},
    "aurangabad": {"lat": 19.8762, "lng": 75.3433},

    # Key Rajasthan Districts
    "jaipur": {"lat": 26.9124, "lng": 75.7873},
    "kota": {"lat": 25.2138, "lng": 75.8648},
    "jodhpur": {"lat": 26.2389, "lng": 73.0243},
    "bikaner": {"lat": 28.0229, "lng": 73.3119},
    "alwar": {"lat": 27.5530, "lng": 76.6346},
    "ganganagar": {"lat": 29.9094, "lng": 73.8799},
    "sri ganganagar": {"lat": 29.9094, "lng": 73.8799},

    # Key MP Districts
    "indore": {"lat": 22.7196, "lng": 75.8577},
    "ujjain": {"lat": 23.1765, "lng": 75.7885},
    "bhopal": {"lat": 23.2599, "lng": 77.4126},
    "mandsaur": {"lat": 24.0722, "lng": 75.0689},
    "neemuch": {"lat": 24.4578, "lng": 74.8727},

    # Key Punjab & Haryana
    "ludhiana": {"lat": 30.9010, "lng": 75.8573},
    "amritsar": {"lat": 31.6340, "lng": 74.8723},
    "karnal": {"lat": 29.6857, "lng": 76.9905},
    "kurukshetra": {"lat": 29.9695, "lng": 76.8783},
    "hisar": {"lat": 29.1492, "lng": 75.7217},

    # South India
    "ernakulam": {"lat": 9.9816, "lng": 76.2999},
    "kottayam": {"lat": 9.5916, "lng": 76.5222},
    "thrissur": {"lat": 10.5276, "lng": 76.2144},
    "dindigul": {"lat": 10.3673, "lng": 77.9803},
    "dharmapuri": {"lat": 12.1211, "lng": 78.1582},
    "bengaluru": {"lat": 12.9716, "lng": 77.5946},
    "kolar": {"lat": 13.1367, "lng": 78.1291}
}

MICRO_LOCATIONS = {
    # Ahmedabad & Surrounding Agricultural / Urban Hubs
    "sanand farm gate": {"lat": 22.9840, "lng": 72.3780, "district": "Ahmedabad", "state": "Gujarat"},
    "sanand": {"lat": 22.9840, "lng": 72.3780, "district": "Ahmedabad", "state": "Gujarat"},
    "bavla agri belt": {"lat": 22.8360, "lng": 72.3610, "district": "Ahmedabad", "state": "Gujarat"},
    "bavla": {"lat": 22.8360, "lng": 72.3610, "district": "Ahmedabad", "state": "Gujarat"},
    "dholka rural": {"lat": 22.7210, "lng": 72.4410, "district": "Ahmedabad", "state": "Gujarat"},
    "dholka": {"lat": 22.7210, "lng": 72.4410, "district": "Ahmedabad", "state": "Gujarat"},
    "bhavya supermarket": {"lat": 23.0280, "lng": 72.5250, "district": "Ahmedabad", "state": "Gujarat"},
    "satellite": {"lat": 23.0280, "lng": 72.5250, "district": "Ahmedabad", "state": "Gujarat"},
    "sg highway": {"lat": 23.0380, "lng": 72.5120, "district": "Ahmedabad", "state": "Gujarat"},
    "prahlad nagar": {"lat": 23.0120, "lng": 72.5080, "district": "Ahmedabad", "state": "Gujarat"},
    "vastrapur": {"lat": 23.0350, "lng": 72.5280, "district": "Ahmedabad", "state": "Gujarat"},
    "navrangpura": {"lat": 23.0360, "lng": 72.5610, "district": "Ahmedabad", "state": "Gujarat"},
    "maninagar": {"lat": 22.9980, "lng": 72.6020, "district": "Ahmedabad", "state": "Gujarat"},
    "naroda": {"lat": 23.0680, "lng": 72.6580, "district": "Ahmedabad", "state": "Gujarat"},
    "bopal": {"lat": 23.0340, "lng": 72.4640, "district": "Ahmedabad", "state": "Gujarat"},
    "south bopal": {"lat": 23.0210, "lng": 72.4610, "district": "Ahmedabad", "state": "Gujarat"},
    "gota": {"lat": 23.0980, "lng": 72.5350, "district": "Ahmedabad", "state": "Gujarat"},
    "chandkheda": {"lat": 23.1120, "lng": 72.5930, "district": "Ahmedabad", "state": "Gujarat"},
    "motera": {"lat": 23.0990, "lng": 72.5970, "district": "Ahmedabad", "state": "Gujarat"},
    "aslali": {"lat": 22.9150, "lng": 72.5950, "district": "Ahmedabad", "state": "Gujarat"},
    "bareja": {"lat": 22.8850, "lng": 72.5850, "district": "Ahmedabad", "state": "Gujarat"},
    "viramgam": {"lat": 23.1250, "lng": 72.0320, "district": "Ahmedabad", "state": "Gujarat"},

    # Gandhinagar
    "sector 21": {"lat": 23.2350, "lng": 72.6480, "district": "Gandhinagar", "state": "Gujarat"},
    "gandhinagar": {"lat": 23.2156, "lng": 72.6369, "district": "Gandhinagar", "state": "Gujarat"},
    "infocity": {"lat": 23.1950, "lng": 72.6280, "district": "Gandhinagar", "state": "Gujarat"},
    "kalol": {"lat": 23.2380, "lng": 72.4980, "district": "Gandhinagar", "state": "Gujarat"},
    "mansa": {"lat": 23.4250, "lng": 72.6610, "district": "Gandhinagar", "state": "Gujarat"},

    # Vadodara
    "alkapuri": {"lat": 22.3120, "lng": 73.1720, "district": "Vadodara", "state": "Gujarat"},
    "vadodara": {"lat": 22.3072, "lng": 73.1812, "district": "Vadodara", "state": "Gujarat"},
    "sayajigunj": {"lat": 22.3110, "lng": 73.1880, "district": "Vadodara", "state": "Gujarat"},
    "manjalpur": {"lat": 22.2680, "lng": 73.1920, "district": "Vadodara", "state": "Gujarat"},
    "padra": {"lat": 22.2400, "lng": 73.0800, "district": "Vadodara", "state": "Gujarat"},
    "karjan": {"lat": 22.0490, "lng": 73.1210, "district": "Vadodara", "state": "Gujarat"},

    # Surat
    "surat": {"lat": 21.1702, "lng": 72.8311, "district": "Surat", "state": "Gujarat"},
    "adajan": {"lat": 21.1960, "lng": 72.7950, "district": "Surat", "state": "Gujarat"},
    "varachha": {"lat": 21.2150, "lng": 72.8620, "district": "Surat", "state": "Gujarat"},
    "kamrej": {"lat": 21.2720, "lng": 72.9640, "district": "Surat", "state": "Gujarat"},

    # Rajkot & Saurashtra
    "rajkot hub": {"lat": 22.3039, "lng": 70.8022, "district": "Rajkot", "state": "Gujarat"},
    "rajkot": {"lat": 22.3039, "lng": 70.8022, "district": "Rajkot", "state": "Gujarat"},
    "gondal apmc": {"lat": 21.9619, "lng": 70.7933, "district": "Rajkot", "state": "Gujarat"},
    "gondal": {"lat": 21.9619, "lng": 70.7933, "district": "Rajkot", "state": "Gujarat"},
    "junagadh": {"lat": 21.5222, "lng": 70.4579, "district": "Junagadh", "state": "Gujarat"},
    "amreli": {"lat": 21.6032, "lng": 71.2221, "district": "Amreli", "state": "Gujarat"},
    "morbi": {"lat": 22.8120, "lng": 70.8378, "district": "Morbi", "state": "Gujarat"},
    "jamnagar": {"lat": 22.4707, "lng": 70.0577, "district": "Jamnagar", "state": "Gujarat"},
    "bhavnagar": {"lat": 21.7645, "lng": 72.1519, "district": "Bhavnagar", "state": "Gujarat"},

    # South India (Hyderabad, Bengaluru, Kerala, TN)
    "falaknuma": {"lat": 17.3320, "lng": 78.4720, "district": "Hyderabad", "state": "Telangana"},
    "rythu bazar": {"lat": 17.3320, "lng": 78.4720, "district": "Hyderabad", "state": "Telangana"},
    "hyderabad": {"lat": 17.3850, "lng": 78.4867, "district": "Hyderabad", "state": "Telangana"},
    "secunderabad": {"lat": 17.4399, "lng": 78.4983, "district": "Hyderabad", "state": "Telangana"},
    "mukkom": {"lat": 11.3210, "lng": 75.9980, "district": "Kozhikode", "state": "Kerala"},
    "kozhikode": {"lat": 11.2588, "lng": 75.7804, "district": "Kozhikode", "state": "Kerala"},
    "calicut": {"lat": 11.2588, "lng": 75.7804, "district": "Kozhikode", "state": "Kerala"},
    "bengaluru": {"lat": 12.9716, "lng": 77.5946, "district": "Bengaluru Urban", "state": "Karnataka"},
    "kolar": {"lat": 13.1367, "lng": 78.1291, "district": "Kolar", "state": "Karnataka"},
    "koyambedu": {"lat": 13.0694, "lng": 80.1948, "district": "Chennai", "state": "Tamil Nadu"},
    "chennai": {"lat": 13.0827, "lng": 80.2707, "district": "Chennai", "state": "Tamil Nadu"},

    # North / Central / East
    "baripada": {"lat": 21.9346, "lng": 86.7328, "district": "Mayurbhanj", "state": "Odisha"},
    "mayurbhanj": {"lat": 21.9346, "lng": 86.7328, "district": "Mayurbhanj", "state": "Odisha"},
    "mayurbhanja": {"lat": 21.9346, "lng": 86.7328, "district": "Mayurbhanj", "state": "Odisha"},
    "bhubaneswar": {"lat": 20.2961, "lng": 85.8245, "district": "Khordha", "state": "Odisha"},
    "azadpur": {"lat": 28.7150, "lng": 77.1720, "district": "North Delhi", "state": "Delhi"},
    "delhi": {"lat": 28.7041, "lng": 77.1025, "district": "Delhi", "state": "Delhi"},
    "noida": {"lat": 28.5355, "lng": 77.3910, "district": "Gautam Buddha Nagar", "state": "Uttar Pradesh"},
    "gurugram": {"lat": 28.4595, "lng": 77.0266, "district": "Gurugram", "state": "Haryana"},
    "vashi": {"lat": 19.0771, "lng": 72.9986, "district": "Thane", "state": "Maharashtra"},
    "mumbai": {"lat": 19.0760, "lng": 72.8777, "district": "Mumbai", "state": "Maharashtra"},
    "pune": {"lat": 18.5204, "lng": 73.8567, "district": "Pune", "state": "Maharashtra"},
    "nashik": {"lat": 19.9975, "lng": 73.7898, "district": "Nashik", "state": "Maharashtra"},
    "lasalgaon": {"lat": 20.1478, "lng": 74.2256, "district": "Nashik", "state": "Maharashtra"},
    "ludhiana": {"lat": 30.9010, "lng": 75.8573, "district": "Ludhiana", "state": "Punjab"},
    "khanna": {"lat": 30.7071, "lng": 76.2163, "district": "Ludhiana", "state": "Punjab"},
    "amritsar": {"lat": 31.6340, "lng": 74.8723, "district": "Amritsar", "state": "Punjab"},
    "karnal": {"lat": 29.6857, "lng": 76.9905, "district": "Karnal", "state": "Haryana"},
    "indore": {"lat": 22.7196, "lng": 75.8577, "district": "Indore", "state": "Madhya Pradesh"},
    "bhopal": {"lat": 23.2599, "lng": 77.4126, "district": "Bhopal", "state": "Madhya Pradesh"},
    "jaipur": {"lat": 26.9124, "lng": 75.7873, "district": "Jaipur", "state": "Rajasthan"},
    "kota": {"lat": 25.2138, "lng": 75.8648, "district": "Kota", "state": "Rajasthan"},
    "kolkata": {"lat": 22.5726, "lng": 88.3639, "district": "Kolkata", "state": "West Bengal"}
}


def resolve_mandi_destination_coordinates(market: str, district: str, state: str) -> Tuple[float, float, str]:
    """
    Resolves true destination coordinates for a reporting mandi using exact market names,
    substring matching, district registries, or state centroids.
    NEVER uses a local dummy offset.
    """
    m_clean = clean_text(market).lower()
    d_clean = clean_text(district).lower()
    s_clean = clean_text(state).lower()

    # 1. Exact match in MANDI_COORDINATES
    for k, v in MANDI_COORDINATES.items():
        if k.lower() == m_clean:
            return v["lat"], v["lng"], "Verified Mandi Coordinates"

    # 2. Substring match in market name against known mandis
    for k, v in MANDI_COORDINATES.items():
        if k.lower() in m_clean:
            return v["lat"], v["lng"], f"Mandi Registry ({k})"

    # 3. Match in District Coordinates
    for k, v in ALL_INDIAN_DISTRICTS.items():
        if k in d_clean or k in m_clean:
            return v["lat"], v["lng"], f"District ({k.title()})"

    # 4. District match in general registry
    for k, v in MANDI_COORDINATES.items():
        if v.get("district", "").lower() == d_clean:
            return v["lat"], v["lng"], f"District ({v.get('district')})"

    # 5. Fallback to State Centroid
    for k, v in STATE_CENTROIDS.items():
        if k == s_clean or k in s_clean:
            return v["lat"], v["lng"], f"State Centroid ({k.title()})"

    # 6. Default National Centroid
    return 20.5937, 78.9629, "National Geographic Center"


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates great-circle distance between two points on the Earth in kilometers.
    """
    R = 6371.0  # Earth radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)


def get_google_maps_distance(
    origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float, api_key: str
) -> Optional[float]:
    """
    Calls Google Maps Distance Matrix API to get road travel distance.
    Returns distance in km or None if failed.
    """
    if not api_key:
        return None

    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        "origins": f"{origin_lat},{origin_lng}",
        "destinations": f"{dest_lat},{dest_lng}",
        "mode": "driving",
        "key": api_key,
    }

    try:
        r = requests.get(url, params=params, timeout=5)
        if r.status_code == 200:
            res = r.json()
            elements = res.get("rows", [{}])[0].get("elements", [{}])
            if elements and elements[0].get("status") == "OK":
                distance_meters = elements[0]["distance"]["value"]
                return round(distance_meters / 1000.0, 1)
    except Exception as e:
        logger.warning(f"Google Maps API distance check failed: {e}. Falling back to Haversine.")

    return None


REVERSE_GEO_CACHE = {}

def reverse_geocode_coordinates(lat: float, lng: float) -> Dict[str, Any]:
    """
    Resolves GPS latitude and longitude to the exact city/district name
    using OpenStreetMap Nominatim, with fallback to local coordinates registry.
    """
    cache_key = f"{round(lat, 3)},{round(lng, 3)}"
    if cache_key in REVERSE_GEO_CACHE:
        return REVERSE_GEO_CACHE[cache_key]

    # 1. Try high-precision live OpenStreetMap Nominatim lookup
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}"
        headers = {"User-Agent": "NexusAgriculturalIntelligence/1.0"}
        r = requests.get(url, headers=headers, timeout=2.5)
        if r.status_code == 200:
            data = r.json()
            address = data.get("address", {})
            city = (
                address.get("city")
                or address.get("town")
                or address.get("village")
                or address.get("county")
                or address.get("state_district")
                or address.get("suburb")
            )
            district = address.get("state_district") or address.get("county") or city
            state = address.get("state", "")

            if city:
                label = f"{city}, {state} ({lat:.2f}°N, {lng:.2f}°E)" if state else f"{city} ({lat:.2f}°N, {lng:.2f}°E)"
                result = {
                    "market": city,
                    "district": district or city,
                    "state": state,
                    "distance_km": 0.0,
                    "label": label,
                    "source": "OpenStreetMap"
                }
                REVERSE_GEO_CACHE[cache_key] = result
                return result
    except Exception as e:
        logger.warning(f"Nominatim reverse lookup error: {e}. Falling back to local coordinate table.")

    # 2. Local Fallback against verified coordinates registry
    best_name = "Local Region"
    best_dist = float('inf')
    best_info = None

    for name, info in MANDI_COORDINATES.items():
        d = haversine_distance(lat, lng, info['lat'], info['lng'])
        if d < best_dist:
            best_dist = d
            best_name = name
            best_info = info

    if best_info and best_dist <= 250:
        district = best_info.get("district", best_name)
        state = best_info.get("state", "")
        label = f"{best_name}, {state} ({lat:.2f}°N, {lng:.2f}°E)"
        result = {
            "market": best_name,
            "district": district,
            "state": state,
            "distance_km": best_dist,
            "label": label,
            "source": "LocalRegistry"
        }
        REVERSE_GEO_CACHE[cache_key] = result
        return result

    return {
        "market": "Current GPS Location",
        "district": f"{lat:.2f}°N",
        "state": f"{lng:.2f}°E",
        "distance_km": 0.0,
        "label": f"GPS ({lat:.3f}, {lng:.3f})",
        "source": "Coordinates"
    }


def resolve_coordinates(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    location_query: Optional[str] = None
) -> Tuple[Optional[float], Optional[float], str]:
    """
    Resolves input into lat, lng, and location label.
    Supports direct coordinates or district/city/neighborhood names.
    Uses precision micro-locations, mandi registry, district tables, and state centroids.
    """
    if lat is not None and lng is not None and float(lat) != 0 and float(lng) != 0:
        geo = reverse_geocode_coordinates(float(lat), float(lng))
        return float(lat), float(lng), f"Current Location: {geo['label']}"

    if location_query:
        query_clean = clean_text(str(location_query)).lower().strip()
        if not query_clean:
            return 23.0225, 72.5714, "Ahmedabad Central Hub"

        # 1. Check MICRO_LOCATIONS by longest match first
        sorted_micro = sorted(MICRO_LOCATIONS.items(), key=lambda x: len(x[0]), reverse=True)
        for k, v in sorted_micro:
            if k in query_clean:
                loc_desc = f"{v.get('district', '')}, {v.get('state', '')}".strip(', ')
                label = f"{k.title()} ({loc_desc})" if loc_desc else k.title()
                return v["lat"], v["lng"], label

        # 2. Check MANDI_COORDINATES
        for name, info in MANDI_COORDINATES.items():
            n_clean = clean_text(name).lower()
            d_clean = clean_text(info.get("district", "")).lower()
            if n_clean == query_clean or (len(n_clean) >= 4 and n_clean in query_clean):
                return info["lat"], info["lng"], f"{name} ({info.get('state', '')})"
            if d_clean and len(d_clean) >= 4 and d_clean in query_clean:
                return info["lat"], info["lng"], f"{name} ({info.get('district', '')})"

        # 3. Check ALL_INDIAN_DISTRICTS
        for dist_name, dist_info in ALL_INDIAN_DISTRICTS.items():
            if dist_name in query_clean:
                return dist_info["lat"], dist_info["lng"], f"{dist_name.title()} District"

        # 4. Check STATE_CENTROIDS
        for state_name, state_info in STATE_CENTROIDS.items():
            if state_name in query_clean:
                return state_info["lat"], state_info["lng"], f"{state_name.title()} Region"

        # 5. Gujarat fallback or National fallback
        if "gujarat" in query_clean:
            return 23.0225, 72.5714, f"{location_query} (Ahmedabad Hub)"

        return 23.0225, 72.5714, f"{location_query} (Regional Hub)"

    return 23.0225, 72.5714, "Ahmedabad Central Hub"


def compare_mandis_for_crop(
    crop: str,
    farmer_lat: Optional[float] = None,
    farmer_lng: Optional[float] = None,
    farmer_location: Optional[str] = None,
    vehicle_rate_per_km: float = 25.0,  # ₹25 per km typical mini truck freight
    load_capacity_kg: float = 1500.0,   # 1500 kg (15 quintals) standard load
    top_n: int = 8,
    max_radius_km: Optional[float] = None
) -> Dict[str, Any]:
    """
    Ranks reporting mandis by net price.
    Net Price per kg = Mandi Modal Price per kg - (Distance * Rate per km / Load kg)
    """
    crop_clean = clean_text(crop)
    origin_lat, origin_lng, location_desc = resolve_coordinates(farmer_lat, farmer_lng, farmer_location)

    gmaps_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()

    # Get active dataset
    data = get_mandi_data()
    records = data.get("records", [])

    # Filter records for this commodity
    crop_records = [r for r in records if clean_text(r.get("commodity")) == crop_clean]
    if not crop_records:
        return {
            "crop": crop_clean,
            "farmer_location": location_desc,
            "results": [],
            "message": f"No mandis currently reporting live prices for {crop_clean}"
        }

    # Group latest price per mandi
    mandi_latest = {}
    for r in crop_records:
        market = r.get("market")
        date = r.get("arrival_date", "")
        if market not in mandi_latest or date > mandi_latest[market].get("arrival_date", ""):
            mandi_latest[market] = r

    comparison_list = []

    for market_name, record in mandi_latest.items():
        dest_lat, dest_lng, coord_source = resolve_mandi_destination_coordinates(
            market=market_name,
            district=record.get("district", ""),
            state=record.get("state", "")
        )

        # Calculate distance
        distance_km = None
        distance_source = coord_source

        if gmaps_key:
            distance_km = get_google_maps_distance(origin_lat, origin_lng, dest_lat, dest_lng, gmaps_key)
            if distance_km:
                distance_source = "Google Maps Matrix"

        if distance_km is None:
            # Haversine distance with 1.25 road winding factor for Indian roads
            straight_line = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
            distance_km = round(straight_line * 1.25, 1)

        # Logistics calculation
        # Round trip transport cost (farmer transports produce, vehicle returns)
        total_trip_transport_cost = round(distance_km * vehicle_rate_per_km, 2)
        # Transport cost per kg
        transport_cost_per_kg = round(total_trip_transport_cost / max(1.0, load_capacity_kg), 2)
        # Transport cost per quintal (100 kg)
        transport_cost_per_quintal = round(transport_cost_per_kg * 100.0, 2)

        mandi_price_quintal = float(record.get("modal_price", 0.0))
        mandi_price_kg = float(record.get("modal_price_kg", mandi_price_quintal / 100.0))

        net_price_kg = round(mandi_price_kg - transport_cost_per_kg, 2)
        net_price_quintal = round(mandi_price_quintal - transport_cost_per_quintal, 2)

        comparison_list.append({
            "market": market_name,
            "district": record.get("district", ""),
            "state": record.get("state", ""),
            "variety": record.get("variety", "General"),
            "arrival_date": record.get("arrival_date", ""),
            "mandi_price_quintal": mandi_price_quintal,
            "mandi_price_kg": mandi_price_kg,
            "distance_km": distance_km,
            "distance_source": distance_source,
            "total_transport_cost": total_trip_transport_cost,
            "transport_cost_per_kg": transport_cost_per_kg,
            "net_price_kg": net_price_kg,
            "net_price_quintal": net_price_quintal,
            "coordinates": {"lat": dest_lat, "lng": dest_lng},
            "is_nearby": distance_km <= 500.0
        })

    # Optional radius filtering: if requested, filter by max_radius_km
    if max_radius_km and max_radius_km > 0:
        filtered_by_radius = [x for x in comparison_list if x["distance_km"] <= max_radius_km]
        if filtered_by_radius:
            comparison_list = filtered_by_radius

    # Sort descending by net realized price per kg
    comparison_list.sort(key=lambda x: x["net_price_kg"], reverse=True)
    top_results = comparison_list[:top_n]

    # Identify best option and quantify gain
    best_option = top_results[0] if top_results else None
    lowest_option = top_results[-1] if len(top_results) > 1 else None

    net_advantage_kg = 0.0
    net_advantage_trip = 0.0
    if best_option and lowest_option:
        net_advantage_kg = round(best_option["net_price_kg"] - lowest_option["net_price_kg"], 2)
        net_advantage_trip = round(net_advantage_kg * load_capacity_kg, 2)

    return {
        "crop": crop_clean,
        "farmer_location": location_desc,
        "farmer_coordinates": {"lat": origin_lat, "lng": origin_lng},
        "transport_config": {
            "vehicle_rate_per_km": vehicle_rate_per_km,
            "load_capacity_kg": load_capacity_kg
        },
        "best_mandi": best_option["market"] if best_option else None,
        "net_advantage_trip": net_advantage_trip,
        "net_advantage_kg": net_advantage_kg,
        "comparison": top_results
    }
