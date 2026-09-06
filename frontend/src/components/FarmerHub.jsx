import React, { useState, useEffect } from 'react';
import {
  Sprout,
  PlusCircle,
  Calendar,
  DollarSign,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Activity,
  ShieldCheck,
  TrendingUp,
  Tag,
  Phone,
  MessageCircle,
  QrCode,
  Sparkles,
  RefreshCw,
  Clock,
  Truck
} from 'lucide-react';
import { getCropDisplayName, getCropGujaratiOnly } from '../utils/cropTranslations';
import { getCropImage } from '../utils/cropImages';
import TraceabilityModal from './TraceabilityModal.jsx';
import DeliveryStatusPanel from './DeliveryStatusPanel.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function FarmerHub({ user, commodities = [], locationsData = { states: [], districts: [], markets: [] } }) {
  const { t } = useLanguage();
  const [activeFarmerTab, setActiveFarmerTab] = useState('orders'); // 'orders', 'produce'
  const [listingsFilter, setListingsFilter] = useState('my'); // 'my', 'all'
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTraceListing, setSelectedTraceListing] = useState(null);

  // Harvest Registration Form State
  const [formData, setFormData] = useState({
    farmer_name: user?.name || 'Gujarat Agro Collective',
    phone: user?.phone || '+91 98251 34812',
    crop: commodities[0] || 'Tomato',
    variety: 'Hybrid Grade 1',
    quantity_kg: 500,
    asking_price_kg: 22.0,
    min_price_kg: 19.5,
    location: user?.location || 'Gondal Apmc, Rajkot (Gujarat)',
    state: 'Gujarat',
    is_pre_harvest: 0,
    harvest_date: new Date().toISOString().split('T')[0],
    shelf_life_days: 5,
    notes: 'Direct farmgate collection available. Verified Agmarknet baseline.'
  });

  // Dynamic AI Sellability Score state
  const [sellabilityData, setSellabilityData] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);

  // Fair Price Benchmark Anchor
  const [fairRef, setFairRef] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // Fetch active listings
  const loadFarmerListings = () => {
    setLoadingListings(true);
    fetch('/api/listings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setListings(data.listings);
        }
      })
      .catch((err) => console.error('Error fetching listings:', err))
      .finally(() => setLoadingListings(false));
  };

  // Re-calculate Sellability Score on form parameters change
  useEffect(() => {
    if (!formData.crop) return;
    setLoadingScore(true);
    const url = `/api/sellability-score?crop=${encodeURIComponent(formData.crop)}&quantity=${formData.quantity_kg}&location=${encodeURIComponent(formData.location)}&shelf_life=${formData.shelf_life_days}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSellabilityData(data.data);
        }
      })
      .catch((err) => console.error('Error calculating sellability:', err))
      .finally(() => setLoadingScore(false));
  }, [formData.crop, formData.quantity_kg, formData.location, formData.shelf_life_days]);

  // Load real fair price reference from dataset for selected crop
  useEffect(() => {
    if (!formData.crop) return;
    fetch(`/api/mandis?commodity=${encodeURIComponent(formData.crop)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.mandis.length > 0) {
          const defaultMandi = data.mandis[0].market;
          return fetch(`/api/fair-price?crop=${encodeURIComponent(formData.crop)}&mandi=${encodeURIComponent(defaultMandi)}`);
        }
        return null;
      })
      .then((res) => (res ? res.json() : null))
      .then((res) => {
        if (res && res.success && res.data) {
          setFairRef(res.data);
          // Auto-fill real price from dataset if available
          if (res.data.current_modal_price_kg) {
            setFormData((prev) => ({
              ...prev,
              asking_price_kg: res.data.current_modal_price_kg,
              min_price_kg: res.data.fair_price_band_kg?.min || Math.round(res.data.current_modal_price_kg * 0.92)
            }));
          }
        } else {
          setFairRef(null);
        }
      })
      .catch(() => setFairRef(null));
  }, [formData.crop]);

  useEffect(() => {
    loadFarmerListings();
  }, []);

  // Synchronize authenticated farmer details into form state
  useEffect(() => {
    if (user?.name) {
      setFormData((prev) => ({
        ...prev,
        farmer_name: user.name,
        phone: user.phone || prev.phone,
        location: user.location || prev.location
      }));
    }
  }, [user]);

  const displayedListings = listings.filter((item) => {
    if (listingsFilter === 'all') return true;
    const farmerName = (user?.name || formData.farmer_name || '').toLowerCase();
    const phone = (user?.phone || formData.phone || '').replace(/[^0-9]/g, '');
    const itemPhone = (item.phone || '').replace(/[^0-9]/g, '');
    const itemFarmer = (item.farmer_name || '').toLowerCase();
    return (
      (farmerName && (itemFarmer.includes(farmerName) || farmerName.includes(itemFarmer))) ||
      (phone && itemPhone && (itemPhone.includes(phone) || phone.includes(itemPhone))) ||
      itemFarmer.includes('gujarat')
    );
  });

  const handleRegisterHarvest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitSuccess(null);

    const payload = {
      ...formData,
      quantity_kg: Number(formData.quantity_kg),
      asking_price_kg: Number(formData.asking_price_kg),
      min_price_kg: Number(formData.min_price_kg),
      sellability_score: sellabilityData?.sellability_score || 85,
      fair_price_min: fairRef?.fair_price_band_kg?.min || 0,
      fair_price_max: fairRef?.fair_price_band_kg?.max || 0
    };

    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSubmitSuccess('Harvest successfully registered and matched with AI demand signals!');
        setShowAddModal(false);
        loadFarmerListings();
      }
    } catch (err) {
      console.error('Error creating listing:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const scoreVal = sellabilityData?.sellability_score || 88;
  const scoreColor = scoreVal >= 80 ? 'var(--color-crop)' : scoreVal >= 60 ? 'var(--color-turmeric)' : 'var(--color-accent-red)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'white',
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--color-crop-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-crop)'
            }}
          >
            <Sprout size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--color-soil-dark)' }}>
              Farmer & FPO Producer Portal
            </h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Register harvest, track AI sellability, lock pre-harvest buyer commitments, and eliminate distress sales.
            </div>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ padding: '10px 20px', fontSize: '0.88rem', fontWeight: 700 }}
        >
          <PlusCircle size={17} /> Add New Crop / Harvest
        </button>
      </div>

      {/* Top 3 Metric Gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {/* Sellability Score Card */}
        <div className="nexus-card" style={{ borderLeft: `4px solid ${scoreColor}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                AI Harvest Sellability Score ⭐
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor }}>
                  {scoreVal}%
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: scoreColor }}>
                  {sellabilityData?.grade || 'High Sellability'}
                </span>
              </div>
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--color-bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: scoreColor
              }}
            >
              <Activity size={20} />
            </div>
          </div>

          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: '10px' }}>
            {sellabilityData?.recommendation || 'High demand in Ahmedabad hub. 92% probability of same-day liquidation.'}
          </div>
        </div>

        {/* Pre-Harvest Commitment Assurance */}
        <div className="nexus-card" style={{ borderLeft: '4px solid #2563EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Pre-Harvest Buyer Assurance ⭐⭐⭐
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>
                  850 kg
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-crop)' }}>
                  Pre-Booked
                </span>
              </div>
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB'
              }}
            >
              <Clock size={20} />
            </div>
          </div>

          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: '10px' }}>
            Hotels & community society buyers have reserved 850 kg before harvest at locked prices.
          </div>
        </div>

        {/* Fair Price Protection Anchor */}
        <div className="nexus-card" style={{ borderLeft: '4px solid var(--color-turmeric)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Fair Price Intelligence Band
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                  {fairRef?.fair_price_band_kg?.min && fairRef?.fair_price_band_kg?.max
                    ? `₹${fairRef.fair_price_band_kg.min}–₹${fairRef.fair_price_band_kg.max}`
                    : '₹20–₹26'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  /kg
                </span>
              </div>
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--color-gold-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-turmeric)'
              }}
            >
              <TrendingUp size={20} />
            </div>
          </div>

          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: '10px' }}>
            Prophet AI forecast anchor protects farmers from underpricing harvest to commission agents.
          </div>
        </div>
      </div>

      {/* Sub-Tabs: Incoming Orders vs Registered Produce Batches */}
      <div
        style={{
          display: 'flex',
          background: 'var(--color-bg-subtle)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
          width: 'fit-content',
          gap: '6px'
        }}
      >
        <button
          onClick={() => setActiveFarmerTab('orders')}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeFarmerTab === 'orders' ? 'white' : 'transparent',
            color: activeFarmerTab === 'orders' ? 'var(--color-soil-dark)' : 'var(--color-text-secondary)',
            fontWeight: 800,
            fontSize: '0.86rem',
            cursor: 'pointer',
            boxShadow: activeFarmerTab === 'orders' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Truck size={17} color="var(--color-crop)" /> 📦 {t('incomingOrdersTab')}
        </button>

        <button
          onClick={() => setActiveFarmerTab('produce')}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeFarmerTab === 'produce' ? 'white' : 'transparent',
            color: activeFarmerTab === 'produce' ? 'var(--color-soil-dark)' : 'var(--color-text-secondary)',
            fontWeight: 800,
            fontSize: '0.86rem',
            cursor: 'pointer',
            boxShadow: activeFarmerTab === 'produce' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sprout size={17} color="var(--color-crop)" /> 🌾 Registered Crops & Harvest Lots ({listings.length})
        </button>
      </div>

      {/* TAB 1: INCOMING BUYER ORDERS & LOGISTICS PICKUP TRACKING */}
      {activeFarmerTab === 'orders' && (
        <DeliveryStatusPanel
          role="farmer"
          stakeholder={user?.name || formData.farmer_name || 'Farmer'}
        />
      )}

      {/* TAB 2: ACTIVE FARMER HARVESTS & PRE-BOOKINGS */}
      {activeFarmerTab === 'produce' && (
        <div className="nexus-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                Registered Harvests & Active Supply Lots
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Live inventory connected to the AnnDhara Buyer Matching & Shared Logistics Engine
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--color-bg-subtle)', borderRadius: '6px', padding: '2px', border: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => setListingsFilter('my')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.76rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: listingsFilter === 'my' ? 'white' : 'transparent',
                    fontWeight: listingsFilter === 'my' ? 700 : 500,
                    cursor: 'pointer',
                    color: listingsFilter === 'my' ? 'var(--color-crop)' : 'var(--color-text-secondary)'
                  }}
                >
                  My Harvest Lots ({displayedListings.length})
                </button>
                <button
                  onClick={() => setListingsFilter('all')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.76rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: listingsFilter === 'all' ? 'white' : 'transparent',
                    fontWeight: listingsFilter === 'all' ? 700 : 500,
                    cursor: 'pointer',
                    color: listingsFilter === 'all' ? 'var(--color-crop)' : 'var(--color-text-secondary)'
                  }}
                >
                  All Mandi Network ({listings.length})
                </button>
              </div>

              <button className="btn-secondary" onClick={loadFarmerListings} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                <RefreshCw size={13} className={loadingListings ? 'spin-icon' : ''} /> Refresh
              </button>
            </div>
          </div>

          {loadingListings ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <RefreshCw size={26} className="spin-icon" style={{ margin: '0 auto 8px auto', color: 'var(--color-crop)' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Loading verified farmer listings...</p>
            </div>
          ) : !displayedListings.length ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--color-bg-subtle)', borderRadius: '8px' }}>
              <Sprout size={32} color="var(--color-crop)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>No crops registered yet</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Click "+ Add New Crop / Harvest" above to register your produce lot.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {displayedListings.map((item) => {
                const isPre = item.is_pre_harvest === 1;
                return (
                  <div key={item.id} className="produce-card">
                    {/* Visual Media Header with Crop Photo */}
                    <div className="produce-card-media">
                      <img
                        src={getCropImage(item.crop)}
                        alt={item.crop}
                        className="produce-card-img"
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
                        }}
                      />

                      <span
                        className="produce-card-badge-top-left"
                        style={{
                          background: isPre ? 'rgba(37, 99, 235, 0.92)' : 'rgba(40, 54, 24, 0.88)',
                          color: '#FEFAE0'
                        }}
                      >
                        {isPre ? '📅 Pre-Harvest' : '✓ Harvest Ready'}
                      </span>

                      <span
                        className="produce-card-badge-top-right"
                        style={{
                          background: (item.sellability_score || 85) >= 80 ? 'rgba(96, 108, 56, 0.92)' : 'rgba(188, 108, 37, 0.92)'
                        }}
                      >
                        ⭐ {item.sellability_score || 85}% AI Score
                      </span>

                      <div className="produce-card-price-overlay">
                        ₹{Number(item.asking_price_kg || 0).toFixed(2)}
                        <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>/kg</span>
                      </div>
                    </div>

                    {/* Card Content Details */}
                    <div className="produce-card-content">
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                              {getCropDisplayName(item.crop)}
                            </h3>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              Variety: <strong>{item.variety || 'Desi Standard'}</strong>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Grower</span>
                            <strong style={{ fontSize: '0.82rem', color: 'var(--palette-forest)' }}>{item.farmer_name}</strong>
                          </div>
                        </div>

                        <div
                          style={{
                            margin: '12px 0',
                            padding: '10px 12px',
                            background: 'var(--color-bg-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                              Volume In Stock
                            </div>
                            <div style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--palette-forest)' }}>
                              {(item.quantity_kg || 0).toLocaleString()} kg
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                              Estimated Value
                            </div>
                            <div style={{ fontSize: '1.12rem', fontWeight: 800, color: 'var(--palette-terracotta)' }}>
                              ₹{((item.quantity_kg || 0) * (item.asking_price_kg || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} color="var(--palette-terracotta)" />
                          <span>{item.location}</span>
                        </div>

                        {item.notes && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '10px' }}>
                            "{item.notes}"
                          </div>
                        )}
                      </div>

                      {/* Actions: WhatsApp + Traceability */}
                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '6px' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => setSelectedTraceListing(item)}
                          style={{
                            flex: 1,
                            padding: '7px 10px',
                            fontSize: '0.74rem',
                            justifyContent: 'center',
                            color: 'var(--color-soil)'
                          }}
                        >
                          <QrCode size={14} /> Farm-to-Fork QR
                        </button>

                        <a
                          href={`https://wa.me/${(item.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `Namaste ${item.farmer_name}, I saw your ${item.crop} listing on AnnDhara.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary"
                          style={{
                            padding: '7px 14px',
                            fontSize: '0.75rem',
                            background: '#25D366',
                            borderColor: '#25D366',
                            color: 'white',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Harvest Registration */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sprout size={24} color="var(--color-crop)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Register Produce / Schedule Harvest
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterHarvest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Pre-Harvest Toggle */}
              <div
                style={{
                  background: formData.is_pre_harvest ? '#EFF6FF' : 'var(--color-crop-light)',
                  border: `1px solid ${formData.is_pre_harvest ? '#BFDBFE' : 'var(--color-crop-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: formData.is_pre_harvest ? '#1E40AF' : 'var(--color-crop-hover)' }}>
                    {formData.is_pre_harvest ? 'Pre-Harvest Buyer Commitment Mode' : 'Immediate Farmgate Supply Mode'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                    {formData.is_pre_harvest ? 'Lock buyers and prices in advance before actual harvest.' : 'Produce is ready for immediate collection.'}
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={formData.is_pre_harvest === 1}
                    onChange={(e) => setFormData({ ...formData, is_pre_harvest: e.target.checked ? 1 : 0 })}
                  />
                  Pre-Harvest
                </label>
              </div>

              {/* Crop & Variety */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Agricultural Commodity</label>
                  <select
                    className="nexus-select"
                    value={formData.crop}
                    onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                    required
                  >
                    {commodities.map((c) => (
                      <option key={c} value={c}>
                        {getCropDisplayName(c)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Variety / Quality Grade</label>
                  <input
                    type="text"
                    className="nexus-input"
                    value={formData.variety}
                    onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                    placeholder="e.g. Desi Hybrid Grade 1"
                  />
                </div>
              </div>

              {/* Quantity & Harvest Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Available Quantity (kg)</label>
                  <input
                    type="number"
                    className="nexus-input"
                    value={formData.quantity_kg}
                    onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })}
                    required
                    min="10"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Harvest / Ready Date</label>
                  <input
                    type="date"
                    className="nexus-input"
                    value={formData.harvest_date}
                    onChange={(e) => setFormData({ ...formData, harvest_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Asking Price & Min Acceptable Floor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Asking Price (₹/kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="nexus-input"
                    value={formData.asking_price_kg}
                    onChange={(e) => setFormData({ ...formData, asking_price_kg: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Minimum Floor Price (₹/kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="nexus-input"
                    value={formData.min_price_kg}
                    onChange={(e) => setFormData({ ...formData, min_price_kg: e.target.value })}
                    placeholder="e.g. 19.50"
                  />
                </div>
              </div>

              {/* Farmer Contact & Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Farmer / FPO Name</label>
                  <input
                    type="text"
                    className="nexus-input"
                    value={formData.farmer_name}
                    onChange={(e) => setFormData({ ...formData, farmer_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone (WhatsApp enabled)</label>
                  <input
                    type="text"
                    className="nexus-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Farm Location / Nearest Mandi *</label>
                <input
                  type="text"
                  className="nexus-input"
                  list="real-farmer-markets"
                  placeholder="Type or select Mandi / District..."
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
                <datalist id="real-farmer-markets">
                  {locationsData?.markets?.slice(0, 300).map((m) => (
                    <option key={m.display} value={m.display} />
                  ))}
                  {locationsData?.districts?.slice(0, 100).map((d) => (
                    <option key={d.display} value={d.display} />
                  ))}
                </datalist>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  ✓ Real Agmarknet Mandis & Districts available ({locationsData?.markets?.length || 1204} markets)
                </div>
              </div>

              {/* Live Sellability Feedback Box */}
              {sellabilityData && (
                <div
                  style={{
                    background: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    fontSize: '0.78rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '4px' }}>
                    <span>Estimated Sellability:</span>
                    <span style={{ color: scoreColor }}>{sellabilityData.sellability_score}% ({sellabilityData.grade})</span>
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    {sellabilityData.recommendation}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Publishing...' : 'Register & Match Buyers'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Farm-to-Fork Modal */}
      {selectedTraceListing && (
        <TraceabilityModal
          listing={selectedTraceListing}
          onClose={() => setSelectedTraceListing(null)}
        />
      )}
    </div>
  );
}
