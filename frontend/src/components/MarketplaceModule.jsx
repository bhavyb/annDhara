import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  PlusCircle,
  Phone,
  MessageCircle,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Tag,
  Search,
  Filter,
  X,
  User,
  ShieldCheck,
  Scale,
  Building2,
  Users,
  Utensils,
  Calendar,
  Clock,
  Sparkles,
  RefreshCw,
  Truck,
  ArrowRight,
  Check
} from 'lucide-react';
import { getCropDisplayName, getCropGujaratiOnly } from '../utils/cropTranslations';
import { getCropImage } from '../utils/cropImages';
import DeliveryStatusPanel from './DeliveryStatusPanel.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function MarketplaceModule({ user, commodities = [], locationsData = { states: [], districts: [], markets: [] } }) {
  const { t } = useLanguage();
  const [marketSubTab, setMarketSubTab] = useState('direct'); // 'direct', 'bulk', 'community', 'deliveries'
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterCrop, setFilterCrop] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [selectedRegionDropdown, setSelectedRegionDropdown] = useState('');

  // Buyer Order & Delivery Booking state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderListing, setOrderListing] = useState(null);
  const [orderFormData, setOrderFormData] = useState({
    buyer_name: user?.name || '',
    phone: user?.phone || '+91 98251 44332',
    quantity_kg: 50,
    delivery_location: user?.location || 'Navrangpura, Ahmedabad (Gujarat)',
    notes: ''
  });
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orderError, setOrderError] = useState(null);

  // Bulk demands state
  const [bulkDemands, setBulkDemands] = useState([]);
  const [loadingBulk, setLoadingBulk] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    buyer_name: user?.name || '',
    buyer_type: 'Restaurant',
    phone: user?.phone || '+91 98251 44332',
    crop: commodities[0] || 'Tomato',
    quantity_needed_kg: 500,
    max_budget_kg: 28.0,
    location: user?.location || 'Navrangpura, Ahmedabad (Gujarat)',
    required_by_date: 'Within 48 hours',
    notes: 'Direct farmgate sourcing. Consistent fresh harvest required.'
  });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(null);
  const [bulkError, setBulkError] = useState(null);

  // Community pools state
  const [communityPools, setCommunityPools] = useState([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [pledgePushed, setPledgePushed] = useState({});

  const fetchListings = () => {
    setLoading(true);
    let url = '/api/listings?';
    if (filterCrop) url += `crop=${encodeURIComponent(filterCrop)}&`;
    if (filterLocation) url += `location=${encodeURIComponent(filterLocation)}&`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setListings(data.listings);
        }
      })
      .catch((err) => console.error('Error fetching listings:', err))
      .finally(() => setLoading(false));
  };

  const fetchBulkDemands = () => {
    setLoadingBulk(true);
    fetch('/api/bulk-demands')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBulkDemands(data.demands);
        }
      })
      .catch((err) => console.error('Error fetching bulk demands:', err))
      .finally(() => setLoadingBulk(false));
  };

  const fetchCommunityPools = () => {
    setLoadingPools(true);
    fetch('/api/community-pools')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCommunityPools(data.pools);
        }
      })
      .catch((err) => console.error('Error fetching pools:', err))
      .finally(() => setLoadingPools(false));
  };

  useEffect(() => {
    fetchListings();
    fetchBulkDemands();
    fetchCommunityPools();
  }, [filterCrop, filterLocation]);


  const handlePledge = async (poolId) => {
    try {
      const res = await fetch('/api/community-pools/pledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_id: poolId, pledge_kg: 5.0 })
      });
      const data = await res.json();
      if (data.success) {
        setPledgePushed((prev) => ({ ...prev, [poolId]: true }));
        fetchCommunityPools();
      }
    } catch (err) {
      console.error('Pledge error:', err);
    }
  };

  // Synchronize buyer name from logged in user
  useEffect(() => {
    if (user?.name) {
      setOrderFormData((prev) => ({
        ...prev,
        buyer_name: user.name,
        phone: user.phone || prev.phone,
        delivery_location: user.location || prev.delivery_location
      }));
    }
  }, [user]);

  const handleOpenOrderModal = (listing) => {
    setOrderListing(listing);
    setOrderFormData((prev) => ({
      ...prev,
      quantity_kg: Math.min(50, listing.quantity_kg),
      notes: `Order for ${listing.crop} (${listing.variety || 'Standard'}) from ${listing.farmer_name}`
    }));
    setOrderSuccess(null);
    setOrderError(null);
    setShowOrderModal(true);
  };

  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    if (!orderListing) return;
    setOrderSubmitting(true);
    setOrderError(null);

    const payload = {
      crop: orderListing.crop,
      quantity_kg: Number(orderFormData.quantity_kg),
      farmer_name: orderListing.farmer_name,
      buyer_name: orderFormData.buyer_name || 'Verified Buyer',
      pickup_location: orderListing.location,
      destination: orderFormData.delivery_location,
      listing_id: orderListing.id,
      current_location: `Order Placed - Awaiting carrier dispatch at ${orderListing.location}`,
      vehicle_number: '',
      eta: 'Estimated 2-4 hours'
    };

    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrderSuccess(data.delivery);
        fetchListings();
      } else {
        setOrderError(data.error || 'Failed to create delivery order');
      }
    } catch (err) {
      setOrderError('Cannot connect to AnnDhara logistics backend');
    } finally {
      setOrderSubmitting(false);
    }
  };

  useEffect(() => {
    if (user?.name) {
      setBulkFormData((prev) => ({
        ...prev,
        buyer_name: user.name,
        phone: user.phone || prev.phone,
        location: user.location || prev.location
      }));
    }
  }, [user]);

  const handleCreateBulkDemand = async (e) => {
    e.preventDefault();
    setBulkSubmitting(true);
    setBulkError(null);
    setBulkSuccess(null);
    try {
      const res = await fetch('/api/bulk-demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name: bulkFormData.buyer_name,
          buyer_type: bulkFormData.buyer_type,
          phone: bulkFormData.phone,
          crop: bulkFormData.crop,
          quantity_needed_kg: parseFloat(bulkFormData.quantity_needed_kg),
          max_budget_kg: parseFloat(bulkFormData.max_budget_kg),
          location: bulkFormData.location,
          required_by_date: bulkFormData.required_by_date,
          notes: bulkFormData.notes
        })
      });
      const data = await res.json();
      if (data.success) {
        setBulkSuccess('Institutional bulk requisition posted successfully! Verified farmers can now supply your requirement.');
        fetchBulkDemands();
        setTimeout(() => {
          setShowBulkModal(false);
          setBulkSuccess(null);
        }, 1800);
      } else {
        setBulkError(data.error || 'Failed to post bulk requisition.');
      }
    } catch (err) {
      setBulkError(err.message || 'Error creating bulk requisition.');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleRegionChange = (e) => {
    const val = e.target.value;
    setSelectedRegionDropdown(val);
    setFilterLocation(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Visual Marketplace Hero with Photo Backdrop */}
      <div className="marketplace-hero">
        <div style={{ maxWidth: '650px', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 800, color: '#DDA15E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            <Sparkles size={15} /> Direct Mandi-to-Market Exchange
          </div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#FEFAE0', margin: '2px 0 8px 0', lineHeight: 1.15 }}>
            Direct Farm Produce Marketplace
          </h1>
          <div style={{ fontSize: '0.92rem', color: '#EFF3DF', lineHeight: 1.4 }}>
            Zero middleman commission. Connects verified farmgate supply directly with individual buyers, HoReCa bulk procurement, and housing society buying pools.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end', zIndex: 2 }}>
          <div style={{ background: 'rgba(40, 54, 24, 0.82)', border: '1px solid rgba(221, 161, 94, 0.45)', backdropFilter: 'blur(8px)', padding: '12px 18px', borderRadius: '14px', color: '#FEFAE0', textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: '#DDA15E', fontWeight: 700, textTransform: 'uppercase' }}>Verified Farmgate Supply</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{listings.length} Lots Available</div>
          </div>
        </div>
      </div>

      {/* 4 Multi-Buyer Sub-Tabs Bar */}
      <div
        style={{
          background: 'white',
          padding: '6px 8px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div
          style={{
            background: 'var(--color-bg-subtle)',
            padding: '4px',
            borderRadius: '10px',
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={() => setMarketSubTab('direct')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: marketSubTab === 'direct' ? 'var(--palette-forest)' : 'transparent',
              color: marketSubTab === 'direct' ? '#FEFAE0' : 'var(--color-text-secondary)',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              boxShadow: marketSubTab === 'direct' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <ShoppingBag size={15} color={marketSubTab === 'direct' ? '#FEFAE0' : 'var(--palette-moss)'} /> Farmgate Listings ({listings.length})
          </button>

          <button
            onClick={() => setMarketSubTab('bulk')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: marketSubTab === 'bulk' ? 'var(--palette-forest)' : 'transparent',
              color: marketSubTab === 'bulk' ? '#FEFAE0' : 'var(--color-text-secondary)',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              boxShadow: marketSubTab === 'bulk' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Building2 size={15} color={marketSubTab === 'bulk' ? '#FEFAE0' : '#2563EB'} /> Bulk Buyers ({bulkDemands.length})
          </button>

          <button
            onClick={() => setMarketSubTab('community')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: marketSubTab === 'community' ? 'var(--palette-forest)' : 'transparent',
              color: marketSubTab === 'community' ? '#FEFAE0' : 'var(--color-text-secondary)',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              boxShadow: marketSubTab === 'community' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={15} color={marketSubTab === 'community' ? '#FEFAE0' : 'var(--palette-wheat)'} /> Smart Community Pools ({communityPools.length})
          </button>

          <button
            onClick={() => setMarketSubTab('deliveries')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: marketSubTab === 'deliveries' ? 'var(--palette-forest)' : 'transparent',
              color: marketSubTab === 'deliveries' ? '#FEFAE0' : 'var(--color-text-secondary)',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              boxShadow: marketSubTab === 'deliveries' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Truck size={15} color={marketSubTab === 'deliveries' ? '#FEFAE0' : 'var(--palette-terracotta)'} /> Orders & Live Tracking
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 1: DIRECT FARMGATE LISTINGS */}
      {/* ------------------------------------------------------------- */}
      {marketSubTab === 'direct' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Filter Toolbar */}
          <div
            style={{
              background: 'white',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '14px 20px',
              display: 'flex',
              gap: '14px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} color="var(--color-crop)" />
              <select
                className="nexus-select"
                value={filterCrop}
                onChange={(e) => setFilterCrop(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              >
                <option value="">{t('allCrops', 'All Crops')}</option>
                {commodities.map((c) => (
                  <option key={c} value={c}>
                    {getCropDisplayName(c)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} color="var(--color-turmeric)" />
              <input
                className="nexus-input"
                type="text"
                list="marketplace-filter-locations"
                placeholder="Filter by location / district..."
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: '230px' }}
              />
              <datalist id="marketplace-filter-locations">
                {locationsData?.districts?.slice(0, 150).map((d) => (
                  <option key={d.display} value={d.district} label={d.display} />
                ))}
                {locationsData?.markets?.slice(0, 150).map((m) => (
                  <option key={m.display} value={m.market} label={m.display} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 8px auto', color: 'var(--color-crop)' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Loading direct farmer listings...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {listings.map((l) => {
                const cleanPhone = l.phone.replace(/[^0-9]/g, '');
                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                  `Namaste ${l.farmer_name}, I saw your ${l.crop} listing on AnnDhara.`
                )}`;
                const isPre = l.is_pre_harvest === 1;

                return (
                  <div key={l.id} className="produce-card">
                    {/* Visual Media Header with Real Crop Photo */}
                    <div className="produce-card-media">
                      <img
                        src={getCropImage(l.crop)}
                        alt={l.crop}
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
                        {isPre ? '📅 Pre-Harvest' : '✓ Fresh Harvest'}
                      </span>

                      <span className="produce-card-badge-top-right">
                        {`LOT-#${l.id.toString().padStart(4, '0')}`}
                      </span>

                      <div className="produce-card-price-overlay">
                        ₹{l.asking_price_kg.toFixed(2)}
                        <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>/kg</span>
                      </div>
                    </div>

                    {/* Produce Card Content */}
                    <div className="produce-card-content">
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                              {getCropDisplayName(l.crop)}
                            </h3>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              Variety: <strong>{l.variety || 'Desi Standard'}</strong>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Farmer</span>
                            <strong style={{ fontSize: '0.82rem', color: 'var(--palette-forest)' }}>{l.farmer_name}</strong>
                          </div>
                        </div>

                        <div
                          style={{
                            margin: '12px 0',
                            background: 'var(--color-bg-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                              Lot Quantity
                            </div>
                            <div style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--palette-forest)' }}>
                              {l.quantity_kg.toLocaleString()} kg
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                              Total Lot Value
                            </div>
                            <div style={{ fontSize: '1.12rem', fontWeight: 800, color: 'var(--palette-terracotta)' }}>
                              ₹{(l.quantity_kg * l.asking_price_kg).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} color="var(--palette-terracotta)" />
                          <span>{l.location}</span>
                        </div>

                        {l.notes && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '10px' }}>
                            "{l.notes}"
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          className="btn-primary"
                          onClick={() => handleOpenOrderModal(l)}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            fontSize: '0.84rem'
                          }}
                        >
                          <Truck size={15} /> {t('buyAndBookDelivery')}
                        </button>

                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            fontSize: '0.78rem',
                            color: '#15803D',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <MessageCircle size={14} /> Contact Farmer via WhatsApp
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

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 2: INSTITUTIONAL BULK DEMANDS */}
      {/* ------------------------------------------------------------- */}
      {marketSubTab === 'bulk' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%)',
              border: '1px solid #BFDBFE',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
                🏢 Institutional Requisitions
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1E40AF', margin: '2px 0' }}>
                Hotels, Restaurants, Hostels & Supermarket Direct Requirements
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                Direct wholesale buyer orders with guaranteed quantities and delivery deadlines.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  setBulkError(null);
                  setBulkSuccess(null);
                  setShowBulkModal(true);
                }}
                style={{
                  background: '#2563EB',
                  borderColor: '#2563EB',
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <PlusCircle size={15} /> + Post Bulk Requisition
              </button>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563EB', background: 'white', padding: '6px 14px', borderRadius: '20px', border: '1px solid #BFDBFE' }}>
                {bulkDemands.length} Open Requisitions
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {bulkDemands.map((b) => (
              <div
                key={b.id}
                className="nexus-card"
                style={{
                  borderLeft: '4px solid #2563EB',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#EFF6FF', color: '#2563EB', padding: '3px 8px', borderRadius: '10px' }}>
                      {b.buyer_type}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-crop)', fontWeight: 700 }}>
                      ● Status: {b.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                    {b.buyer_name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Requires: <strong style={{ color: 'var(--color-soil-dark)' }}>{b.quantity_needed_kg.toLocaleString()} kg {b.crop}</strong>
                  </div>

                  <div
                    style={{
                      margin: '12px 0',
                      background: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Max Budget
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563EB' }}>
                        ₹{b.max_budget_kg.toFixed(2)}/kg
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Required By
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-soil-dark)', marginTop: '4px' }}>
                        {b.required_by_date}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {b.location}
                  </div>

                  {b.notes && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '10px' }}>
                      "{b.notes}"
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                  {user?.role === 'customer' ? (
                    <div
                      style={{
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: '#F8FAFC',
                        border: '1px dashed #94A3B8',
                        color: '#475569',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <ShieldCheck size={14} color="#64748B" />
                      Only verified Farmers & FPOs can accept & supply bulk orders
                    </div>
                  ) : (
                    <a
                      href={`https://wa.me/${b.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                        `Namaste ${b.buyer_name}, I am a farmer on AnnDhara and I can fulfill your requirement of ${b.quantity_needed_kg} kg ${b.crop}.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '8px',
                        fontSize: '0.78rem',
                        background: '#2563EB',
                        borderColor: '#2563EB',
                        textDecoration: 'none'
                      }}
                    >
                      <CheckCircle2 size={14} /> Accept & Supply Bulk Order
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 3: SMART COMMUNITY BUYING POOLS */}
      {/* ------------------------------------------------------------- */}
      {marketSubTab === 'community' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #FEF9E7 0%, #FFFFFF 100%)',
              border: '1px solid var(--color-gold-border)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-turmeric)', textTransform: 'uppercase' }}>
                Feature 1: Smart Community Buying ⭐
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '2px 0' }}>
                Apartment & College Area Aggregated Orders
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Instead of delivering separate 2kg bags, AnnDhara aggregates 50+ apartment families into 200kg bulk deliveries—slashing transport fees and securing 15-20% discounts.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {communityPools.map((pool) => {
              const progressPct = Math.min(100, Math.round((pool.pledged_kg / pool.target_kg) * 100));
              const isPledged = pledgePushed[pool.id];

              return (
                <div
                  key={pool.id}
                  className="nexus-card"
                  style={{
                    borderTop: '4px solid var(--color-turmeric)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, background: 'var(--color-gold-light)', color: 'var(--color-turmeric)', padding: '3px 8px', borderRadius: '10px' }}>
                        {pool.discount_pct}% GROUP DISCOUNT
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-soil-dark)', fontWeight: 600 }}>
                        {pool.members_count} Families Joined
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                      {pool.society_name}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />
                      {pool.location}
                    </div>

                    <div style={{ margin: '14px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                        <span>Produce: {getCropDisplayName(pool.crop)}</span>
                        <span style={{ color: 'var(--color-crop)' }}>{pool.pledged_kg} / {pool.target_kg} kg</span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: '10px', background: '#E7E0D3', borderRadius: '5px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progressPct}%`,
                            background: 'linear-gradient(90deg, var(--color-turmeric) 0%, var(--color-crop) 100%)',
                            height: '100%',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                    <button
                      className="btn-primary"
                      disabled={isPledged}
                      onClick={() => handlePledge(pool.id)}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '8px',
                        fontSize: '0.8rem',
                        background: isPledged ? 'var(--color-crop)' : 'var(--color-turmeric)',
                        borderColor: isPledged ? 'var(--color-crop)' : 'var(--color-turmeric)'
                      }}
                    >
                      {isPledged ? '✓ Pledged +5 kg to Society Pool' : '+ Pledge 5 kg & Lock 18% Discount'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 4: LIVE DELIVERIES & ORDER TRACKING                   */}
      {/* ------------------------------------------------------------- */}
      {marketSubTab === 'deliveries' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {orderSuccess && (
            <div
              className="nexus-card"
              style={{
                background: 'linear-gradient(135deg, #F0FDF4 0%, #EFF6FF 100%)',
                border: '1.5px solid var(--color-crop-border)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--color-crop)', color: 'white', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                  <Check size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                    {t('orderSuccessfullyPlaced')}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    Reference: <strong>{orderSuccess.reference}</strong> • Tracking active in real-time below
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', background: '#DCFCE7', color: 'var(--color-crop)', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                Status: {orderSuccess.status}
              </span>
            </div>
          )}

          <DeliveryStatusPanel
            role="customer"
            stakeholder={user?.name || orderFormData.buyer_name || 'Customer'}
          />
        </div>
      )}



      {/* Modal: Buy Produce & Order Logistics Delivery */}
      {showOrderModal && orderListing && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-crop)', textTransform: 'uppercase' }}>
                  Direct Farm-to-Doorstep Purchase
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--color-soil-dark)' }}>
                  Buy from Farmer & Book Logistics
                </h3>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {orderSuccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
                <div style={{ textAlign: 'center', padding: '20px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0' }}>
                  <div style={{ width: '48px', height: '48px', background: 'var(--color-crop)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                    <Check size={28} />
                  </div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                    Order Confirmed & Logistics Dispatched!
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    {t('orderConfirmedDesc')}
                  </div>
                  <div style={{ display: 'inline-block', margin: '14px 0 6px 0', background: 'white', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-crop)' }}>
                    {orderSuccess.reference}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    Carrying <strong>{orderSuccess.quantity_kg} kg {orderSuccess.crop}</strong> from Farmer <strong>{orderSuccess.farmer_name}</strong>
                  </div>
                  {orderSuccess.remaining_quantity_kg !== undefined && (
                    <div style={{ marginTop: '10px', fontSize: '0.8rem', color: orderSuccess.remaining_quantity_kg > 0 ? 'var(--palette-forest)' : '#DC2626', fontWeight: 700 }}>
                      {orderSuccess.remaining_quantity_kg > 0
                        ? `📦 Farmer's Remaining Lot: ${orderSuccess.remaining_quantity_kg} kg • Total Remaining Lot Value: ₹${(orderSuccess.remaining_lot_value || 0).toLocaleString()}`
                        : `🎉 Farmer's lot is now 100% Sold Out (0 kg remaining). Listing automatically archived from active marketplace.`
                      }
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowOrderModal(false)}
                    style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                  >
                    Close
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setShowOrderModal(false);
                      setMarketSubTab('deliveries');
                    }}
                    style={{ flex: 2, padding: '10px', justifyContent: 'center', gap: '6px' }}
                  >
                    <Truck size={16} /> {t('trackLiveDelivery')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmOrder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {orderError && (
                  <div className="nexus-alert danger">
                    <AlertCircle size={16} /> {orderError}
                  </div>
                )}

                {/* Farmer & Crop Summary Banner */}
                <div
                  style={{
                    background: 'var(--color-bg-subtle)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Farmer & Lot Origin
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                      {orderListing.farmer_name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <MapPin size={12} /> {orderListing.location}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Crop & Agreed Rate
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-crop)' }}>
                      {getCropDisplayName(orderListing.crop)}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-soil-dark)' }}>
                      ₹{orderListing.asking_price_kg}/kg
                    </div>
                  </div>
                </div>

                {/* Buyer Input Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Buyer / Customer Name *</label>
                    <input
                      type="text"
                      className="nexus-input"
                      required
                      placeholder="e.g. Ramesh Patel"
                      value={orderFormData.buyer_name}
                      onChange={(e) => setOrderFormData({ ...orderFormData, buyer_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contact Phone *</label>
                    <input
                      type="tel"
                      className="nexus-input"
                      required
                      placeholder="+91 98251 XXXXX"
                      value={orderFormData.phone}
                      onChange={(e) => setOrderFormData({ ...orderFormData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Purchase Quantity (kg) *</label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      Available: {orderListing.quantity_kg.toLocaleString()} kg
                    </span>
                  </div>
                  <input
                    type="number"
                    className="nexus-input"
                    required
                    min="5"
                    max={orderListing.quantity_kg}
                    value={orderFormData.quantity_kg}
                    onChange={(e) => setOrderFormData({ ...orderFormData, quantity_kg: Math.min(orderListing.quantity_kg, Math.max(1, Number(e.target.value))) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Delivery Destination Address / City *</label>
                  <input
                    type="text"
                    className="nexus-input"
                    required
                    placeholder="e.g. Shop 14, APMC Market Yard, Ahmedabad"
                    value={orderFormData.delivery_location}
                    onChange={(e) => setOrderFormData({ ...orderFormData, delivery_location: e.target.value })}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                    Logistics carrier will pick up from the farmer's gate and deliver directly to this address.
                  </div>
                </div>

                {/* Price Breakdown Calculation */}
                <div
                  style={{
                    background: '#F9FAFB',
                    border: '1px dashed #D1D5DB',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '0.82rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Produce Subtotal ({orderFormData.quantity_kg} kg × ₹{orderListing.asking_price_kg}):</span>
                    <strong>₹{(Number(orderFormData.quantity_kg) * Number(orderListing.asking_price_kg)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Shared Logistics & Loading:</span>
                    <strong style={{ color: 'var(--color-crop)' }}>₹250.00</strong>
                  </div>
                  <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 800 }}>
                    <span style={{ color: 'var(--color-soil-dark)' }}>Total Payable:</span>
                    <span style={{ color: 'var(--color-crop)' }}>
                      ₹{(Number(orderFormData.quantity_kg) * Number(orderListing.asking_price_kg) + 250).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowOrderModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={orderSubmitting} style={{ padding: '8px 18px', gap: '6px' }}>
                    <Truck size={15} /> {orderSubmitting ? 'Booking Delivery...' : 'Confirm Order & Dispatch Logistics'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* BUYER POST BULK REQUISITION MODAL */}
      {/* ------------------------------------------------------------- */}
      {showBulkModal && (
        <div className="nexus-modal-overlay">
          <div className="nexus-modal" style={{ maxWidth: '580px' }}>
            <div className="nexus-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} color="#2563EB" />
                <h3 className="nexus-modal-title">Post Institutional Bulk Requisition</h3>
              </div>
              <button
                className="nexus-modal-close"
                onClick={() => setShowBulkModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {bulkSuccess ? (
              <div style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                <CheckCircle2 size={48} color="var(--color-crop)" />
                <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-crop)', margin: 0 }}>
                  Requisition Posted Successfully!
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', maxWidth: '420px', margin: 0 }}>
                  {bulkSuccess}
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreateBulkDemand} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {bulkError && (
                  <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    {bulkError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Buyer / Entity Name *</label>
                    <input
                      type="text"
                      className="nexus-input"
                      required
                      placeholder="e.g. Grand Heritage Hotel"
                      value={bulkFormData.buyer_name}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, buyer_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Buyer Category *</label>
                    <select
                      className="nexus-select"
                      value={bulkFormData.buyer_type}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, buyer_type: e.target.value })}
                    >
                      <option value="Hotel">Hotel</option>
                      <option value="Restaurant">Restaurant</option>
                      <option value="Hostel / Mess">Hostel / Mess</option>
                      <option value="Supermarket">Supermarket</option>
                      <option value="Caterer">Caterer</option>
                      <option value="Wholesale Buyer">Wholesale Buyer</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Contact Phone / WhatsApp *</label>
                    <input
                      type="tel"
                      className="nexus-input"
                      required
                      placeholder="+91 98251 XXXXX"
                      value={bulkFormData.phone}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Crop Commodity *</label>
                    <select
                      className="nexus-select"
                      value={bulkFormData.crop}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, crop: e.target.value })}
                    >
                      {commodities.map((c) => (
                        <option key={c} value={c}>
                          {getCropDisplayName(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Required Quantity (kg) *</label>
                    <input
                      type="number"
                      className="nexus-input"
                      required
                      min="50"
                      step="25"
                      value={bulkFormData.quantity_needed_kg}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, quantity_needed_kg: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Max Budget (₹/kg) *</label>
                    <input
                      type="number"
                      className="nexus-input"
                      required
                      min="1"
                      step="0.5"
                      value={bulkFormData.max_budget_kg}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, max_budget_kg: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Delivery Location / City *</label>
                    <input
                      type="text"
                      className="nexus-input"
                      required
                      placeholder="e.g. Navrangpura, Ahmedabad"
                      value={bulkFormData.location}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, location: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Required By *</label>
                    <input
                      type="text"
                      className="nexus-input"
                      required
                      placeholder="e.g. Within 24 hours, Tomorrow morning"
                      value={bulkFormData.required_by_date}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, required_by_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Special Quality / Sourcing Instructions</label>
                  <textarea
                    className="nexus-input"
                    rows="2"
                    placeholder="e.g. Grade A ripe farmgate produce required, daily recurring delivery preferred"
                    value={bulkFormData.notes}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, notes: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowBulkModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={bulkSubmitting}
                    style={{ background: '#2563EB', borderColor: '#2563EB', padding: '8px 18px', gap: '6px' }}
                  >
                    <CheckCircle2 size={15} /> {bulkSubmitting ? 'Posting...' : 'Publish Bulk Requisition'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
