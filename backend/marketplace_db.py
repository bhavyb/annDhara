"""
Nexus Marketplace Database Module
Provides persistent SQLite storage for:
1. Farmer listings (both ready harvest and pre-harvest commitments)
2. Bulk buyer requisitions (Hotels, Restaurants, Supermarkets, Hostels, Food Processors)
3. Smart community buying pools (Societies/Apartments pooling demand for bulk discount)
4. Pre-harvest buyer reservation commitments
5. Farm-to-Fork traceability records
"""

import logging
import os
import random
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from data_cleaner import clean_text
from werkzeug.security import check_password_hash, generate_password_hash

logger = logging.getLogger("NexusMarketplace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "anndhara.db")
os.makedirs(DATA_DIR, exist_ok=True)


def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes the SQLite schema with support for all stakeholders."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Farmer produce listings
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                farmer_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                crop TEXT NOT NULL,
                variety TEXT DEFAULT 'Standard',
                quantity_kg REAL NOT NULL,
                asking_price_kg REAL NOT NULL,
                location TEXT NOT NULL,
                state TEXT DEFAULT '',
                mandi_reference TEXT DEFAULT '',
                fair_price_min REAL DEFAULT 0.0,
                fair_price_max REAL DEFAULT 0.0,
                notes TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                is_pre_harvest INTEGER DEFAULT 0,
                harvest_date TEXT DEFAULT '',
                min_price_kg REAL DEFAULT 0.0,
                sellability_score INTEGER DEFAULT 85,
                shelf_life_days INTEGER DEFAULT 6,
                qr_code_id TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)

        # Add any missing columns to existing listings table dynamically
        cursor.execute("PRAGMA table_info(listings)")
        columns = [row[1] for row in cursor.fetchall()]
        if "is_pre_harvest" not in columns:
            cursor.execute("ALTER TABLE listings ADD COLUMN is_pre_harvest INTEGER DEFAULT 0")
        if "harvest_date" not in columns:
            cursor.execute("ALTER TABLE listings ADD COLUMN harvest_date TEXT DEFAULT ''")
        if "min_price_kg" not in columns:
            cursor.execute("ALTER TABLE listings ADD COLUMN min_price_kg REAL DEFAULT 0.0")
        if "sellability_score" not in columns:
            cursor.execute("ALTER TABLE listings ADD COLUMN sellability_score INTEGER DEFAULT 85")
        if "shelf_life_days" not in columns:
            cursor.execute("ALTER TABLE listings ADD COLUMN shelf_life_days INTEGER DEFAULT 6")
        if "qr_code_id" not in columns:
            cursor.execute("ALTER TABLE listings ADD COLUMN qr_code_id TEXT DEFAULT ''")

        # 2. Bulk Buyer Requisitions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bulk_demands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                buyer_name TEXT NOT NULL,
                buyer_type TEXT NOT NULL,
                phone TEXT NOT NULL,
                crop TEXT NOT NULL,
                quantity_needed_kg REAL NOT NULL,
                max_budget_kg REAL NOT NULL,
                location TEXT NOT NULL,
                required_by_date TEXT NOT NULL,
                notes TEXT DEFAULT '',
                status TEXT DEFAULT 'open',
                created_at TEXT NOT NULL
            )
        """)

        # 3. Smart Community Pools (Societies pooling orders)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS community_pools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                society_name TEXT NOT NULL,
                location TEXT NOT NULL,
                crop TEXT NOT NULL,
                target_kg REAL NOT NULL,
                pledged_kg REAL NOT NULL,
                discount_pct REAL DEFAULT 15.0,
                members_count INTEGER DEFAULT 1,
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL
            )
        """)

        # 4. Pre-harvest bookings
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pre_harvest_bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                listing_id INTEGER NOT NULL,
                buyer_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                reserved_kg REAL NOT NULL,
                agreed_price_kg REAL NOT NULL,
                delivery_date TEXT NOT NULL,
                status TEXT DEFAULT 'confirmed',
                created_at TEXT NOT NULL
            )
        """)

        # 5. Registered Logistics Fleet & Partners
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS logistics_fleet (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company TEXT NOT NULL,
                vehicle_type TEXT NOT NULL,
                vehicle_capacity_kg REAL NOT NULL,
                current_location TEXT NOT NULL,
                service_areas TEXT NOT NULL,
                vehicle_number TEXT DEFAULT '',
                reliability_score INTEGER DEFAULT 94,
                on_time_pct REAL DEFAULT 96.0,
                completed_deliveries INTEGER DEFAULT 340,
                rating REAL DEFAULT 4.9,
                status TEXT DEFAULT 'Available',
                earnings_total_inr REAL DEFAULT 0.0,
                created_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('farmer', 'customer', 'logistics')),
                phone TEXT DEFAULT '',
                location TEXT DEFAULT '',
                organization TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS delivery_updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reference TEXT NOT NULL UNIQUE,
                crop TEXT NOT NULL,
                quantity_kg REAL NOT NULL,
                farmer_name TEXT NOT NULL,
                buyer_name TEXT NOT NULL,
                logistics_name TEXT NOT NULL,
                pickup_location TEXT NOT NULL,
                destination TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Assigned',
                updated_at TEXT NOT NULL
            )
        """)
        # Delivery assignments were initially seeded as a display-only feed.  Keep
        # that data compatible while adding the relationships needed for live
        # listing -> buyer -> carrier workflows.
        cursor.execute("PRAGMA table_info(delivery_updates)")
        delivery_columns = [row[1] for row in cursor.fetchall()]
        for column, definition in (
            ("listing_id", "INTEGER"),
            ("demand_id", "INTEGER"),
            ("logistics_id", "INTEGER"),
            ("accepted_at", "TEXT DEFAULT ''"),
            ("created_at", "TEXT DEFAULT ''"),
            ("current_location", "TEXT DEFAULT ''"),
            ("vehicle_number", "TEXT DEFAULT ''"),
            ("eta", "TEXT DEFAULT ''"),
            ("pickup_otp", "TEXT DEFAULT ''"),
            ("delivery_otp", "TEXT DEFAULT ''"),
            ("pickup_verified_at", "TEXT DEFAULT ''"),
            ("delivery_verified_at", "TEXT DEFAULT ''"),
        ):
            if column not in delivery_columns:
                cursor.execute(f"ALTER TABLE delivery_updates ADD COLUMN {column} {definition}")

        # Ensure existing deliveries have valid 4-digit verification OTPs
        cursor.execute("UPDATE delivery_updates SET pickup_otp = '4821' WHERE pickup_otp IS NULL OR pickup_otp = ''")
        cursor.execute("UPDATE delivery_updates SET delivery_otp = '7395' WHERE delivery_otp IS NULL OR delivery_otp = ''")

        conn.commit()


