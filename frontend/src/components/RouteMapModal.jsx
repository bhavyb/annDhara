import React from 'react';
import { X, Navigation, Truck, MapPin, ExternalLink, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import RouteMap from './RouteMap.jsx';

export default function RouteMapModal({
  isOpen,
  onClose,
  routeData,
  delivery
}) {
  if (!isOpen || !routeData) return null;

  const totalKm = routeData.total_distance_km || routeData.metrics?.optimized_route_distance_km || 0;
  const etaMins = routeData.eta_minutes || Math.max(15, Math.round((totalKm / 35.0) * 60));
  const navUrl = routeData.navigation_url;
  const stops = routeData.route_stops || routeData.route_sequence || [];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
            color: 'white'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(37, 99, 235, 0.25)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Navigation size={22} color="#60A5FA" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  AI Route Optimization & GPS Map
                </h3>
                {delivery?.reference && (
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontFamily: 'monospace'
                    }}
                  >
                    {delivery.reference}
                  </span>
                )}
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
                Automated driver dispatch, multi-stop GPS road geometry, and OTP-secured checkpoints
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              color: '#CBD5E1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Map & Details */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Top Quick Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}
          >
            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '10px',
                padding: '12px 14px'
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                Distance & Travel Time
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
                {totalKm} km • ~{etaMins} mins
              </div>
            </div>

            <div
              style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '10px',
                padding: '12px 14px'
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>
                Assigned Carrier
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1E3A8A', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {delivery?.logistics_name || routeData?.partner?.company || 'Logistics Fleet'}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#3B82F6', marginTop: '2px' }}>
                {delivery?.vehicle_number || routeData?.partner?.vehicle_number || 'Tata Ace (Mini Truck)'}
              </div>
            </div>

            <div
              style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '10px',
                padding: '12px 14px'
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>
                Delivery Cargo
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#B45309', marginTop: '4px' }}>
                {delivery?.quantity_kg || routeData?.total_load_carried_kg || '350'} kg {delivery?.crop || 'Produce'}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#D97706', marginTop: '2px' }}>
                Status: {delivery?.status || 'Accepted & Dispatched'}
              </div>
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <RouteMap
            routeData={routeData}
            height="440px"
            title={`${delivery?.crop || 'Produce'} Delivery Route • ${stops.length} Stops`}
            showSummaryHeader={true}
          />

          {/* Navigation Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '0.85rem', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={18} color="#16A34A" />
              <span>Two-sided OTP verification active at Farmgate Pickup and Doorstep Delivery.</span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {navUrl && (
                <a
                  href={navUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#2563EB',
                    color: 'white',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  <Navigation size={16} />
                  <span>Start Turn-by-Turn GPS Navigation</span>
                  <ExternalLink size={14} />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  background: 'white',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
                Close Map
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
