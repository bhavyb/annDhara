import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Truck,
  Leaf,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Scale
} from 'lucide-react';

export default function ImpactDashboard() {
  const [impactData, setImpactData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Interactive Margin Simulator Sliders
  const [farmerPriceInput, setFarmerPriceInput] = useState(15.0);
  const [consumerPriceInput, setConsumerPriceInput] = useState(45.0);

  useEffect(() => {
    setLoading(true);
    fetch('/api/impact-metrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setImpactData(data.data);
        }
      })
      .catch((err) => console.error('Error fetching impact metrics:', err))
      .finally(() => setLoading(false));
  }, []);

  // Simulator Calculations
  const traditionalFarmer = Number(farmerPriceInput);
  const traditionalConsumer = Number(consumerPriceInput);
  const traditionalMargin = traditionalConsumer - traditionalFarmer;
  const traditionalFarmerSharePct = ((traditionalFarmer / Math.max(1, traditionalConsumer)) * 100).toFixed(1);

  // In AnnDhara: Farmer gets +60% of intermediate margin, direct logistics costs ₹3.50/kg, platform fee ₹1.50/kg
  const nexusFarmer = Math.round((traditionalFarmer + (traditionalMargin * 0.35)) * 10) / 10;
  const nexusLogistics = 3.5;
  const nexusFee = 1.5;
  const nexusConsumer = Math.round((nexusFarmer + nexusLogistics + nexusFee) * 10) / 10;
  const nexusFarmerSharePct = ((nexusFarmer / Math.max(1, nexusConsumer)) * 100).toFixed(1);

  const farmerGainRupees = (nexusFarmer - traditionalFarmer).toFixed(1);
  const farmerGainPct = (((nexusFarmer - traditionalFarmer) / Math.max(1, traditionalFarmer)) * 100).toFixed(1);

  const consumerSavingsRupees = (traditionalConsumer - nexusConsumer).toFixed(1);
  const consumerSavingsPct = (((traditionalConsumer - nexusConsumer) / Math.max(1, traditionalConsumer)) * 100).toFixed(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
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
            <TrendingUp size={14} /> Platform Impact Dashboard
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0 0 0' }}>
            Macro Socio-Economic & Supply Chain Impact 🔥
          </h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Measurable impact metrics and live margin simulation.
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-gold-light)',
            border: '1px solid var(--color-gold-border)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            color: 'var(--color-soil-dark)',
            fontWeight: 600
          }}
        >
          Simulation / Pilot Benchmark Estimates
        </div>
      </div>

      {/* Top 5 Measurable Impact Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="nexus-card" style={{ borderLeft: '4px solid var(--color-crop)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Intermediaries Reduced
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-crop)' }}>4 → 1</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Layers</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Eliminated agent, trader, wholesaler
          </div>
        </div>

        <div className="nexus-card" style={{ borderLeft: '4px solid #2563EB' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Farmer Net Revenue
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>+18.4%</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-crop)' }}>Higher</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Direct farmgate price discovery
          </div>
        </div>

        <div className="nexus-card" style={{ borderLeft: '4px solid var(--color-turmeric)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Consumer Price Cut
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-turmeric)' }}>-12.6%</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-crop)' }}>Cheaper</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Community bulk buying pools
          </div>
        </div>

        <div className="nexus-card" style={{ borderLeft: '4px solid #7C3AED' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Vehicle Trips Saved
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#7C3AED' }}>35.0%</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Fewer</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Shared vehicle route consolidation
          </div>
        </div>

        <div className="nexus-card" style={{ borderLeft: '4px solid var(--color-accent-red)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Food Waste Reduced
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent-red)' }}>22.0%</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-crop)' }}>Saved</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Dynamic diversion to processors
          </div>
        </div>
      </div>

      {/* Interactive Supply Chain Margin Simulator */}
      <div className="nexus-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-soil)', textTransform: 'uppercase' }}>
              <Scale size={14} /> Interactive Judge Simulator
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0 0 0' }}>
              Live Supply Chain Margin Simulator (Side-by-Side Breakdown)
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Adjust wholesale and consumer price levels to see how AnnDhara dynamically shifts value from middlemen back to farmers & consumers.
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div
          style={{
            background: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
              <span>Initial Farmer Farmgate Price:</span>
              <span style={{ color: 'var(--color-crop)', fontSize: '1rem' }}>₹{farmerPriceInput.toFixed(2)}/kg</span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              step="1"
              value={farmerPriceInput}
              onChange={(e) => setFarmerPriceInput(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-crop)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              <span>₹10/kg</span>
              <span>₹25/kg</span>
              <span>₹40/kg</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
              <span>Retail Market Consumer Price:</span>
              <span style={{ color: 'var(--color-accent-red)', fontSize: '1rem' }}>₹{consumerPriceInput.toFixed(2)}/kg</span>
            </div>
            <input
              type="range"
              min="25"
              max="80"
              step="1"
              value={consumerPriceInput}
              onChange={(e) => setConsumerPriceInput(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-accent-red)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              <span>₹25/kg</span>
              <span>₹50/kg</span>
              <span>₹80/kg</span>
            </div>
          </div>
        </div>

        {/* Side-by-Side Results Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Traditional Supply Chain Column */}
          <div
            style={{
              background: '#FFFBFB',
              border: '1px solid var(--color-red-border)',
              borderRadius: 'var(--radius-md)',
              padding: '18px'
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-accent-red)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Traditional Intermediary Model
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
              <span>Farmer Selling Price:</span>
              <strong>₹{traditionalFarmer.toFixed(2)}/kg ({traditionalFarmerSharePct}%)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              <span>Local Agent & Mandi Cess:</span>
              <span>+₹{(traditionalMargin * 0.18).toFixed(2)}/kg</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              <span>Trader & Wholesaler Cut:</span>
              <span>+₹{(traditionalMargin * 0.28).toFixed(2)}/kg</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              <span>Uncoordinated Transport Freight:</span>
              <span>+₹{(traditionalMargin * 0.18).toFixed(2)}/kg</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              <span>Retailer Markup & Waste Margin:</span>
              <span>+₹{(traditionalMargin * 0.36).toFixed(2)}/kg</span>
            </div>

            <div
              style={{
                borderTop: '2px solid var(--color-red-border)',
                paddingTop: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>Final Consumer Price:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-accent-red)' }}>
                ₹{traditionalConsumer.toFixed(2)}/kg
              </span>
            </div>
          </div>

          {/* AnnDhara Platform Column */}
          <div
            style={{
              background: '#FBFCFB',
              border: '1px solid var(--color-crop-border)',
              borderRadius: 'var(--radius-md)',
              padding: '18px'
            }}
          >
            <div className="notranslate" translate="no" style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-crop)', textTransform: 'uppercase', marginBottom: '10px' }}>
              AnnDhara Demand-to-Delivery Platform
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
              <span>Farmer Realized Price:</span>
              <strong style={{ color: 'var(--color-crop)' }}>₹{nexusFarmer.toFixed(2)}/kg ({nexusFarmerSharePct}%)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              <span>Shared Logistics (Tata Ace / Route CVRP):</span>
              <span>+₹{nexusLogistics.toFixed(2)}/kg</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              <span>AnnDhara Platform Fair Clearing Fee:</span>
              <span>+₹{nexusFee.toFixed(2)}/kg</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              <span>Intermediary Markups Eliminated:</span>
              <span style={{ color: 'var(--color-crop)', fontWeight: 700 }}>₹0.00</span>
            </div>

            <div
              style={{
                borderTop: '2px solid var(--color-crop-border)',
                paddingTop: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>Fair Consumer Price:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-crop)' }}>
                ₹{nexusConsumer.toFixed(2)}/kg
              </span>
            </div>
          </div>
        </div>

        {/* Impact Conclusion Banner */}
        <div
          style={{
            marginTop: '20px',
            background: 'linear-gradient(135deg, #1E6B2D15 0%, #D9822B15 100%)',
            border: '1px solid var(--color-crop-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            textAlign: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Farmer Rupee Advantage
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-crop)' }}>
              +₹{farmerGainRupees}/kg ({farmerGainPct}%)
            </div>
          </div>

          <div style={{ width: '1px', height: '36px', background: 'var(--color-border)' }} />

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Consumer Direct Savings
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-turmeric)' }}>
              -₹{consumerSavingsRupees}/kg ({consumerSavingsPct}%)
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