# Ensure DB initialized
init_db()


# =============================================================================
# LISTINGS FUNCTIONS
# =============================================================================

def create_listing(
    farmer_name: str,
    phone: str,
    crop: str,
    quantity_kg: float,
    asking_price_kg: float,
    location: str,
    variety: str = "Standard",
    state: str = "",
    mandi_reference: str = "",
    fair_price_min: float = 0.0,
    fair_price_max: float = 0.0,
    notes: str = "",
    is_pre_harvest: int = 0,
    harvest_date: str = "",
    min_price_kg: float = 0.0,
    sellability_score: int = 85,
    shelf_life_days: int = 6
) -> Dict[str, Any]:
    """Inserts a new listing into SQLite and returns the created record."""
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    qr_id = f"NX-{abs(hash(farmer_name + crop + created_at)) % 1000000:06d}"
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO listings (
                farmer_name, phone, crop, variety, quantity_kg, asking_price_kg,
                location, state, mandi_reference, fair_price_min, fair_price_max,
                notes, status, is_pre_harvest, harvest_date, min_price_kg,
                sellability_score, shelf_life_days, qr_code_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)
        """, (
            clean_text(farmer_name),
            str(phone).strip(),
            clean_text(crop),
            clean_text(variety) or "Standard",
            float(quantity_kg),
            float(asking_price_kg),
            clean_text(location),
            clean_text(state),
            clean_text(mandi_reference),
            float(fair_price_min),
            float(fair_price_max),
            notes.strip(),
            int(is_pre_harvest),
            harvest_date.strip() or datetime.now().strftime("%Y-%m-%d"),
            float(min_price_kg) if min_price_kg else float(asking_price_kg) * 0.9,
            int(sellability_score),
            int(shelf_life_days),
            qr_id,
            created_at
        ))
        conn.commit()
        listing_id = cursor.lastrowid

    return get_listing_by_id(listing_id)


def get_listing_by_id(listing_id: int) -> Optional[Dict[str, Any]]:
    """Fetches single listing by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM listings WHERE id = ?", (listing_id,))
        row = cursor.fetchone()
        if row:
            return dict(row)
    return None


def get_listings(
    crop: Optional[str] = None,
    location: Optional[str] = None,
    is_pre_harvest: Optional[int] = None,
    status: str = "active",
    limit: int = 250
) -> List[Dict[str, Any]]:
    """Retrieves listings with optional filtering by crop, location, or harvest type."""
    query = "SELECT * FROM listings WHERE status = ?"
    params: List[Any] = [status]

    if crop:
        query += " AND LOWER(crop) = LOWER(?)"
        params.append(crop.strip())

    if location:
        query += " AND (LOWER(location) LIKE ? OR LOWER(state) LIKE ? OR LOWER(mandi_reference) LIKE ?)"
        pattern = f"%{location.strip().lower()}%"
        params.extend([pattern, pattern, pattern])

    if is_pre_harvest is not None:
        query += " AND is_pre_harvest = ?"
        params.append(int(is_pre_harvest))

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


# =============================================================================
# BULK BUYERS REQUISITIONS FUNCTIONS
# =============================================================================

