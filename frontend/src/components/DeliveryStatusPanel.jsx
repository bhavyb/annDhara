import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  Truck,
  Navigation,
  Check,
  Search,
  ChevronRight,
  Send,
  Sparkles,
  ShieldCheck,
  UserCheck,
  KeyRound,
  AlertCircle,
  X
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import RouteMapModal from './RouteMapModal.jsx';

const statuses = ['Assigned', 'Accepted', 'Picked Up', 'In Transit', 'Delivered'];

const LOCATION_PRESETS = [
  '🚜 At Farm Gate (Loading Produce)',
  '🛣️ Departed Farm - On Highway Corridor',
  '⛽ Midway Highway Checkpoint',
  '🏙️ Entering Buyer City Ring Road',
  '🏪 Arrived at Buyer Facility / Doorstep'
];

export default function DeliveryStatusPanel({ role, stakeholder, user }) {
  const { t } = useLanguage();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [customLocations, setCustomLocations] = useState({});

  // Route Map Modal State
  const [mapModalData, setMapModalData] = useState({ isOpen: false, routeData: null, delivery: null });
  const [loadingMap, setLoadingMap] = useState('');

  // Two-Sided OTP Verification Modal State
  const [otpModal, setOtpModal] = useState(null); // { type: 'pickup' | 'delivery', delivery: ... }
  const [inputOtp, setInputOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const load = async () => {
    try {
      const isScopedRole = role === 'customer' || role === 'farmer' || role === 'logistics';
      const activeStakeholder = stakeholder || user?.organization || user?.name || user?.email || '';
      const query = isScopedRole
        ? `?role=${encodeURIComponent(role)}&stakeholder=${encodeURIComponent(activeStakeholder)}`
        : '?all=true';
      const response = await fetch(`/api/deliveries${query}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load deliveries');
      setDeliveries(data.deliveries || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000); // Polling every 4s for live synchronization
    return () => clearInterval(timer);
  }, [role, stakeholder]);

  const updateStatus = async (delivery, status, optionalLocation = null) => {
    setUpdating(delivery.reference);
    const loc = optionalLocation !== null ? optionalLocation : (customLocations[delivery.reference] || delivery.current_location);
    try {
      const response = await fetch(`/api/deliveries/${delivery.reference}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          current_location: loc
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to update delivery');
      setDeliveries((current) => current.map((item) => (item.reference === delivery.reference ? data.delivery : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating('');
    }
  };

  const cancelDelivery = async (delivery) => {
    if (!window.confirm(`Are you sure you want to cancel order ${delivery.reference}? The reserved ${delivery.quantity_kg} kg of ${delivery.crop} will be automatically restored to the farmer's lot.`)) {
      return;
    }
    setUpdating(delivery.reference);
    setError('');
    try {
      const response = await fetch(`/api/deliveries/${delivery.reference}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled prior to fulfillment' })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to cancel order');
      setDeliveries((current) => current.map((item) => (item.reference === delivery.reference ? data.delivery : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating('');
    }
  };

  const updateLocationOnly = async (delivery, locationText) => {
    if (!locationText || !locationText.trim()) return;
    setUpdating(delivery.reference);
    try {
      const response = await fetch(`/api/deliveries/${delivery.reference}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: delivery.status,
          current_location: locationText.trim()
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to update location');
      setDeliveries((current) => current.map((item) => (item.reference === delivery.reference ? data.delivery : item)));
      setCustomLocations((prev) => ({ ...prev, [delivery.reference]: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating('');
    }
  };

  const openRouteMap = async (delivery) => {
    setLoadingMap(delivery.reference);
    try {
      const res = await fetch(`/api/deliveries/${delivery.reference}/route`);
      const data = await res.json();
      if (data.success && data.data) {
        setMapModalData({
          isOpen: true,
          routeData: data.data,
          delivery: delivery
        });
      } else {
        alert(data.error || 'Could not load route map.');
      }
    } catch (err) {
      console.error('Failed to load route map:', err);
      alert('Network error while loading route map.');
    } finally {
      setLoadingMap('');
    }
  };

  const acceptDelivery = async (delivery) => {
    setUpdating(delivery.reference);
    try {
      const carrierName = user?.organization || user?.name || user?.email || (stakeholder && stakeholder !== 'Logistics partner' ? stakeholder : 'Driver');
      const response = await fetch(`/api/deliveries/${delivery.reference}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logistics_id: user?.id || null,
          logistics_name: carrierName,
          vehicle_number: user?.vehicle_number || 'Fleet Vehicle',
          current_location: `Carrier ${carrierName} dispatched to ${delivery.pickup_location}`
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to accept delivery');
      setDeliveries((current) => current.map((item) => (item.reference === delivery.reference ? data.delivery : item)));
      load();

      // Automatically trigger and display the AI Optimized Route Map right after acceptance
      if (data.optimized_route) {
        setMapModalData({
          isOpen: true,
          routeData: data.optimized_route,
          delivery: data.delivery || delivery
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating('');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpModal || !inputOtp.trim()) return;
    setVerifyingOtp(true);
    setOtpError('');
    const endpoint = otpModal.type === 'pickup'
      ? `/api/deliveries/${otpModal.delivery.reference}/verify-pickup`
      : `/api/deliveries/${otpModal.delivery.reference}/verify-delivery`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: inputOtp.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed. Please check the 4-digit OTP.');
      }
      setDeliveries((current) =>
        current.map((item) => (item.reference === otpModal.delivery.reference ? data.delivery : item))
      );
      setOtpModal(null);
      setInputOtp('');
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const filteredDeliveries = deliveries.filter((d) => {
    // Hard block dummy test orders from ever rendering in the UI
    const isTest =
      (d.farmer_name || '').toLowerCase().includes('test') ||
      (d.buyer_name || '').toLowerCase().includes('test') ||
      (d.pickup_location || '').toLowerCase().includes('test') ||
      (d.destination || '').toLowerCase().includes('test') ||
      d.reference === 'ADH-1001' ||
      (d.farmer_name || '').toLowerCase() === 'matched farmer';
    if (isTest) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.reference.toLowerCase().includes(q) ||
      d.crop.toLowerCase().includes(q) ||
      d.farmer_name.toLowerCase().includes(q) ||
      d.buyer_name.toLowerCase().includes(q) ||
      d.destination.toLowerCase().includes(q)
    );
  });

  return (
    <section className="delivery-panel nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className="card-title-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="card-icon-pill" style={{ background: '#F5F3FF', color: '#7C3AED', padding: '10px', borderRadius: '12px' }}>
            <Truck size={22} />
          </div>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              {role === 'customer'
                ? t('myPurchasesTitle')
                : role === 'farmer'
                  ? t('myFarmgateOrdersTitle')
                  : t('logisticsOpsTitle')}
            </h2>
            <p className="card-subtitle" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
              {role === 'customer'
                ? 'Tracking your fresh produce shipments, carrier vehicle details, and real-time locations.'
                : role === 'farmer'
                  ? 'Orders placed for your harvest lots and incoming vehicle pickup status.'
                  : 'Accept incoming farmer-to-buyer orders and publish live location & milestone updates.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search reference, crop, party..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px 6px 30px',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                background: 'white',
                width: '180px'
              }}
            />
          </div>

          <button className="btn-secondary" onClick={load} disabled={loading} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
            <RefreshCw size={13} className={loading ? 'spin-icon' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="nexus-alert danger">{error}</div>}

      {loading && !deliveries.length ? (
        <p className="card-subtitle">Connecting to live delivery updates stream...</p>
      ) : !filteredDeliveries.length ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'var(--color-bg-subtle)', borderRadius: '8px' }}>
          <Truck size={28} color="var(--color-text-muted)" style={{ margin: '0 auto 8px auto' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-soil-dark)' }}>No active deliveries found</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            When a buyer orders produce from a farmer, it will instantly appear here for logistics dispatch and tracking.
          </div>
        </div>
      ) : (
        filteredDeliveries.map((delivery) => {
          const currentIndex = statuses.indexOf(delivery.status);
          const isLogistics = role === 'logistics';
          const isDelivered = delivery.status === 'Delivered';
          const isInTransit = delivery.status === 'In Transit';

          return (
            <div
              className="delivery-card"
              key={delivery.reference}
              style={{
                background: 'white',
                border: `1.5px solid ${isDelivered ? 'var(--color-crop-border)' : isInTransit ? '#BFDBFE' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              {/* Main Headline: Exactly who bought what from whom */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                      Customer <span style={{ color: '#2563EB' }}>{delivery.buyer_name}</span> bought{' '}
                      <span style={{ color: 'var(--color-crop)' }}>{delivery.quantity_kg} kg {delivery.crop}</span> from Farmer{' '}
                      <span style={{ color: '#D97706' }}>{delivery.farmer_name}</span>
                    </span>
                    <span style={{ fontSize: '0.72rem', background: '#F3F4F6', color: '#4B5563', padding: '2px 8px', borderRadius: '10px', fontFamily: 'monospace', fontWeight: 700 }}>
                      {delivery.reference}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    <MapPin size={14} color="var(--color-crop)" />
                    <strong>Pickup:</strong> {delivery.pickup_location} ➔ <strong>Drop:</strong> {delivery.destination}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isLogistics && (
                    delivery.status === 'Assigned' ? (
                      <span style={{ fontSize: '0.74rem', background: '#FEF3C7', color: '#B45309', padding: '4px 10px', borderRadius: '10px', fontWeight: 700 }}>
                        ⚡ Open for Acceptance
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.74rem', background: '#ECFDF5', color: '#065F46', padding: '4px 10px', borderRadius: '10px', fontWeight: 700 }}>
                        🔒 Claimed by You ({delivery.logistics_name})
                      </span>
                    )
                  )}
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: delivery.status === 'Cancelled' ? '#FEE2E2' : isDelivered ? '#E8F5E9' : isInTransit ? '#EFF6FF' : '#FEF3C7',
                      color: delivery.status === 'Cancelled' ? '#DC2626' : isDelivered ? 'var(--color-crop)' : isInTransit ? '#2563EB' : '#B45309'
                    }}
                  >
                    ● {delivery.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => openRouteMap(delivery)}
                    title="View live GPS route & map on Leaflet"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Navigation size={12} />
                    <span>{loadingMap === delivery.reference ? 'Loading...' : '🗺️ AI Map'}</span>
                  </button>

                  {delivery.status !== 'Delivered' && delivery.status !== 'Cancelled' && (
                    <button
                      type="button"
                      onClick={() => cancelDelivery(delivery)}
                      disabled={updating === delivery.reference}
                      title="Cancel order and restore lot inventory to farmer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <span>{updating === delivery.reference ? 'Cancelling...' : '✕ Cancel Order'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Real-time Location Highlight Box ("Logistics Kya Chhe") */}
              <div
                style={{
                  background: isDelivered ? '#F0FDF4' : delivery.status === 'Cancelled' ? '#FEF2F2' : 'linear-gradient(135deg, #FAF5FF 0%, #EFF6FF 100%)',
                  border: `1px solid ${isDelivered ? '#BBF7D0' : delivery.status === 'Cancelled' ? '#FECACA' : '#DDD6FE'}`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: isDelivered ? 'var(--color-crop)' : delivery.status === 'Cancelled' ? '#DC2626' : '#7C3AED', color: 'white', padding: '6px', borderRadius: '50%', display: 'flex' }}>
                    <Navigation size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                      📍 Real-Time Logistics Location & Checkpoint
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-soil-dark)', marginTop: '2px' }}>
                      {delivery.current_location || (isDelivered ? `Delivered at ${delivery.destination}` : `At ${delivery.pickup_location} (Awaiting Driver)`)}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                  <div>🚚 <strong>Carrier:</strong> {delivery.logistics_name}</div>
                  <div>🚗 <strong>Vehicle:</strong> {delivery.vehicle_number || (delivery.status === 'Assigned' ? 'Awaiting Carrier' : 'Fleet Vehicle')}</div>
                  {delivery.updated_at && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Updated: {delivery.updated_at}</div>}
                </div>
              </div>

              {/* Progress Stepper or Cancellation Banner */}
              {delivery.status === 'Cancelled' ? (
                <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#B91C1C', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <AlertCircle size={16} />
                  <span>Order Cancelled prior to fulfillment • Ordered quantity ({delivery.quantity_kg} kg) has been restored to the farmer's lot.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '6px 0' }}>
                  {statuses.map((status, index) => {
                    const isPassed = index <= currentIndex;
                    const isCurrent = index === currentIndex;
                    return (
                      <div
                        key={status}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.74rem',
                          fontWeight: isCurrent ? 800 : isPassed ? 700 : 500,
                          color: isPassed ? 'var(--color-crop)' : 'var(--color-text-muted)',
                          minWidth: 'fit-content'
                        }}
                      >
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isPassed ? 'var(--color-crop)' : '#E5E7EB',
                            color: isPassed ? 'white' : '#9CA3AF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            boxShadow: isCurrent ? '0 0 0 3px rgba(30, 107, 45, 0.2)' : 'none'
                          }}
                        >
                          {isPassed ? <Check size={14} /> : index + 1}
                        </div>
                        <span>{status}</span>
                        {index < statuses.length - 1 && <ChevronRight size={14} color="#D1D5DB" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* FARMER SECURE PICKUP OTP BOX */}
              {role === 'farmer' && delivery.pickup_otp && (
                <div
                  style={{
                    background: '#ECFDF5',
                    border: '1.5px dashed #059669',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#059669', color: 'white', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                      <KeyRound size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                        Farmgate Pickup Verification OTP
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#065F46', marginTop: '1px' }}>
                        Share this 4-digit code <strong>ONLY</strong> with the logistics carrier upon collection at your farmgate.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        letterSpacing: '4px',
                        color: '#047857',
                        background: 'white',
                        padding: '4px 16px',
                        borderRadius: '8px',
                        border: '1px solid #A7F3D0',
                        fontFamily: 'monospace',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                    >
                      {delivery.pickup_otp}
                    </div>
                    {delivery.pickup_verified_at && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-crop)', fontWeight: 700 }}>
                        ✓ Verified by Driver
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* BUYER SECURE DELIVERY OTP BOX */}
              {role === 'customer' && delivery.delivery_otp && (
                <div
                  style={{
                    background: '#EFF6FF',
                    border: '1.5px dashed #2563EB',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#2563EB', color: 'white', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                      <KeyRound size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase' }}>
                        Doorstep Delivery Verification OTP
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#1E3A8A', marginTop: '1px' }}>
                        Share this 4-digit code with the logistics driver <strong>ONLY</strong> after inspecting & receiving your produce.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        letterSpacing: '4px',
                        color: '#1E40AF',
                        background: 'white',
                        padding: '4px 16px',
                        borderRadius: '8px',
                        border: '1px solid #BFDBFE',
                        fontFamily: 'monospace',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                    >
                      {delivery.delivery_otp}
                    </div>
                    {delivery.delivery_verified_at && (
                      <span style={{ fontSize: '0.7rem', color: '#2563EB', fontWeight: 700 }}>
                        ✓ Verified by Driver
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Checkpoints info banner for non-drivers */}
              {!isLogistics && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.73rem', color: 'var(--color-text-secondary)', padding: '2px 0' }}>
                  <ShieldCheck size={14} color="var(--color-crop)" />
                  <span>Checkpoints and milestones are strictly verified and published by the assigned logistics driver.</span>
                </div>
              )}

              {/* Logistics Actions: Driver Exclusive Checkpoints & Two-Sided OTP Verification */}
              {isLogistics && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-soil-dark)', textTransform: 'uppercase' }}>
                        Driver Operations & Verification Controls
                      </span>
                      {delivery.status === 'Accepted' && (
                        <span style={{ fontSize: '0.7rem', color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          🔒 Requires Farmer Pickup OTP
                        </span>
                      )}
                      {delivery.status === 'In Transit' && (
                        <span style={{ fontSize: '0.7rem', color: '#1E40AF', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          🔒 Requires Buyer Delivery OTP
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => openRouteMap(delivery)}
                        style={{
                          fontSize: '0.78rem',
                          padding: '6px 12px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#EFF6FF',
                          borderColor: '#BFDBFE',
                          color: '#1D4ED8'
                        }}
                      >
                        <Navigation size={13} />
                        {loadingMap === delivery.reference ? 'Loading Map...' : '🗺️ View AI Route & GPS'}
                      </button>

                      {/* Step 1: Claim/Accept */}
                      {delivery.status === 'Assigned' && (
                        <button
                          className="btn-primary"
                          disabled={updating === delivery.reference}
                          onClick={() => acceptDelivery(delivery)}
                          style={{ fontSize: '0.78rem', padding: '6px 14px', fontWeight: 800 }}
                        >
                          {updating === delivery.reference ? 'Accepting...' : 'Accept & Assign Vehicle'}
                        </button>
                      )}

                      {/* Step 2: Farmer Pickup Verification (Requires Farmer's OTP) */}
                      {delivery.status === 'Accepted' && (
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setOtpModal({ type: 'pickup', delivery });
                            setInputOtp('');
                            setOtpError('');
                          }}
                          style={{ fontSize: '0.78rem', padding: '6px 14px', fontWeight: 800, background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <KeyRound size={14} /> Verify Farmer Pickup (Enter OTP)
                        </button>
                      )}

                      {/* Step 3: Produce Loaded -> Depart Farm */}
                      {delivery.status === 'Picked Up' && (
                        <button
                          className="btn-primary"
                          disabled={updating === delivery.reference}
                          onClick={() => updateStatus(delivery, 'In Transit')}
                          style={{ fontSize: '0.78rem', padding: '6px 14px', fontWeight: 800, background: '#7C3AED', borderColor: '#7C3AED', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Truck size={14} /> Depart Farm & Mark In Transit
                        </button>
                      )}

                      {/* Step 4: Buyer Delivery Verification (Requires Customer's OTP) */}
                      {delivery.status === 'In Transit' && (
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setOtpModal({ type: 'delivery', delivery });
                            setInputOtp('');
                            setOtpError('');
                          }}
                          style={{ fontSize: '0.78rem', padding: '6px 14px', fontWeight: 800, background: '#2563EB', borderColor: '#2563EB', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <KeyRound size={14} /> Verify Buyer Delivery (Enter OTP)
                        </button>
                      )}

                      {delivery.status === 'Delivered' && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-crop)', background: '#E8F5E9', padding: '4px 12px', borderRadius: '6px' }}>
                          ✓ Delivered & Fully Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Driver Checkpoint Publisher (Only driver can update checkpoint locations) */}
                  {delivery.status !== 'Assigned' && !isDelivered && (
                    <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-soil-dark)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Navigation size={13} color="#7C3AED" /> Driver Checkpoint Publisher:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {LOCATION_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            onClick={() => updateLocationOnly(delivery, preset)}
                            disabled={updating === delivery.reference}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #CBD5E1',
                              background: 'white',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              color: 'var(--color-soil-dark)'
                            }}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Or post custom landmark (e.g. Near Sanand Toll Plaza, moving at 45 km/h)..."
                          value={customLocations[delivery.reference] || ''}
                          onChange={(e) => setCustomLocations({ ...customLocations, [delivery.reference]: e.target.value })}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: '0.78rem',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            background: 'white'
                          }}
                        />
                        <button
                          className="btn-secondary"
                          onClick={() => updateLocationOnly(delivery, customLocations[delivery.reference])}
                          disabled={updating === delivery.reference || !customLocations[delivery.reference]}
                          style={{ fontSize: '0.75rem', padding: '6px 12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Send size={12} /> Post Checkpoint
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Driver OTP Verification Modal */}
      {otpModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              border: '1px solid var(--color-border)'
            }}
          >
            <button
              onClick={() => { setOtpModal(null); setOtpError(''); }}
              style={{ position: 'absolute', right: '16px', top: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  background: otpModal.type === 'pickup' ? '#ECFDF5' : '#EFF6FF',
                  color: otpModal.type === 'pickup' ? '#059669' : '#2563EB',
                  padding: '10px',
                  borderRadius: '12px'
                }}
              >
                <KeyRound size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                  {otpModal.type === 'pickup' ? 'Verify Farmer Farmgate Pickup' : 'Verify Customer Doorstep Delivery'}
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Reference: <strong>{otpModal.delivery.reference}</strong>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', lineHeight: 1.45, margin: '0 0 16px 0' }}>
              {otpModal.type === 'pickup'
                ? `Ask Farmer "${otpModal.delivery.farmer_name}" for their 4-digit Pickup OTP upon inspecting and loading the ${otpModal.delivery.quantity_kg} kg ${otpModal.delivery.crop}.`
                : `Ask Customer "${otpModal.delivery.buyer_name}" for their 4-digit Delivery OTP upon handing over the ${otpModal.delivery.quantity_kg} kg ${otpModal.delivery.crop}.`}
            </p>

            {otpError && (
              <div className="nexus-alert danger" style={{ marginBottom: '14px', fontSize: '0.8rem', padding: '8px 12px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-soil-dark)', marginBottom: '6px' }}>
                  Enter 4-Digit {otpModal.type === 'pickup' ? 'Farmer Pickup' : 'Customer Delivery'} OTP:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="• • • •"
                  value={inputOtp}
                  onChange={(e) => setInputOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '1.6rem',
                    fontWeight: 900,
                    letterSpacing: '8px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    borderRadius: '8px',
                    border: '2px solid #7C3AED',
                    background: '#FAF5FF',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setOtpModal(null); setOtpError(''); }}
                  style={{ flex: 1, padding: '10px', fontSize: '0.84rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={verifyingOtp || inputOtp.length < 4}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '0.84rem',
                    background: otpModal.type === 'pickup' ? '#059669' : '#2563EB',
                    borderColor: otpModal.type === 'pickup' ? '#059669' : '#2563EB',
                    justifyContent: 'center'
                  }}
                >
                  {verifyingOtp ? 'Verifying OTP...' : 'Submit & Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Route Optimization Interactive Map Modal */}
      <RouteMapModal
        isOpen={mapModalData.isOpen}
        onClose={() => setMapModalData({ isOpen: false, routeData: null, delivery: null })}
        routeData={mapModalData.routeData}
        delivery={mapModalData.delivery}
      />
    </section>
  );
}
