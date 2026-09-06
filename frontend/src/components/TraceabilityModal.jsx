import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  CheckCircle2,
  MapPin,
  Truck,
  ShieldCheck,
  Calendar,
  Thermometer,
  Leaf,
  ExternalLink,
  Award
} from 'lucide-react';
import { getCropDisplayName } from '../utils/cropTranslations';

export default function TraceabilityModal({ listing, onClose }) {
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!listing?.id) return;
    setLoading(true);
    fetch(`/api/traceability/${listing.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTraceData(data.data);
        }
      })
      .catch((err) => console.error('Traceability fetch error:', err))
      .finally(() => setLoading(false));
  }, [listing]);

  if (!listing) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '14px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--color-crop-light)',
                color: 'var(--color-crop)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <QrCode size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                Farm-to-Fork Traceability
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Verifiable Origin & Cold-Chain Journey (Batch #{traceData?.batch_id || 'NX-004821'})
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spin-icon" style={{ display: 'inline-block', color: 'var(--color-crop)', marginBottom: '8px' }}>
              <QrCode size={30} />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Verifying cryptographic farmgate provenance log...
            </p>
          </div>
        ) : (
          <div>
            {/* Top Product Summary Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1E6B2D10 0%, #D9822B15 100%)',
                border: '1px solid var(--color-crop-border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                  {getCropDisplayName(listing.crop)}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  Variety: <strong>{listing.variety || 'Standard Grade'}</strong> • Farmgate: <strong>{listing.location}</strong>
                </div>
              </div>

              {/* QR Code Graphic Placeholder */}
              <div
                style={{
                  background: 'white',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    background: '#2B1810',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    letterSpacing: '1px'
                  }}
                >
                  <QrCode size={36} color="white" />
                  AnnDhara
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 600 }}>
                  SCAN TO VERIFY
                </div>
              </div>
            </div>

            {/* Farm Origin & Soil Card */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '20px'
              }}
            >
              <div
                style={{
                  background: 'var(--color-bg-subtle)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  <Leaf size={14} color="var(--color-crop)" /> Grower / Farm
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-soil-dark)', marginTop: '4px' }}>
                  {listing.farmer_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-crop)', fontWeight: 600 }}>
                  Verified FPO Member
                </div>
              </div>

              <div
                style={{
                  background: 'var(--color-bg-subtle)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  <Award size={14} color="var(--color-turmeric)" /> Soil & Quality Audit
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-soil-dark)', marginTop: '4px' }}>
                  Grade A+ Natural
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Zero Toxic Residue
                </div>
              </div>

              <div
                style={{
                  background: 'var(--color-bg-subtle)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  <Thermometer size={14} color="#2563EB" /> Carbon Footprint
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2563EB', marginTop: '4px' }}>
                  0.18 kg CO₂ / kg
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-crop)', fontWeight: 600 }}>
                  -57% vs Traditional
                </div>
              </div>
            </div>

            {/* Verifiable Step-by-Step Journey Timeline */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-soil-dark)', marginBottom: '12px' }}>
                Verifiable Supply Chain Journey:
              </div>

              <div style={{ position: 'relative', paddingLeft: '24px' }}>
                {/* Vertical Line */}
                <div
                  style={{
                    position: 'absolute',
                    left: '9px',
                    top: '8px',
                    bottom: '8px',
                    width: '2px',
                    background: 'var(--color-crop-border)'
                  }}
                />

                {traceData?.timeline?.map((step, idx) => (
                  <div key={idx} style={{ position: 'relative', marginBottom: '16px' }}>
                    {/* Circle Bullet */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '-24px',
                        top: '2px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'var(--color-crop)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid white',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <CheckCircle2 size={12} strokeWidth={3} />
                    </div>

                    <div
                      style={{
                        background: 'white',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-soil-dark)' }}>
                          {step.stage}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {step.timestamp}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-soil)', marginTop: '2px' }}>
                        <MapPin size={11} style={{ display: 'inline', marginRight: '3px' }} />
                        {step.location}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        {step.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Consumer Trust Note */}
            <div
              style={{
                background: 'var(--color-crop-light)',
                border: '1px solid var(--color-crop-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <ShieldCheck size={24} color="var(--color-crop)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--color-crop-hover)' }}>
                <strong>Zero Intermediary Integrity: </strong>
                By scanning this lot, the consumer directly supports <strong>{listing.farmer_name}</strong>.
                Eliminated 4 layers of middlemen and reduced supply chain transit time by 48 hours.
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