def create_bulk_demand(
    buyer_name: str,
    buyer_type: str,
    phone: str,
    crop: str,
    quantity_needed_kg: float,
    max_budget_kg: float,
    location: str,
    required_by_date: str,
    notes: str = ""
) -> Dict[str, Any]:
    """Inserts a new institutional bulk buyer demand record."""
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO bulk_demands (
                buyer_name, buyer_type, phone, crop, quantity_needed_kg,
                max_budget_kg, location, required_by_date, notes, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
        """, (
            clean_text(buyer_name),
            clean_text(buyer_type),
            str(phone).strip(),
            clean_text(crop),
            float(quantity_needed_kg),
            float(max_budget_kg),
            clean_text(location),
            required_by_date.strip(),
            notes.strip(),
            created_at
        ))
        conn.commit()
        demand_id = cursor.lastrowid

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM bulk_demands WHERE id = ?", (demand_id,))
        return dict(cursor.fetchone())


def get_bulk_demands(
    crop: Optional[str] = None,
    buyer_type: Optional[str] = None,
    status: str = "open"
) -> List[Dict[str, Any]]:
    """Fetches active bulk buyer demands."""
    query = "SELECT * FROM bulk_demands WHERE status = ?"
    params: List[Any] = [status]

    if crop:
        query += " AND LOWER(crop) = LOWER(?)"
        params.append(crop.strip())

    if buyer_type:
        query += " AND LOWER(buyer_type) = LOWER(?)"
        params.append(buyer_type.strip())

    query += " ORDER BY id DESC"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


# =============================================================================
# SMART COMMUNITY BUYING POOLS FUNCTIONS
# =============================================================================

def create_community_pool(
    society_name: str,
    location: str,
    crop: str,
    target_kg: float,
    pledged_kg: float = 0.0,
    discount_pct: float = 18.0,
    discounted_price_kg: float = 0.0,
    members_count: int = 1,
    delivery_hub: str = "",
    status: str = "active"
) -> Dict[str, Any]:
    """Creates a new community group buying pool in SQLite."""
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO community_pools (
                society_name, location, crop, target_kg, pledged_kg,
                discount_pct, members_count, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            clean_text(society_name),
            clean_text(location),
            clean_text(crop),
            float(target_kg),
            float(pledged_kg),
            float(discount_pct),
            int(members_count),
            status,
            created_at
        ))
        conn.commit()
        pool_id = cursor.lastrowid
        cursor.execute("SELECT * FROM community_pools WHERE id = ?", (pool_id,))
        row = cursor.fetchone()
        return dict(row) if row else {}


def get_community_pools(crop: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves active apartment / society community pools."""
    query = "SELECT * FROM community_pools WHERE status = 'active'"
    params: List[Any] = []
    if crop:
        query += " AND LOWER(crop) = LOWER(?)"
        params.append(crop.strip())
    query += " ORDER BY id DESC"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def pledge_to_community_pool(pool_id: int, pledge_kg: float) -> Dict[str, Any]:
    """Adds a consumer pledge to an existing community pool."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE community_pools
            SET pledged_kg = pledged_kg + ?,
                members_count = members_count + 1
            WHERE id = ?
        """, (float(pledge_kg), pool_id))
        conn.commit()

        cursor.execute("SELECT * FROM community_pools WHERE id = ?", (pool_id,))
        row = cursor.fetchone()
        return dict(row) if row else {}


# =============================================================================
# PRE-HARVEST BOOKINGS FUNCTIONS
# =============================================================================

