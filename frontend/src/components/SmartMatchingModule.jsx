import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Building2,
  Users,
  Utensils,
  ShoppingBag,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Clock,
  DollarSign,
  Truck,
  ShieldCheck,
  AlertCircle,
  MapPin,
  Phone,
  MessageCircle,
  Award,
  TrendingDown,
  Calendar
} from 'lucide-react';
import { getCropDisplayName } from '../utils/cropTranslations';

export default function SmartMatchingModule({
  commodities = [],
  locationsData = { states: [], districts: [], markets: [] },
  onNavigateToLogistics,
  user
}) {
  const [subTab, setSubTab] = useState('bestFarmer'); // 'bestFarmer' | 'multiBuyer'

  // -------------------------------------------------------------
  // 1. AI BEST FARMER MATCH STATE (FOR BUYERS)
  // -------------------------------------------------------------
  const [buyerCrop, setBuyerCrop] = useState(commodities[0] || 'Tomato');
  const [buyerQty, setBuyerQty] = useState(100);
  const [buyerBudget, setBuyerBudget] = useState(25.0);
  const [buyerLocation, setBuyerLocation] = useState(user?.location || 'Ahmedabad, Gujarat');
  const [bestFarmerResult, setBestFarmerResult] = useState(null);
  const [loadingBestFarmer, setLoadingBestFarmer] = useState(false);
  const [bestFarmerOrderSuccess, setBestFarmerOrderSuccess] = useState(null);
  const [orderingBestFarmer, setOrderingBestFarmer] = useState(false);

  const runBestFarmerMatch = () => {
    setLoadingBestFarmer(true);
    setBestFarmerOrderSuccess(null);
    fetch('/api/smart-match/best-farmer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commodity: buyerCrop,
        quantity_kg: Number(buyerQty),
        budget_kg: Number(buyerBudget),
        delivery_city: buyerLocation
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBestFarmerResult(data);
        }
      })
      .catch((err) => console.error('Error finding best farmer:', err))
      .finally(() => setLoadingBestFarmer(false));
  };

  useEffect(() => {
    runBestFarmerMatch();
  }, [buyerCrop]);

  const handleOrderBestFarmer = async (farmer) => {
    setOrderingBestFarmer(true);
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop: farmer.crop,
          quantity_kg: Math.min(Number(buyerQty), farmer.quantity_available_kg),
          farmer_name: farmer.farmer_name,
          buyer_name: user?.name || 'Direct Verified Buyer',
          pickup_location: farmer.farmer_location,
          destination: buyerLocation
        })
      });
      const data = await res.json();
      if (data.success) {
        setBestFarmerOrderSuccess(
          `Delivery booked! Tracking: ${data.delivery.tracking_reference} • Delivery OTP: ${data.delivery.delivery_otp || 'Generated'}. Carrier dispatched to farmgate.`
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOrderingBestFarmer(false);
    }
  };

  // -------------------------------------------------------------
  // 2. MULTI-BUYER ALLOCATION STATE (FOR FARMERS)
  // -------------------------------------------------------------
  const [selectedCrop, setSelectedCrop] = useState(commodities[0] || 'Tomato');
  const [harvestQty, setHarvestQty] = useState(500);
  const [askingPrice, setAskingPrice] = useState(22.0);
  const [farmerLocation, setFarmerLocation] = useState('Gondal Apmc, Rajkot (Gujarat)');
  const [matchResult, setMatchResult] = useState(null);
  const [matching, setMatching] = useState(false);

  // Auto-fetch authentic Agmarknet dataset modal price when commodity changes
  useEffect(() => {
    if (!selectedCrop) return;
    fetch(`/api/mandis?commodity=${encodeURIComponent(selectedCrop)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.mandis.length > 0) {
          const defaultMandi = data.mandis[0].market;
          return fetch(`/api/fair-price?crop=${encodeURIComponent(selectedCrop)}&mandi=${encodeURIComponent(defaultMandi)}`);
        }
        return null;
      })
      .then((res) => (res ? res.json() : null))
      .then((res) => {
        if (res && res.success && res.data?.current_modal_price_kg) {
          setAskingPrice(res.data.current_modal_price_kg);
        }
      })
      .catch(() => { });
  }, [selectedCrop]);

  const runSmartMatch = () => {
    setMatching(true);
    fetch('/api/smart-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commodity: selectedCrop,
        quantity_kg: Number(harvestQty),
        asking_price_kg: Number(askingPrice),
        location: farmerLocation
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMatchResult(data.data);
        }
      })
      .catch((err) => console.error('Error running smart match:', err))
      .finally(() => setMatching(false));
  };

  useEffect(() => {
    runSmartMatch();
  }, [selectedCrop]);

  const getBuyerIcon = (type) => {
    if (type.includes('Hotel')) return <Building2 size={18} color="#2563EB" />;
    if (type.includes('Restaurant')) return <Utensils size={18} color="var(--color-turmeric)" />;
    if (type.includes('Community')) return <Users size={18} color="var(--color-crop)" />;
    return <ShoppingBag size={18} color="#7C3AED" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Sub Navigation Bar */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '14px', flexWrap: 'wrap' }}>
        <button
          className={subTab === 'bestFarmer' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSubTab('bestFarmer')}
          style={{
            padding: '9px 18px',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: subTab === 'bestFarmer' ? 'var(--color-crop)' : undefined,
            borderColor: subTab === 'bestFarmer' ? 'var(--color-crop)' : undefined
          }}
        >
          <Sparkles size={16} /> 🌾 AI Best Farmer Match (For Buyers)
        </button>

        <button
          className={subTab === 'multiBuyer' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSubTab('multiBuyer')}
          style={{
            padding: '9px 18px',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: subTab === 'multiBuyer' ? 'var(--color-soil-dark)' : undefined,
            borderColor: subTab === 'multiBuyer' ? 'var(--color-soil-dark)' : undefined
          }}
        >
          <Building2 size={16} /> 🏢 Multi-Buyer Lot Allocation (For Farmers)
        </button>
      </div>

      {/* ============================================================= */}
      {/* SUB-TAB 1: AI BEST FARMER MATCH (FOR BUYERS)                 */}
      {/* ============================================================= */}
      {subTab === 'bestFarmer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1E6B2D12 0%, #FFFFFF 100%)',
              border: '1px solid var(--color-crop-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-crop)', textTransform: 'uppercase' }}>
                <Sparkles size={14} /> Direct Sourcing Intelligence
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0 0 0' }}>
                AI Best Farmer Match
              </h2>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Ranks verified farmgate listings by Price vs Mandi Modal Benchmark, Farmgate Proximity, Grade Quality, and Freshness.
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={runBestFarmerMatch}
              disabled={loadingBestFarmer}
              style={{ padding: '10px 20px', fontSize: '0.88rem', fontWeight: 700 }}
            >
              <RefreshCw size={15} className={loadingBestFarmer ? 'spin-icon' : ''} />
              {loadingBestFarmer ? 'Evaluating Farmers...' : 'Find Best Farmer'}
            </button>
          </div>

          {/* Interactive Buyer Sourcing Filter */}
          <div className="nexus-card">
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-soil-dark)', marginBottom: '12px' }}>
              Specify Sourcing Requirements:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Produce Commodity</label>
                <select
                  className="nexus-select"
                  value={buyerCrop}
                  onChange={(e) => setBuyerCrop(e.target.value)}
                >
                  {commodities.map((c) => (
                    <option key={c} value={c}>
                      {getCropDisplayName(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Quantity Required (kg)</label>
                <input
                  type="number"
                  className="nexus-input"
                  value={buyerQty}
                  onChange={(e) => setBuyerQty(e.target.value)}
                  min="20"
                  step="10"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Max Target Budget (₹/kg)</label>
                <input
                  type="number"
                  className="nexus-input"
                  value={buyerBudget}
                  onChange={(e) => setBuyerBudget(e.target.value)}
                  step="0.5"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Destination City</label>
                <input
                  type="text"
                  className="nexus-input"
                  value={buyerLocation}
                  onChange={(e) => setBuyerLocation(e.target.value)}
                  placeholder="e.g. Ahmedabad, Gujarat"
                />
              </div>
            </div>
          </div>

          {/* Order Success Notification */}
          {bestFarmerOrderSuccess && (
            <div
              style={{
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#065F46',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={18} color="#059669" />
              {bestFarmerOrderSuccess}
            </div>
          )}

          {/* Best Match Result Display */}
          {bestFarmerResult && bestFarmerResult.best_match ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Top Ranked #1 Farmer Card */}
              <div
                className="nexus-card"
                style={{
                  border: '2px solid var(--color-crop)',
                  background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)',
                  padding: '24px',
                  boxShadow: '0 4px 14px rgba(30, 107, 45, 0.12)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <span
                      style={{
                        background: 'var(--color-crop)',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Award size={14} /> {bestFarmerResult.best_match.badge || '🏆 #1 TOP AI MATCH'}
                    </span>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '8px 0 2px 0' }}>
                      {bestFarmerResult.best_match.farmer_name}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={13} /> {bestFarmerResult.best_match.farmer_location} •{' '}
                      <strong>{bestFarmerResult.best_match.distance_km} km away</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      AI Match Score
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--color-crop)', lineHeight: 1.1 }}>
                      {bestFarmerResult.best_match.match_score}%
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-crop)', fontWeight: 700 }}>
                      ✓ Optimal Match
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    background: 'white',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                    marginBottom: '16px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Farmgate Rate
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--color-soil-dark)' }}>
                      ₹{bestFarmerResult.best_match.price_per_kg}/kg
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-crop)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <TrendingDown size={13} /> Saves ₹{bestFarmerResult.best_match.savings_vs_mandi_kg}/kg vs Mandi
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Available Farm Lot
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                      {bestFarmerResult.best_match.quantity_available_kg} kg
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                      {bestFarmerResult.best_match.variety}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Harvest Freshness
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-soil-dark)', marginTop: '2px' }}>
                      {bestFarmerResult.best_match.harvest_date}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-crop)', fontWeight: 600 }}>
                      Zero Cold-Storage Delay
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Estimated Order Savings
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-crop)' }}>
                      ₹{bestFarmerResult.best_match.estimated_order_savings_inr?.toLocaleString() || 0}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                      vs Wholesale Mandi
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--color-soil-dark)', background: '#F8FAF5', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', borderLeft: '3px solid var(--color-crop)' }}>
                  <strong>AI Match Rationale:</strong> {bestFarmerResult.best_match.match_reason}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-primary"
                    onClick={() => handleOrderBestFarmer(bestFarmerResult.best_match)}
                    disabled={orderingBestFarmer}
                    style={{ flex: 1, minWidth: '220px', padding: '11px 18px', fontSize: '0.88rem', fontWeight: 700 }}
                  >
                    <Truck size={16} /> {orderingBestFarmer ? 'Booking Delivery...' : 'Order & Book Farmgate Delivery'}
                  </button>

                  <a
                    href={`https://wa.me/${(bestFarmerResult.best_match.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Namaste ${bestFarmerResult.best_match.farmer_name}, I saw your ${bestFarmerResult.best_match.crop} listing on AnnDhara and would like to order ${buyerQty} kg.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                    style={{
                      padding: '11px 18px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#15803D',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <MessageCircle size={16} /> WhatsApp Farmer
                  </a>
                </div>
              </div>

              {/* Runner-Up Candidate Farmers */}
              {bestFarmerResult.all_ranked_farmers?.length > 1 && (
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-soil-dark)', marginBottom: '12px' }}>
                    Other Verified Farmers for {getCropDisplayName(buyerCrop)} ({bestFarmerResult.all_ranked_farmers.length - 1} Alternatives)
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                    {bestFarmerResult.all_ranked_farmers.slice(1).map((f, idx) => (
                      <div
                        key={idx}
                        className="nexus-card"
                        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#F3F4F6', color: '#4B5563', padding: '3px 8px', borderRadius: '10px' }}>
                              Rank #{idx + 2}
                            </span>
                            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-crop)' }}>
                              {f.match_score}% Match
                            </span>
                          </div>

                          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                            {f.farmer_name}
                          </h4>
                          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: '2px', marginBottom: '10px' }}>
                            <MapPin size={11} style={{ display: 'inline' }} /> {f.farmer_location} ({f.distance_km} km)
                          </div>

                          <div style={{ background: 'var(--color-bg-subtle)', borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.8rem' }}>
                            <div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Price</div>
                              <strong>₹{f.price_per_kg}/kg</strong>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Available</div>
                              <strong>{f.quantity_available_kg} kg</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                          <button
                            className="btn-primary"
                            onClick={() => handleOrderBestFarmer(f)}
                            style={{ width: '100%', padding: '7px', fontSize: '0.78rem', justifyContent: 'center' }}
                          >
                            <Truck size={13} /> Book Delivery
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="nexus-card" style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-secondary)' }}>
              {loadingBestFarmer ? 'Evaluating authentic farmer lots...' : 'No active farm listings found for this crop. Try selecting Tomato, Potato, Onion, Wheat, or Groundnut.'}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* SUB-TAB 2: MULTI-BUYER LOT ALLOCATION (FOR FARMERS)          */}
      {/* ============================================================= */}
      {subTab === 'multiBuyer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Module Title Banner */}
          <div
            style={{
              background: 'white',
              padding: '20px 24px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-crop)', textTransform: 'uppercase' }}>
                <Sparkles size={14} /> AI Smart Buyer Matching Engine
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0 0 0' }}>
                Smart Harvest-to-Buyer Multi-Allocation
              </h2>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Instead of waiting passively for a buyer, AnnDhara AI instantly splits harvest lots across hotels, restaurants, supermarkets, and community pools.
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={runSmartMatch}
              disabled={matching}
              style={{ padding: '10px 20px', fontSize: '0.88rem', fontWeight: 700 }}
            >
              <RefreshCw size={15} className={matching ? 'spin-icon' : ''} />
              {matching ? 'Matching Buyers...' : 'Re-Run Smart Match'}
            </button>
          </div>

          {/* Interactive Controls & Harvest Setup */}
          <div className="nexus-card">
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-soil-dark)', marginBottom: '14px' }}>
              Simulate Harvest Matching Parameters:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Produce Commodity</label>
                <select
                  className="nexus-select"
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                >
                  {commodities.map((c) => (
                    <option key={c} value={c}>
                      {getCropDisplayName(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Harvest Lot Size (kg)</label>
                <input
                  type="number"
                  className="nexus-input"
                  value={harvestQty}
                  onChange={(e) => setHarvestQty(e.target.value)}
                  min="100"
                  step="50"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Asking Price (₹/kg)</label>
                <input
                  type="number"
                  className="nexus-input"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                  step="0.5"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Farm Location / Nearest Mandi</label>
                <input
                  type="text"
                  className="nexus-input"
                  list="smart-match-locations"
                  placeholder="Type or select Mandi / District..."
                  value={farmerLocation}
                  onChange={(e) => setFarmerLocation(e.target.value)}
                />
                <datalist id="smart-match-locations">
                  {locationsData?.markets?.slice(0, 300).map((m) => (
                    <option key={m.display} value={m.display} />
                  ))}
                  {locationsData?.districts?.slice(0, 100).map((d) => (
                    <option key={d.display} value={d.display} />
                  ))}
                </datalist>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  ✓ Real Agmarknet Mandis & Districts available
                </div>
              </div>
            </div>
          </div>

          {/* Matching Results & KPI Summary */}
          {matchResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* KPI Summary Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1E6B2D12 0%, #D9822B15 100%)',
                  border: '1px solid var(--color-crop-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-crop)', textTransform: 'uppercase' }}>
                    AI Allocation Summary
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0' }}>
                    {matchResult.ai_verdict}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    Farmer Realized Revenue: <strong>₹{matchResult.total_revenue_inr.toLocaleString()}</strong> • Weighted Price: <strong>₹{matchResult.average_realized_price_kg}/kg</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div
                    style={{
                      background: 'white',
                      border: '1px solid var(--color-crop-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 18px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Fulfillment Rate
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-crop)' }}>
                      {matchResult.fulfillment_rate_pct}%
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'white',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 18px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Matched Buyers
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                      {matchResult.matched_buyers_count}
                    </div>
                  </div>
                </div>
              </div>

              {/* Allocation Progress Bar */}
              <div className="nexus-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span>Total Harvest Allocation Breakdown ({matchResult.matched_quantity_kg} / {matchResult.total_harvest_kg} kg)</span>
                  <span style={{ color: 'var(--color-crop)' }}>{matchResult.fulfillment_rate_pct}% Absorbed</span>
                </div>

                <div
                  style={{
                    height: '14px',
                    background: '#E7E0D3',
                    borderRadius: '7px',
                    overflow: 'hidden',
                    display: 'flex'
                  }}
                >
                  {matchResult.allocations.map((alloc, idx) => {
                    const widthPct = (alloc.allocated_quantity_kg / matchResult.total_harvest_kg) * 100;
                    const colors = ['#2563EB', '#D9822B', '#1E6B2D', '#7C3AED', '#DC2626'];
                    return (
                      <div
                        key={idx}
                        title={`${alloc.buyer_name}: ${alloc.allocated_quantity_kg} kg`}
                        style={{
                          width: `${widthPct}%`,
                          background: colors[idx % colors.length],
                          height: '100%'
                        }}
                      />
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '12px', fontSize: '0.74rem' }}>
                  {matchResult.allocations.map((alloc, idx) => {
                    const colors = ['#2563EB', '#D9822B', '#1E6B2D', '#7C3AED', '#DC2626'];
                    return (
                      <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[idx % colors.length] }} />
                        <strong>{alloc.buyer_name.split(' ')[0]}</strong>: {alloc.allocated_quantity_kg} kg
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Matched Buyers Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {matchResult.allocations.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span
                          style={{
                            background: 'var(--color-bg-subtle)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '10px',
                            color: 'var(--color-soil)'
                          }}
                        >
                          {item.buyer_type}
                        </span>

                        <span style={{ fontSize: '0.72rem', color: 'var(--color-crop)', fontWeight: 700 }}>
                          ✓ Match #{idx + 1}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        {getBuyerIcon(item.buyer_type)}
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                          {item.buyer_name}
                        </h4>
                      </div>

                      <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                        {item.location}
                      </div>

                      <div
                        style={{
                          background: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                            Allocated Quota
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                            {item.allocated_quantity_kg} kg
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                            Subtotal (₹)
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-crop)' }}>
                            ₹{item.order_total_inr.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        Price: <strong>₹{item.price_per_kg}/kg</strong>
                      </span>
                      <span style={{ color: 'var(--color-crop)', fontWeight: 700 }}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
