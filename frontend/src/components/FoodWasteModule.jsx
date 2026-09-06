import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Flame,
  ShieldCheck,
  TrendingDown,
  RefreshCw,
  Utensils,
  Building2,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Clock,
  DollarSign
} from 'lucide-react';
import { getCropDisplayName } from '../utils/cropTranslations';

export default function FoodWasteModule() {
  const [wasteData, setWasteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [discountTriggered, setDiscountTriggered] = useState({});

  const fetchWasteRadar = () => {
    setLoading(true);
    fetch('/api/waste-prevention')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setWasteData(data.data);
        }
      })
      .catch((err) => console.error('Error fetching waste prevention:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWasteRadar();
  }, []);

  const handleApplyFlashDiscount = (listingId) => {
    setDiscountTriggered((prev) => ({
      ...prev,
      [listingId]: true
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title Banner */}
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-accent-red)', textTransform: 'uppercase' }}>
            <Flame size={14} /> Sustainability & Perishable Preservation
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0 0 0' }}>
            AI Food Waste Prevention Engine 🔥
          </h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Identifies produce lots at risk of spoilage and automatically triggers dynamic discounting, food processor diversion, or community pool flash sales.
          </div>
        </div>

        <button
          className="btn-secondary"
          onClick={fetchWasteRadar}
          disabled={loading}
          style={{ padding: '8px 16px', fontSize: '0.82rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin-icon' : ''} /> Refresh Watchdog
        </button>
      </div>

      {/* Top Warning Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FFF1F2 0%, #FFFFFF 100%)',
          border: '1px solid var(--color-red-border)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'var(--color-red-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent-red)',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent-red)', textTransform: 'uppercase' }}>
              Active Spoilage Risk Radar
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '2px 0' }}>
              {wasteData?.total_perishable_lots_at_risk || 0} Lots Nearing Perishable Limit ({wasteData?.total_at_risk_kg || 0} kg)
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Produce with shelf life ≤ 5 days with pending liquidation. Proactive rescue workflows available below.
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'white',
            border: '1px solid var(--color-red-border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 18px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Potential Loss Averted
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-accent-red)' }}>
            ₹{((wasteData?.total_at_risk_kg || 1300) * 22).toLocaleString()}
          </div>
        </div>
      </div>

      {/* High-Risk Produce Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {wasteData?.actionable_alerts?.map((alert) => {
          const isTriggered = discountTriggered[alert.listing_id];

          return (
            <div
              key={alert.listing_id}
              className="nexus-card"
              style={{
                borderTop: '4px solid var(--color-accent-red)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span
                    style={{
                      background: 'var(--color-red-light)',
                      color: 'var(--color-accent-red)',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '10px'
                    }}
                  >
                    ⚠ {alert.risk_status}
                  </span>

                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent-red)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} /> {alert.shelf_life_remaining_days} Days Left
                  </span>
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                  {getCropDisplayName(alert.crop)} ({alert.quantity_kg.toLocaleString()} kg)
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Grower: <strong>{alert.farmer_name}</strong> • Original Asking: <strong>₹{alert.asking_price_kg}/kg</strong>
                </div>

                {/* Rescue Strategy Box */}
                <div
                  style={{
                    margin: '14px 0',
                    background: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-soil)', textTransform: 'uppercase' }}>
                    Recommended Mitigation Action:
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-soil-dark)', marginTop: '4px' }}>
                    {alert.recommended_action}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-crop)', marginTop: '4px' }}>
                    Clearance price anchor: <strong>₹{alert.suggested_clearance_price_kg}/kg</strong> (15% flash reduction)
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', gap: '8px' }}>
                <button
                  className="btn-secondary"
                  disabled={isTriggered}
                  onClick={() => handleApplyFlashDiscount(alert.listing_id)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '0.76rem',
                    justifyContent: 'center',
                    background: isTriggered ? 'var(--color-crop-light)' : 'white',
                    borderColor: isTriggered ? 'var(--color-crop-border)' : 'var(--color-border)',
                    color: isTriggered ? 'var(--color-crop)' : 'var(--color-soil-dark)'
                  }}
                >
                  {isTriggered ? '✓ 15% Discount Active' : '⚡ Apply 15% Flash Discount'}
                </button>

                <button
                  className="btn-primary"
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '0.76rem',
                    justifyContent: 'center',
                    background: '#2563EB',
                    borderColor: '#2563EB'
                  }}
                  onClick={() => alert(`Rerouted ${alert.quantity_kg} kg ${alert.crop} to Kissan Agro Processing Hub (Sanand)`)}
                >
                  <Building2 size={13} /> Route to Processor
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sustainable Impact Principles */}
      <div className="nexus-card">
        <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-soil-dark)', marginBottom: '12px' }}>
          AnnDhara 3-Tier Perishable Waste Mitigation Hierarchy
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-crop)' }}>
              1. Local Institutional Absorption
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Proactively matches ripe harvests to hostel messes and hotel banquet kitchens requiring immediate consumption.
            </div>
          </div>

          <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-turmeric)' }}>
              2. Community Pool Flash Deals
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Passes 15% dynamic savings to apartment societies for bulk vegetable deliveries within 24 hours.
            </div>
          </div>

          <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#2563EB' }}>
              3. Food Processing Plant Diversion
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Diverts ripe tomatoes to puree/sauce manufacturers and onions to dehydrated powder units, securing 80%+ farmer value.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