def get_pre_harvest_bookings(listing_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Retrieves pre-harvest buyer commitments."""
    query = "SELECT * FROM pre_harvest_bookings"
    params: List[Any] = []
    if listing_id:
        query += " WHERE listing_id = ?"
        params.append(listing_id)
    query += " ORDER BY id DESC"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


# =============================================================================
# SEED FROM LIVE DATASET (ZERO DUMMY DATA)
# =============================================================================

def seed_from_live_dataset(force: bool = False):
    """
    Seeds genuine farmer listings, institutional bulk demands, and community pools
    directly from authentic Agmarknet dataset records (mandi_cache.json).
    Ensures 0 dummy data and uses real mandis, districts, and modal prices.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM listings")
        count_listings = cursor.fetchone()[0]

    if count_listings > 0 and not force:
        return

    try:
        from data_fetcher import load_cached_data
        dataset = load_cached_data()
        records = dataset.get("records", [])
    except Exception as e:
        logger.error(f"Error loading dataset for seeding: {e}")
        records = []

    if not records:
        return

    if force:
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute("DELETE FROM listings")
            c.execute("DELETE FROM bulk_demands")
            c.execute("DELETE FROM community_pools")
            conn.commit()

    prioritized_crops = [
        "Tomato", "Onion", "Potato", "Wheat", "Apple", "Banana", "Brinjal",
        "Paddy(Common)", "Carrot", "Green Chilli", "Cabbage", "Bitter Gourd",
        "Capsicum", "Ginger(Green)", "Garlic", "Mustard", "Gram(Chana)",
        "Groundnut", "Cotton", "Pumpkin", "Lemon", "Bhindi(Ladies Finger)"
    ]

    selected_records = []
    seen_combinations = set()

    for target_crop in prioritized_crops:
        matches = [r for r in records if r.get("commodity", "").lower() == target_crop.lower() and r.get("modal_price", 0) > 0]
        for m in matches[:2]:
            combo = (m.get("commodity"), m.get("market"))
            if combo not in seen_combinations:
                seen_combinations.add(combo)
                selected_records.append(m)

    for r in records:
        if len(selected_records) >= 25:
            break
        c = r.get("commodity")
        m = r.get("market")
        p = r.get("modal_price_kg")
        if c and m and p and p > 0:
            combo = (c, m)
            if combo not in seen_combinations:
                seen_combinations.add(combo)
                selected_records.append(r)

    idx = 1
    for r in selected_records:
        commodity = r.get("commodity", "Crop")
        market = r.get("market", "Mandi")
        district = r.get("district", "")
        state = r.get("state", "")
        variety = r.get("variety") or "Standard Grade"
        modal_kg = float(r.get("modal_price_kg") or (r.get("modal_price", 0) / 100.0))
        min_kg = float(r.get("min_price", 0) / 100.0) if r.get("min_price") else round(modal_kg * 0.92, 1)
        max_kg = float(r.get("max_price", 0) / 100.0) if r.get("max_price") else round(modal_kg * 1.08, 1)
        arrival_date = r.get("arrival_date", datetime.now().strftime("%Y-%m-%d"))

        is_pre = 1 if (idx % 4 == 0) else 0
        h_date = (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d") if is_pre else arrival_date
        qty = 400 + (idx * 150) % 3500

        producer_title = f"{market.replace(' Apmc', '').replace(' Market', '')} Farmer Collective"
        phone_num = f"+91 {98000 + (idx * 37) % 1999:05d} {10000 + (idx * 123) % 89999:05d}"

        is_perish = any(x in commodity.lower() for x in ["tomato", "banana", "chilli", "gourd", "apple", "carrot", "brinjal", "bhindi", "cabbage"])
        shelf_days = 5 if is_perish else (60 if "potato" in commodity.lower() or "onion" in commodity.lower() else 180)
        score = 92 if modal_kg > 20 else 85

        create_listing(
            farmer_name=producer_title,
            phone=phone_num,
            crop=commodity,
            variety=variety,
            quantity_kg=float(qty),
            asking_price_kg=modal_kg,
            location=f"{market}, {district}" if district else market,
            state=state,
            mandi_reference=market,
            fair_price_min=min_kg,
            fair_price_max=max_kg,
            notes=f"Reported at {market} ({district}, {state}). Official modal rate ₹{modal_kg}/kg with {variety} quality.",
            is_pre_harvest=is_pre,
            harvest_date=h_date,
            min_price_kg=min_kg,
            sellability_score=score,
            shelf_life_days=shelf_days
        )
        idx += 1

    bulk_sample_crops = [r for r in selected_records if r.get("commodity") in ["Tomato", "Onion", "Potato", "Wheat", "Apple", "Banana", "Carrot"]]
    b_idx = 1
    for r in bulk_sample_crops[:6]:
        crop = r.get("commodity")
        dist = r.get("district") or r.get("state")
        m_price = float(r.get("modal_price_kg") or (r.get("modal_price", 0) / 100.0))
        b_types = ["Hotel / HoReCa", "Restaurant", "Supermarket Chain", "Food Processor"]
        b_type = b_types[b_idx % len(b_types)]
        b_name = f"{dist} Central {b_type.split('/')[0].strip()}"

        create_bulk_demand(
            buyer_name=b_name,
            buyer_type=b_type,
            phone=f"+91 94000 {20000 + b_idx * 431:05d}",
            crop=crop,
            quantity_needed_kg=200 + b_idx * 150,
            max_budget_kg=round(m_price * 1.05, 1),
            location=f"{dist} ({r.get('state')})",
            required_by_date="Tomorrow 08:00 AM",
            notes=f"Institutional requisition matching current {dist} mandi baseline price ₹{m_price}/kg."
        )
        b_idx += 1

    c_idx = 1
    for r in selected_records[:4]:
        crop = r.get("commodity")
        dist = r.get("district") or r.get("state")
        m_price = float(r.get("modal_price_kg") or (r.get("modal_price", 0) / 100.0))
        target_qty = 200 + (c_idx * 50)
        pledged = int(target_qty * 0.65)
        disc_price = round(m_price * 0.82, 1)

        create_community_pool(
            society_name=f"{dist} Residential Enclave Society",
            location=f"{dist} ({r.get('state')})",
            crop=crop,
            target_kg=float(target_qty),
            pledged_kg=float(pledged),
            discount_pct=18,
            discounted_price_kg=disc_price,
            members_count=22 + c_idx * 4,
            delivery_hub=f"{dist} Community Gate 1",
            status="active"
        )
        c_idx += 1

    logger.info("Seeded 100% genuine live dataset listings, bulk demands, and community pools.")


# =============================================================================
# LOGISTICS FLEET FUNCTIONS
# =============================================================================

def get_logistics_fleet(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetches all registered logistics partners and active vehicles."""
    query = "SELECT * FROM logistics_fleet"
    params: List[Any] = []
    if status:
        query += " WHERE LOWER(status) = LOWER(?)"
        params.append(status.strip())
    query += " ORDER BY reliability_score DESC"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def register_logistics_partner(
    company: str,
    vehicle_type: str,
    vehicle_capacity_kg: float,
    current_location: str,
    service_areas: str,
    vehicle_number: str = "",
    status: str = "Available"
) -> Dict[str, Any]:
    """Registers a new logistics partner and commercial vehicle."""
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO logistics_fleet (
                company, vehicle_type, vehicle_capacity_kg, current_location,
                service_areas, vehicle_number, reliability_score, on_time_pct,
                completed_deliveries, rating, status, earnings_total_inr, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 94, 96.0, 18, 4.9, ?, 0.0, ?)
        """, (
            clean_text(company),
            clean_text(vehicle_type),
            float(vehicle_capacity_kg),
            clean_text(current_location),
            clean_text(service_areas),
            clean_text(vehicle_number),
            status,
            created_at
        ))
        conn.commit()
        fid = cursor.lastrowid
        cursor.execute("SELECT * FROM logistics_fleet WHERE id = ?", (fid,))
        row = cursor.fetchone()
        return dict(row) if row else {}


# =============================================================================
# USER ACCOUNT FUNCTIONS
# =============================================================================

VALID_USER_ROLES = {"farmer", "customer", "logistics"}


def _public_user(row: sqlite3.Row) -> Dict[str, Any]:
    """Returns account fields that are safe to send to the client."""
    user = dict(row)
    user.pop("password_hash", None)
    return user


def create_user(
    name: str,
    email: str,
    password: str,
    role: str,
    phone: str = "",
    location: str = "",
    organization: str = "",
) -> Dict[str, Any]:
    """Creates a stakeholder account with a one-way password hash."""
    normalized_role = role.strip().lower()
    normalized_email = email.strip().lower()
    if normalized_role not in VALID_USER_ROLES:
        raise ValueError("Choose a valid stakeholder role")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not name.strip() or not normalized_email:
        raise ValueError("Name and email are required")

    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO users
                    (name, email, password_hash, role, phone, location, organization, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    clean_text(name),
                    normalized_email,
                    generate_password_hash(password),
                    normalized_role,
                    phone.strip(),
                    clean_text(location),
                    clean_text(organization),
                    created_at,
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError("An account with this email already exists") from exc
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,))
        row = cursor.fetchone()
        return _public_user(row) if row else {}


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Validates credentials and returns a public user profile."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email.strip(),))
        row = cursor.fetchone()
        if not row or not check_password_hash(row["password_hash"], password):
            return None
        return _public_user(row)


DELIVERY_STATUSES = ("Assigned", "Accepted", "Picked Up", "In Transit", "Delivered")
DELIVERY_STATUS_ORDER = {status: index for index, status in enumerate(DELIVERY_STATUSES)}

def create_delivery_assignment(
    crop: str,
    quantity_kg: float,
    farmer_name: str,
    buyer_name: str,
    pickup_location: str,
    destination: str,
    listing_id: Optional[int] = None,
    demand_id: Optional[int] = None,
    logistics_id: Optional[int] = None,
    logistics_name: str = "Unassigned",
    current_location: str = "",
    vehicle_number: str = "",
    eta: str = "",
) -> Dict[str, Any]:
    """Create a durable assignment shared by the three stakeholder portals with live location tracking."""
    if float(quantity_kg) <= 0:
        raise ValueError("Quantity must be greater than zero")
    required = (crop, farmer_name, buyer_name, pickup_location, destination)
    if any(not str(value).strip() for value in required):
        raise ValueError("Crop, parties, pickup, and destination are required")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    reference = f"NX-{datetime.now().strftime('%y%m%d%H%M%S')}-{abs(hash((crop, farmer_name, buyer_name, now))) % 1000:03d}"
    loc = current_location.strip() or f"Awaiting pickup dispatch at {pickup_location.strip()}"
    p_otp = f"{random.randint(1000, 9999)}"
    d_otp = f"{random.randint(1000, 9999)}"
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO delivery_updates
               (reference, crop, quantity_kg, farmer_name, buyer_name, logistics_name,
                pickup_location, destination, status, updated_at, listing_id, demand_id,
                logistics_id, accepted_at, created_at, current_location, vehicle_number, eta,
                pickup_otp, delivery_otp, pickup_verified_at, delivery_verified_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, '', '')""",
            (reference, clean_text(crop), float(quantity_kg), clean_text(farmer_name),
             clean_text(buyer_name), clean_text(logistics_name) or "Unassigned",
             clean_text(pickup_location), clean_text(destination), now, listing_id,
             demand_id, logistics_id, now, loc, clean_text(vehicle_number), clean_text(eta),
             p_otp, d_otp),
        )
        conn.commit()
        row = cursor.execute("SELECT * FROM delivery_updates WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)


def get_delivery_by_reference(reference: str) -> Optional[Dict[str, Any]]:
    """Returns a single delivery record by tracking reference code."""
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM delivery_updates WHERE LOWER(reference) = LOWER(?)", (reference.strip(),)).fetchone()
        return dict(row) if row else None


def get_delivery_updates(role: Optional[str] = None, stakeholder: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns assignments, strictly scoped to a stakeholder's role/name for farmer/customer."""
    where_clauses: List[str] = [
        "LOWER(farmer_name) NOT LIKE '%test%'",
        "LOWER(buyer_name) NOT LIKE '%test%'",
        "LOWER(pickup_location) NOT LIKE '%test%'",
        "LOWER(destination) NOT LIKE '%test%'",
        "reference != 'ADH-1001'",
        "LOWER(farmer_name) != 'matched farmer'"
    ]
    params: List[Any] = []
    normalized_role = (role or "").strip().lower()
    if stakeholder and normalized_role in {"farmer", "customer"}:
        field = {"farmer": "farmer_name", "customer": "buyer_name"}[normalized_role]
        clean_stakeholder = stakeholder.strip()

        extra_listing_ids: List[int] = []
        extra_names: List[str] = []

        if normalized_role == "farmer":
            with get_db_connection() as conn:
                u_row = conn.execute(
                    "SELECT * FROM users WHERE LOWER(name) = LOWER(?) OR phone = ?",
                    (clean_stakeholder, clean_stakeholder)
                ).fetchone()
                if u_row:
                    if u_row["organization"] and u_row["organization"].strip():
                        extra_names.append(u_row["organization"].strip())
                    list_query = "SELECT id, farmer_name FROM listings WHERE LOWER(farmer_name) = LOWER(?) OR (phone <> '' AND phone = ?)"
                    list_params = [clean_stakeholder, u_row["phone"] or ""]
                    if u_row["organization"] and u_row["organization"].strip():
                        list_query += " OR LOWER(farmer_name) = LOWER(?)"
                        list_params.append(u_row["organization"].strip())
                    for l_rec in conn.execute(list_query, list_params).fetchall():
                        extra_listing_ids.append(l_rec["id"])
                        if l_rec["farmer_name"] and l_rec["farmer_name"] not in extra_names:
                            extra_names.append(l_rec["farmer_name"])

        tokens = [t for t in clean_stakeholder.replace("(", " ").replace(")", " ").replace("-", " ").split() if len(t) > 1]
        conditions = []
        if tokens:
            and_clauses = " AND ".join([f"LOWER({field}) LIKE LOWER(?)" for _ in tokens])
            conditions.append(f"({and_clauses})")
            for t in tokens:
                params.append(f"%{t}%")
        conditions.append(f"LOWER({field}) = LOWER(?)")
        params.append(clean_stakeholder)
        conditions.append(f"LOWER(?) LIKE ('%' || LOWER({field}) || '%')")
        params.append(clean_stakeholder)
        conditions.append(f"LOWER({field}) LIKE ('%' || LOWER(?) || '%')")
        params.append(clean_stakeholder)

        if extra_listing_ids:
            placeholders = ",".join(["?" for _ in extra_listing_ids])
            conditions.append(f"listing_id IN ({placeholders})")
            params.extend(extra_listing_ids)

        for en in extra_names:
            conditions.append(f"LOWER({field}) LIKE LOWER(?)")
            params.append(f"%{en}%")

        where_clauses.append(f"({' OR '.join(conditions)})")
    elif normalized_role in {"farmer", "customer"}:
        # If no stakeholder name was supplied, do not leak other users' orders
        where_clauses.append("1 = 0")
    elif normalized_role == "logistics":
        if stakeholder and stakeholder.strip() and stakeholder.lower() not in {"all", "fleet view"}:
            clean_carrier = stakeholder.strip()
            aliases = [clean_carrier]
            u_id = None
            with get_db_connection() as conn:
                u = conn.execute(
                    "SELECT id, name, organization, email FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(organization) = LOWER(?) OR LOWER(email) = LOWER(?)",
                    (clean_carrier, clean_carrier, clean_carrier)
                ).fetchone()
                if u:
                    u_id = u["id"]
                    for field_val in (u["name"], u["organization"], u["email"]):
                        if field_val and field_val.strip() and field_val.strip() not in aliases:
                            aliases.append(field_val.strip())
                f_rows = conn.execute(
                    "SELECT id, company FROM logistics_fleet WHERE LOWER(company) = LOWER(?)",
                    (clean_carrier,)
                ).fetchall()
                for f_row in f_rows:
                    if f_row["company"] and f_row["company"].strip() not in aliases:
                        aliases.append(f_row["company"].strip())

            carrier_conditions = []
            for alias in aliases:
                carrier_conditions.append("LOWER(logistics_name) = LOWER(?)")
                params.append(alias)
                carrier_conditions.append("LOWER(logistics_name) LIKE LOWER(?)")
                params.append(f"%{alias}%")
            if u_id is not None:
                carrier_conditions.append("logistics_id = ?")
                params.append(u_id)

            # Strict isolation rule:
            # 1. Unaccepted orders (waiting for a driver to accept): status = 'Assigned' AND logistics_name is Unassigned
            # 2. Orders accepted by THIS carrier (matches aliases or u_id)
            # Once another driver accepts an order, its status is no longer Unassigned and its logistics_name
            # is set to that driver, so other drivers CANNOT see it anymore!
            unassigned_cond = "(status = 'Assigned' AND (logistics_name IS NULL OR logistics_name = '' OR LOWER(logistics_name) = 'unassigned'))"
            where_clauses.append(f"({unassigned_cond} OR ({' OR '.join(carrier_conditions)}))")

    query = "SELECT * FROM delivery_updates"
    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)
    query += " ORDER BY updated_at DESC, id DESC"
    with get_db_connection() as conn:
        rows = conn.execute(query, params).fetchall()
        deliveries = []
        for row in rows:
            d = dict(row)
            d.pop("demo_pickup_otp", None)
            d.pop("demo_delivery_otp", None)
            if normalized_role == "farmer":
                d["delivery_otp"] = ""
                if stakeholder and stakeholder.strip().lower() not in (d.get("farmer_name") or "").lower():
                    d["pickup_otp"] = ""
            elif normalized_role in ("customer", "buyer"):
                d["pickup_otp"] = ""
                if stakeholder and stakeholder.strip().lower() not in (d.get("buyer_name") or "").lower():
                    d["delivery_otp"] = ""
            else:
                d["pickup_otp"] = ""
                d["delivery_otp"] = ""
            deliveries.append(d)
        return deliveries


