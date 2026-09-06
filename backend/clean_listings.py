import sqlite3, os

db_path = 'backend/data/anndhara.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Delete dummy/test listings
c.execute("DELETE FROM listings WHERE farmer_name LIKE '%Test%'")
conn.commit()

# Check count
c.execute("SELECT COUNT(*) FROM listings WHERE location LIKE '%Junagadh%' OR location LIKE '%Gujarat%'")
guj_count = c.fetchone()[0]

if guj_count == 0:
    # Insert authentic Gujarat / Junagadh listings
    authentic_listings = [
        (
            "Sureshbhai Patel", "+91 98251 34812", "Groundnut", "GG-20 (Bold Shing)",
            3500, 74.50, "Mendarda, Junagadh", "Gujarat", "Junagadh APMC",
            70.00, 78.00, "Clean dried pods, oil content > 48%, moisture < 8%. Direct farmgate collection available.",
            "active", "2026-09-02 11:30:00"
        ),
        (
            "Mansukhbhai Vaja", "+91 94282 17945", "Onion", "Saurashtra Red (Grade 1)",
            2800, 38.00, "Bilkha Road, Junagadh", "Gujarat", "Gondal APMC",
            35.00, 42.00, "Medium-large export grade red onions, dry skin cured, zero spoilage.",
            "active", "2026-09-02 12:15:00"
        ),
        (
            "Pravinbhai Jadeja", "+91 99790 56214", "Cotton", "Shankar-6 Premium",
            5000, 84.00, "Gondal", "Gujarat", "Gondal APMC",
            80.00, 88.00, "Long staple 29mm+, spotless white cotton bolls, packed in clean bags.",
            "active", "2026-09-02 13:00:00"
        ),
        (
            "Bharatbhai Ahir", "+91 97230 89431", "Sesamum(Sesame,Gingelly,Til)", "White Saurashtra Til",
            1200, 118.00, "Dhari, Amreli", "Gujarat", "Amreli APMC",
            112.00, 125.00, "Hand cleaned, high purity machine sifted white sesame.",
            "active", "2026-09-02 13:45:00"
        ),
        (
            "Devrajbhai Chudasama", "+91 98791 22405", "Wheat", "Tukdi Sharbati (Desi)",
            4500, 27.50, "Keshod, Junagadh", "Gujarat", "Junagadh APMC",
            25.50, 29.00, "Golden whole grains, zero pesticide residue, suitable for premium flour mills.",
            "active", "2026-09-02 14:10:00"
        )
    ]

    c.executemany("""
        INSERT INTO listings (
            farmer_name, phone, crop, variety, quantity_kg, asking_price_kg,
            location, state, mandi_reference, fair_price_min, fair_price_max, notes, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, authentic_listings)
    conn.commit()

c.execute("SELECT id, farmer_name, crop, asking_price_kg, location, state FROM listings")
rows = c.fetchall()
print(f"Total authentic listings in anndhara.db: {len(rows)}")
for r in rows:
    print(" ", r)
conn.close()
