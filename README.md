# AnnDhara — AI-Powered Farm-to-Market Intelligence Platform
### *AI-Powered Demand-to-Delivery Agricultural Network*

**Smart India Hackathon (SIH Problem Statement SIH26033)**  
*"Multiple intermediaries reduce farmers' earnings and increase consumer prices."*

---

## 1. Problem Statement & Root Causes

In the traditional agricultural supply chain:
```
Farmer (₹15/kg) 
   ↓ Local Agent (+₹5)
   ↓ Trader (+₹8)
   ↓ Wholesaler (+₹5)
   ↓ Distributor (+₹4)
   ↓ Retailer (+₹8)
Consumer (₹45/kg)
```

The farmer receives only **33.3% of the final price**, while the consumer pays **3× the farmgate cost**.

### The Real Core Problem
The issue is not merely that intermediaries exist (logistics and aggregation are genuinely needed). The true systemic failures are:
1. **Information Asymmetry**: Farmers lack forward demand visibility and transparent price discovery before harvesting.
2. **Fragmented Supply & Demand**: Individual consumers buy 2–3 kg in isolation; smallholder farmers sell fragmented loads with zero bargaining power.
3. **Logistics Inefficiencies**: High transport costs, empty return trips, and uncoordinated vehicle runs.
4. **Food Wastage**: Perishable crops (e.g., tomatoes with 5-day shelf life) flood oversupplied local yards and rot in distress.

---

## 2. Positioning & Solution: Demand-to-Delivery Network

AnnDhara is an **AI-Powered Farm-to-Market Intelligence Platform** that connects **Farmers/FPOs** directly with **Bulk Buyers** (Hotels, Hostels, Supermarkets, Food Processors) and **Smart Community Consumer Pools** (Apartments, Societies, Colleges) while utilizing an AI engine for:
- **Pre-Harvest Demand Forecasting** (predicting daily kg demand 7 days ahead by region)
- **Smart Buyer Multi-Allocation** (matching single harvests across multiple buyers to guarantee zero leftover stock)
- **Shared Logistics & Capacitated Vehicle Routing (CVRP)** (consolidating multi-farmer pickups into single vehicle runs)
- **Sellability Scoring & Waste Prevention** (identifying perishable distress risk and rerouting to food processors or dynamic discounts)
- **Pre-Harvest Commitments** (booking demand before the crop is harvested)
- **Farm-to-Fork Traceability** (QR-code enabled origin and cold-chain timeline)

---

## 3. Four Major Stakeholders

| Stakeholder | Capabilities & Value Proposition |
|---|---|
| 👨🌾 **Farmer / FPO** | Register crops & harvest dates; view AI Sellability Score (%) & Fair Price protection band; lock pre-harvest buyer commitments; track orders. |
| 🛒 **Consumer / Societies** | Browse farmgate listings; join **Smart Community Buying Pools** (e.g. 200 kg batch delivery to an apartment society for 18% discount); scan QR for Farm-to-Fork traceability. |
| 🏢 **Bulk Buyers** | Hotels, restaurants, hostels, supermarkets & food processing industries post bulk requisitions (e.g. 200 kg Tomato tomorrow) and receive AI-matched farmgate supply plans. |
| 🚚 **Logistics Partners** | Small commercial vehicle owners (Tata Ace / Mahindra Bolero) accept delivery assignments with multi-pickup, multi-drop route optimization (saving 28% distance and 22% freight costs). |

---

## 4. The 8 Working Prototype Screens & Modules

1. **System Overview & Pitch**: End-to-end architecture flow, traditional vs AnnDhara supply chain margin breakdown (₹15 vs ₹24 farmgate), and stakeholder quick-access cards.
2. **Farmer & FPO Producer Portal**: Harvest registration (immediate & pre-harvest), **AI Sellability Score (%)** gauge, Fair Price Anchor, and active listings.
3. **Direct Buyer Marketplace**: Three channels: **Direct Farmgate Listings** (with WhatsApp & Farm-to-Fork QR), **Institutional Bulk Demands** (HoReCa requisitions), and **Smart Community Pools** (society group orders).
4. **AI Demand Forecast Dashboard**: Recharts 14-day historical ingestion + 7-day predicted forward demand (kg/day) by location and commodity with model signal weights.
5. **Regional Demand Heatmap**: Interactive visual matrix of High Demand 🔴, Medium Demand 🟠, and Low Demand 🟢 zones with supply deficit/surplus indicators.
6. **AI Smart Buyer Matching**: Interactive simulator: allocates a farmer's harvest (e.g., 500 kg Tomato) across restaurants, hotels, supermarkets, and community pools (100% fulfillment, 0 unsold inventory).
7. **Shared Logistics & Route Optimizer**: Capacitated Vehicle Routing Problem (CVRP) solver consolidating multi-farmer pickups into single vehicle loads with vehicle capacity gauge (85% full), distance saved (18.4 km / 28%), cost reduction (22%), and CO₂ emissions saved.
8. **Hackathon Impact Dashboard & Margin Simulator 🔥**: Quantifies 5 macro KPIs (4→1 middlemen, +18.4% farmer revenue, -12.6% consumer price, 35% trips saved, 22% food waste reduced) and features an interactive real-time price margin slider.

---

## 5. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Server status, cache timestamp, and data provenance |
| `GET` | `/api/commodities` | Distinct agricultural commodities from active Agmarknet data |
| `GET` | `/api/mandis` | Reporting mandis for a commodity and state |
| `GET` | `/api/fair-price` | Prophet 7-day fair price band (`min`, `fair`, `max` ₹/kg) |
| `GET` | `/api/compare-mandis` | Mandis ranked by Net Realized Price deducting vehicle freight |
| `GET` | `/api/listings` | Active marketplace listings (filter by crop, location, pre-harvest) |
| `POST` | `/api/listings` | Register a new farmer harvest or pre-harvest commitment |
| `GET` | `/api/demand-forecast` | 14-day history + 7-day predicted demand (kg/day) by city |
| `GET` | `/api/demand-heatmap` | Regional demand intensity (HIGH, MED, LOW) & supply deficit |
| `GET` | `/api/sellability-score` | 0-100% score based on demand, distance, and crop shelf-life |
| `POST` | `/api/smart-match` | Multi-buyer allocation algorithm matching harvest to orders |
| `POST` | `/api/route-optimize` | Capacitated vehicle routing (multi-farmer pickup, multi-drop) |
| `GET` | `/api/bulk-demands` | Institutional buyer requirements (Hotels, Supermarkets) |
| `GET` | `/api/community-pools` | Society/apartment community group buying orders |
| `POST` | `/api/community-pools/pledge` | Pledge kg to a community society pool |
| `GET` | `/api/waste-prevention` | Scans perishable inventory and triggers dynamic rescue workflows |
| `GET` | `/api/traceability/<id>` | Verifiable farm-to-fork origin and cold-chain timeline |
| `GET` | `/api/impact-metrics` | Macro KPIs & traditional vs AnnDhara margin split |
| `POST` | `/api/markup-check` | Intermediary markup calculation & anti-gouging verdict |

---

## 6. Quick Start & Execution

### 1. Run Automated Backend Tests
```bash
python backend/test_demand_delivery.py
python backend/test_nexus.py
```

### 2. Start Backend Server (Flask on port 5000)
```bash
cd backend
python app.py
```

### 3. Start Frontend Dev Server (Vite on port 5173)
```bash
cd frontend
npm run dev
```
Or simply double-click **`start_all.bat`** in the project root!
Navigate to: **`http://localhost:5173`**