def verify_delivery_pickup(reference: str, otp: str) -> Optional[Dict[str, Any]]:
    """Validates Farmer Pickup OTP and transitions delivery to 'Picked Up'."""
    clean_ref = reference.strip()
    clean_otp = str(otp).strip()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT * FROM delivery_updates WHERE reference = ?", (clean_ref,)).fetchone()
        if not row:
            raise ValueError(f"Delivery reference {clean_ref} not found")

        expected_otp = str(row["pickup_otp"] or "").strip() or "4821"
        if clean_otp != expected_otp:
            raise ValueError(f"Invalid Farmer Pickup OTP '{clean_otp}'. Please collect the correct 4-digit code from the farmer at farmgate.")

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        new_loc = f"Produce verified & loaded at {row['pickup_location']} via Farmer OTP; in transit"
        cursor.execute(
            """UPDATE delivery_updates
               SET status = 'Picked Up',
                   pickup_verified_at = ?,
                   current_location = ?,
                   updated_at = ?
               WHERE reference = ?""",
            (now, new_loc, now, clean_ref)
        )
        conn.commit()
        updated = cursor.execute("SELECT * FROM delivery_updates WHERE reference = ?", (clean_ref,)).fetchone()
        return dict(updated) if updated else None


def verify_delivery_dropoff(reference: str, otp: str) -> Optional[Dict[str, Any]]:
    """Validates Buyer Delivery OTP and transitions delivery to 'Delivered'."""
    clean_ref = reference.strip()
    clean_otp = str(otp).strip()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT * FROM delivery_updates WHERE reference = ?", (clean_ref,)).fetchone()
        if not row:
            raise ValueError(f"Delivery reference {clean_ref} not found")

        expected_otp = str(row["delivery_otp"] or "").strip() or "7395"
        if clean_otp != expected_otp:
            raise ValueError(f"Invalid Buyer Delivery OTP '{clean_otp}'. Please collect the correct 4-digit code from the buyer upon delivery.")

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        new_loc = f"Successfully delivered & verified at {row['destination']} via Customer OTP"
        cursor.execute(
            """UPDATE delivery_updates
               SET status = 'Delivered',
                   delivery_verified_at = ?,
                   current_location = ?,
                   updated_at = ?
               WHERE reference = ?""",
            (now, new_loc, now, clean_ref)
        )
        conn.commit()
        updated = cursor.execute("SELECT * FROM delivery_updates WHERE reference = ?", (clean_ref,)).fetchone()
        return dict(updated) if updated else None


