import React from 'react';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  Truck,
  Users,
  Building2,
  Sprout,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Compass,
  Cpu,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';

export default function SystemOverview({ onNavigate }) {
  const stakeholders = [
    {
      id: 'farmer-hub',
      title: 'Farmer & FPO',
      role: '👨🌾 Producer',
      color: 'var(--color-crop)',
      bgColor: 'var(--color-crop-light)',
      borderColor: 'var(--color-crop-border)',
      icon: <Sprout size={24} color="var(--color-crop)" />,
      points: [
        'Register harvests with expected harvest dates',
        'AI Sellability Score (%) & shelf-life risk monitor',
        'Fair Price Intelligence band (no distress selling)',
        'Pre-harvest buyer commitments with locked demand'
      ],
      cta: 'Open Farmer Portal'
    },
    {
      id: 'bulk-buyers',
      title: 'Bulk Buyers (HoReCa & Retail)',
      role: '🏢 Institutional Buyers',
      color: '#2563EB',
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE',
      icon: <Building2 size={24} color="#2563EB" />,
      points: [
        'Hotels, restaurants, hostels, supermarkets & canteens',
        'Post bulk requisitions (e.g. 200kg Tomato tomorrow)',
        'Pre-book harvests directly from nearby verified FPOs',
        'Save 12-18% over APMC commission agent quotes'
      ],
      cta: 'Explore Bulk Marketplace'
    },
    {
      id: 'community-orders',
      title: 'Smart Community Buying',
      role: '🛒 Consumers / Societies',
      color: 'var(--color-turmeric)',
      bgColor: 'var(--color-gold-light)',
      borderColor: 'var(--color-gold-border)',
      icon: <Users size={24} color="var(--color-turmeric)" />,
      points: [
        'Aggregates 2kg-5kg consumer orders into 200kg society pools',
        '1 combined delivery per apartment / college campus',
        'Farm-to-Fork QR traceability & zero toxic residues',
        '15-20% discount compared to retail supermarket prices'
      ],
      cta: 'View Community Pools'
    },
    {
      id: 'logistics',
      title: 'Shared Logistics & Vehicles',
      role: '🚚 Fleet Partners',
      color: '#7C3AED',
      bgColor: '#F5F3FF',
      borderColor: '#DDD6FE',
      icon: <Truck size={24} color="#7C3AED" />,
      points: [
        'Shared vehicle dispatch (Tata Ace / Bolero mini-trucks)',
        'Consolidates multi-farmer pickups with buyer fulfillment',
        'Transparent delivery checkpoints & two-sided OTP verification',
        'High vehicle capacity utilization (85-95%)'
      ],
      cta: 'Launch Logistics Hub'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Hero Presentation Banner */}
      <section
        style={{
          background: 'linear-gradient(135deg, #2B1810 0%, #4A2E1B 60%, #1E6B2D 100%)',
          color: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ maxWidth: '840px', position: 'relative', zIndex: 2 }}>
          <h1
            style={{
              fontSize: '2.2rem',
              lineHeight: 1.2,
              fontWeight: 800,
              color: '#FFFFFF',
              marginBottom: '14px'
            }}
          >
            AI-Powered Demand-to-Delivery Agricultural Network
          </h1>

          <p
            style={{
              fontSize: '1.02rem',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '24px'
            }}
          >
            Moving beyond simple e-commerce: <strong className="notranslate" translate="no">AnnDhara</strong> predicts demand before harvest, connects
            farmers & FPOs directly with institutional bulk buyers and apartment community pools,
            optimizes multi-stop shared logistics, and secures transactions with driver-exclusive OTP handoffs.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={() => onNavigate('farmer-hub')}
              style={{
                background: 'var(--color-turmeric)',
                borderColor: 'var(--color-turmeric)',
                padding: '10px 22px',
                fontSize: '0.92rem',
                fontWeight: 700
              }}
            >
              Enter Farmer Portal <ArrowRight size={16} />
            </button>
            <button
              className="btn-secondary"
              onClick={() => onNavigate('demand-forecast')}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                padding: '10px 20px',
                fontSize: '0.92rem'
              }}
            >
              View AI Demand Forecasting
            </button>
            <button
              className="btn-secondary"
              onClick={() => onNavigate('smart-match')}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                padding: '10px 20px',
                fontSize: '0.92rem'
              }}
            >
              <Sparkles size={16} color="var(--color-gold-border)" /> AI Smart Buyer Match
            </button>
          </div>
        </div>
      </section>

      {/* Traditional vs AnnDhara Side-by-Side Comparison */}
      <section>
        <div style={{ marginBottom: '18px' }}>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
            The Core Supply Chain Challenge: Where Does the Money Go?
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            The issue is not just middlemen existing, but <strong>information asymmetry, fragmented orders, and inefficient logistics</strong>.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Traditional Card */}
          <div
            className="nexus-card"
            style={{
              borderLeft: '4px solid var(--color-accent-red)',
              background: '#FFFBFB'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={20} color="var(--color-accent-red)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-accent-red)' }}>
                Current Traditional Supply Chain
              </h3>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Farmer (₹15) → Agent (+₹5) → Trader (+₹8) → Wholesaler (+₹5) → Retailer (+₹12) → <strong>Consumer pays ₹45/kg</strong>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'white',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-red-border)',
                marginBottom: '14px'
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Farmer Share of Consumer Rupee
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-accent-red)' }}>
                  33.3%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Intermediary Markups
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-soil-dark)' }}>
                  +200% Markup
                </div>
              </div>
            </div>

            <ul style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, paddingLeft: '18px' }}>
              <li>Farmer has zero price visibility and dumps produce in distress</li>
              <li>Multiple uncoordinated vehicle trips cause 25-30% food spoilage</li>
              <li>Consumers pay 3× the farmgate price for multi-day aged vegetables</li>
            </ul>
          </div>

          {/* AnnDhara Demand-to-Delivery Card */}
          <div
            className="nexus-card"
            style={{
              borderLeft: '4px solid var(--color-crop)',
              background: '#FBFCFB'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <CheckCircle2 size={20} color="var(--color-crop)" />
              <h3 className="notranslate" translate="no" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-crop)' }}>
                AnnDhara Demand-to-Delivery Network
              </h3>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Farmer / FPO (₹24) → <strong className="notranslate" translate="no">AnnDhara AI Network</strong> (+₹3.5 Logistics + ₹1.5 Fair Fee) → <strong>Buyer pays ₹29/kg</strong>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'white',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-crop-border)',
                marginBottom: '14px'
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Farmer Share of Consumer Rupee
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-crop)' }}>
                  82.8%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Farmer Gain / Consumer Save
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-crop)' }}>
                  +60% Net / -35% Price
                </div>
              </div>
            </div>

            <ul style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, paddingLeft: '18px' }}>
              <li>Demand predicted 7 days ahead; buyers pre-book before harvest</li>
              <li>Consolidated shared vehicle pickups cut 28% distance & fuel cost</li>
              <li>Perishables dynamically routed to food processors before rotting</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Visual System Architecture Diagram */}
      <section className="nexus-card">
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-soil)', textTransform: 'uppercase' }}>
            <Cpu size={14} /> System Architecture & Data Flow
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-soil-dark)', marginTop: '4px' }}>
            Closed-Loop Demand-to-Delivery Intelligence Architecture
          </h2>
        </div>

        <div
          style={{
            background: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            border: '1px solid var(--color-border)'
          }}
        >
          {/* Layer 1: Supply */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-block',
                background: 'var(--color-crop-light)',
                border: '1px solid var(--color-crop-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 24px',
                fontWeight: 700,
                color: 'var(--color-crop)',
                fontSize: '0.9rem'
              }}
            >
              👨🌾 Farmers & FPOs (Supply Registration & Pre-Harvest Commitments)
            </div>
            <div style={{ color: 'var(--color-text-muted)', margin: '6px 0', fontSize: '1.2rem' }}>↓</div>
          </div>

          {/* Layer 2: Platform Core */}
          <div
            style={{
              background: 'white',
              border: '2px solid var(--color-soil)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div className="notranslate" translate="no" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-soil-dark)', marginBottom: '8px' }}>
              🌐 ANNDHARA DIGITAL INTELLIGENCE MARKETPLACE
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', maxWidth: '640px', margin: '0 auto' }}>
              Connects verified farmgate supply with institutional bulk demands and aggregated community society orders.
            </div>

            {/* AI Engine Sub-Box */}
            <div
              style={{
                marginTop: '16px',
                background: 'linear-gradient(135deg, #FEF9E7 0%, #FFF 100%)',
                border: '1px dashed var(--color-turmeric)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '0.76rem', color: 'var(--color-soil-dark)' }}>
                <strong>1. Demand Forecaster</strong><br />
                Prophet 7-Day Day-by-Day Forecast
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--color-soil-dark)' }}>
                <strong>2. Smart Buyer Match</strong><br />
                Multi-Buyer Order Allocator
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--color-soil-dark)' }}>
                <strong>3. Sellability Score</strong><br />
                Perishable Shelf-Life Risk
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--color-soil-dark)' }}>
                <strong>4. CVRP Logistics</strong><br />
                Shared Vehicle Optimization
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--color-soil-dark)' }}>
                <strong>5. Secure Verification</strong><br />
                Two-Sided OTP Handshake
              </div>
            </div>
          </div>

          {/* Layer 3: Downstream Stakeholders */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--color-text-muted)', margin: '6px 0', fontSize: '1.2rem' }}>↓</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: '12px'
              }}
            >
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px', fontSize: '0.82rem', fontWeight: 700, color: '#1E40AF' }}>
                🏢 Bulk Buyers<br /><span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#3B82F6' }}>Hotels, Hostels, Supermarkets</span>
              </div>
              <div style={{ background: '#FEF9E7', border: '1px solid #F9E79F', borderRadius: '8px', padding: '10px', fontSize: '0.82rem', fontWeight: 700, color: '#92400E' }}>
                🛒 Smart Community Pools<br /><span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#B45309' }}>Apartments & Societies (200kg pools)</span>
              </div>
              <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '8px', padding: '10px', fontSize: '0.82rem', fontWeight: 700, color: '#6D28D9' }}>
                🚚 Shared Logistics<br /><span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#7C3AED' }}>Consolidated Multi-Stop Routes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Stakeholder Cards with CTA */}
      <section>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
            The 4 Major Stakeholders
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Select any portal to experience the interactive prototype:
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {stakeholders.map((s) => (
            <div
              key={s.id}
              className="nexus-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderTop: `4px solid ${s.color}`
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: s.bgColor,
                      border: `1px solid ${s.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-soil-dark)' }}>
                      {s.title}
                    </h3>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: s.color }}>
                      {s.role}
                    </span>
                  </div>
                </div>

                <ul style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, paddingLeft: '16px', marginBottom: '20px' }}>
                  {s.points.map((pt, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{pt}</li>
                  ))}
                </ul>
              </div>

              <button
                className="btn-secondary"
                onClick={() => onNavigate(s.id)}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '9px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: s.color,
                  borderColor: s.borderColor,
                  background: s.bgColor
                }}
              >
                {s.cta} <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