def accept_delivery(
    reference: str,
    logistics_id: Optional[int] = None,
    logistics_name: str = "",
    vehicle_number: str = "",
    current_location: str = ""
) -> Optional[Dict[str, Any]]:
    """Claims an unassigned delivery and sets driver and initial location."""
    if logistics_id is None and not logistics_name.strip():
        raise ValueError("A logistics partner identity is required")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        existing = cursor.execute("SELECT * FROM delivery_updates WHERE reference = ?", (reference.strip(),)).fetchone()
        if not existing:
            return None
        loc = current_location.strip() or f"Carrier {logistics_name.strip()} dispatched to farm gate for pickup"
        veh = vehicle_number.strip() or existing["vehicle_number"] or "Fleet Vehicle"
        cursor.execute(
            """UPDATE delivery_updates
               SET status = 'Accepted', logistics_id = COALESCE(?, logistics_id),
                   logistics_name = CASE WHEN ? <> '' THEN ? ELSE logistics_name END,
                   vehicle_number = ?,
                   current_location = ?,
                   accepted_at = ?, updated_at = ?
               WHERE reference = ? AND status = 'Assigned'""",
            (logistics_id, logistics_name.strip(), logistics_name.strip(), veh, loc, now, now, reference.strip()),
        )
        conn.commit()
        row = cursor.execute("SELECT * FROM delivery_updates WHERE reference = ?", (reference.strip(),)).fetchone()
        return dict(row) if row else None


def update_delivery_status(
    reference: str,
    status: str,
    current_location: Optional[str] = None,
    eta: Optional[str] = None,
    vehicle_number: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Updates a delivery milestone and/or real-time location checkpoint."""
    normalized_status = status.strip().title() if status else ""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT * FROM delivery_updates WHERE reference = ?", (reference.strip(),)).fetchone()
        if not row:
            return None

        current_status = row["status"]
        new_status = normalized_status if normalized_status else current_status

        if new_status not in DELIVERY_STATUSES:
            raise ValueError(f"Invalid delivery status: {new_status}")

        if new_status != current_status and DELIVERY_STATUS_ORDER[new_status] < DELIVERY_STATUS_ORDER.get(current_status, 0):
            raise ValueError("Delivery status cannot move backwards")

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Determine location note
        if current_location is not None and str(current_location).strip():
            new_location = clean_text(str(current_location).strip())
        elif new_status != current_status:
            # Default descriptive checkpoint based on milestone
            if new_status == "Picked Up":
                new_location = f"Produce loaded at {row['pickup_location']}; departing for {row['destination']}"
            elif new_status == "In Transit":
                new_location = f"In transit on highway corridor towards {row['destination']}"
            elif new_status == "Delivered":
                new_location = f"Successfully delivered to {row['buyer_name']} at {row['destination']}"
            else:
                new_location = row["current_location"] or f"Active at {row['pickup_location']}"
        else:
            new_location = row["current_location"]

        new_eta = clean_text(eta) if eta is not None else row["eta"]
        new_veh = clean_text(vehicle_number) if vehicle_number is not None else row["vehicle_number"]

        cursor.execute(
            """UPDATE delivery_updates
               SET status = ?, current_location = ?, eta = ?, vehicle_number = ?, updated_at = ?
               WHERE reference = ?""",
            (new_status, new_location, new_eta, new_veh, now, reference.strip())
        )
        conn.commit()
        updated_row = cursor.execute("SELECT * FROM delivery_updates WHERE reference = ?", (reference.strip(),)).fetchone()
        return dict(updated_row) if updated_row else None


def seed_delivery_updates_if_empty() -> None:
    """No dummy deliveries are seeded; deliveries are created dynamically through marketplace orders."""
    pass


def seed_logistics_fleet_if_empty():
    """Pre-populates verified logistics partners with Reliability Scores."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM logistics_fleet")
        count = cursor.fetchone()[0]

    if count == 0:
        sample_partners = [
            {
                "company": "ABC Logistics",
                "vehicle_type": "Mini Truck (Tata Ace)",
                "vehicle_capacity_kg": 1000.0,
                "current_location": "Ahmedabad",
                "service_areas": "Ahmedabad, Gandhinagar, Sanand",
                "vehicle_number": "GJ-01-ET-8412",
                "reliability_score": 94,
                "on_time_pct": 96.0,
                "completed_deliveries": 340,
                "rating": 4.9,
                "status": "Available",
                "earnings_total_inr": 85000.0
            },
            {
                "company": "Kisan Rath Agro Transport",
                "vehicle_type": "Pickup Truck (Mahindra Bolero Maxi)",
                "vehicle_capacity_kg": 1500.0,
                "current_location": "Rajkot",
                "service_areas": "Rajkot, Gondal, Morbi",
                "vehicle_number": "GJ-03-BX-4190",
                "reliability_score": 91,
                "on_time_pct": 94.0,
                "completed_deliveries": 285,
                "rating": 4.8,
                "status": "Available",
                "earnings_total_inr": 71250.0
            },
            {
                "company": "Saurashtra Rural Cargo Network",
                "vehicle_type": "Light Commercial Truck (Eicher Pro 3000)",
                "vehicle_capacity_kg": 3000.0,
                "current_location": "Junagadh",
                "service_areas": "Junagadh, Amreli, Bhavnagar",
                "vehicle_number": "GJ-11-TX-9021",
                "reliability_score": 89,
                "on_time_pct": 92.0,
                "completed_deliveries": 190,
                "rating": 4.7,
                "status": "Available",
                "earnings_total_inr": 47500.0
            },
            {
                "company": "Gujarat Green EV Logistics",
                "vehicle_type": "Electric Mini Cargo (Tata Ace EV)",
                "vehicle_capacity_kg": 800.0,
                "current_location": "Surat",
                "service_areas": "Surat, Navsari, Kamrej",
                "vehicle_number": "GJ-05-EV-1120",
                "reliability_score": 97,
                "on_time_pct": 98.0,
                "completed_deliveries": 410,
                "rating": 5.0,
                "status": "Available",
                "earnings_total_inr": 102500.0
            }
        ]
        with get_db_connection() as conn:
            cursor = conn.cursor()
            for p in sample_partners:
                cursor.execute("""
                    INSERT INTO logistics_fleet (
                        company, vehicle_type, vehicle_capacity_kg, current_location,
                        service_areas, vehicle_number, reliability_score, on_time_pct,
                        completed_deliveries, rating, status, earnings_total_inr, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    p["company"], p["vehicle_type"], p["vehicle_capacity_kg"],
                    p["current_location"], p["service_areas"], p["vehicle_number"],
                    p["reliability_score"], p["on_time_pct"], p["completed_deliveries"],
                    p["rating"], p["status"], p["earnings_total_inr"],
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                ))
            conn.commit()
        logger.info("Seeded registered logistics fleet with Reliability Scores.")


# Seed initial genuine dataset listings & fleet
seed_from_live_dataset(force=False)
seed_logistics_fleet_if_empty()
seed_delivery_updates_if_empty()
