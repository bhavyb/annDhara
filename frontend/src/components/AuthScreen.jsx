import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, MapPin, Sprout } from 'lucide-react';

const roles = [
  { id: 'farmer', label: 'Farmer / FPO', description: 'List harvests, see demand and receive orders' },
  { id: 'customer', label: 'Customer / Buyer', description: 'Source fresh produce and place group orders' },
  { id: 'logistics', label: 'Logistics Partner', description: 'Manage vehicles and delivery assignments' }
];

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('farmer');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', location: '', organization: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Please try again');
      if (mode === 'login' && data.user.role !== role) {
        throw new Error(`This account is registered as ${roles.find((item) => item.id === data.user.role)?.label || data.user.role}. Select that role to continue.`);
      }
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message || 'Could not connect to AnnDhara');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div className="brand-icon"><Sprout size={28} /></div>
          <div>
            <span className="eyebrow notranslate" translate="no" style={{ display: 'block' }}>ANNDHARA FARM-TO-MARKET NETWORK</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--palette-forest)' }}>Direct Mandi & Logistics Grid</span>
          </div>
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 3.8vw, 3rem)', lineHeight: 1.1, margin: '8px 0 14px 0', color: 'var(--palette-forest)', fontWeight: 800 }}>
          One clear dashboard for every hand in the supply chain.
        </h1>

        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.96rem', marginBottom: '18px', lineHeight: 1.5 }}>
          Connect farms, buyers and reliable transport with fair prices, demand intelligence and transparent delivery.
        </p>

        {/* VISUAL HERO SHOWCASE CARD WITH REAL PHOTOGRAPHY */}
        <div
          style={{
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
            background: 'white',
            marginBottom: '20px'
          }}
        >
          <div style={{ position: 'relative', height: '190px', overflow: 'hidden' }}>
            <img
              src="/images/hero_farm.jpg"
              alt="Lush Indian Agricultural Farmland"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80';
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(40, 54, 24, 0.88) 0%, rgba(40, 54, 24, 0.25) 60%, transparent 100%)'
              }}
            />
            <div style={{ position: 'absolute', bottom: '12px', left: '16px', right: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: '#FEFAE0' }}>
              <div>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#DDA15E', fontWeight: 800 }}>Direct Farmgate Network</span>
                <h4 style={{ fontSize: '1.05rem', margin: '2px 0 0 0', fontWeight: 800, color: '#FEFAE0' }}>Gujarat Agro & Saurashtra Producers</h4>
              </div>
              <span style={{ background: 'rgba(254, 250, 224, 0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(254, 250, 224, 0.35)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, color: '#FEFAE0' }}>
                ✓ Live Network
              </span>
            </div>
          </div>

          {/* Live Crop Mini Thumbs */}
          <div style={{ padding: '12px 16px', background: 'var(--color-bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img
                src="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=120&q=80"
                alt="Tomato"
                title="Fresh Tomato"
                onError={(e) => { e.target.style.display = 'none'; }}
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
              />
              <img
                src="https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=120&q=80"
                alt="Onion"
                title="Fresh Onion"
                onError={(e) => { e.target.style.display = 'none'; }}
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
              />
              <img
                src="https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=120&q=80"
                alt="Wheat"
                title="Golden Wheat"
                onError={(e) => { e.target.style.display = 'none'; }}
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--palette-forest)', fontWeight: 800 }}>Live Fresh Produce</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--palette-terracotta)', background: 'white', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
              ₹0 Middleman Margin
            </span>
          </div>
        </div>

        <div className="auth-benefits">
          <span><ArrowRight size={15} color="var(--palette-moss)" /> Direct farmer-to-buyer connections</span>
          <span><ArrowRight size={15} color="var(--palette-moss)" /> AI demand and route insights</span>
          <span><ArrowRight size={15} color="var(--palette-moss)" /> Track every order from source to doorstep</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-switch">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
        </div>
        <div className="auth-heading">
          <h2>{mode === 'login' ? 'Welcome back' : 'Join AnnDhara'}</h2>
          <p>{mode === 'login' ? 'Sign in to your stakeholder workspace.' : 'Choose your role to get a workspace built for you.'}</p>
        </div>
        <div className="role-picker">
          <p className="input-label">{mode === 'login' ? 'Sign in as' : 'I am a'}</p>
          {roles.map((item) => (
            <button key={item.id} type="button" className={role === item.id ? 'selected' : ''} onClick={() => setRole(item.id)}>
              <strong>{item.label}</strong><small>{item.description}</small>
            </button>
          ))}
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && <label className="input-group"><span className="input-label">Full name</span><input className="nexus-input" required value={form.name} onChange={update('name')} placeholder="Your name or FPO lead" /></label>}
          <label className="input-group"><span className="input-label"><Mail size={14} /> Email address</span><input className="nexus-input" type="email" required value={form.email} onChange={update('email')} placeholder="you@example.com" /></label>
          <label className="input-group"><span className="input-label"><LockKeyhole size={14} /> Password</span><span className="password-field"><input className="nexus-input" type={showPassword ? 'text' : 'password'} minLength={8} required value={form.password} onChange={update('password')} placeholder="Minimum 8 characters" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label="Show password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          {mode === 'register' && <>
            <label className="input-group"><span className="input-label">Phone number</span><input className="nexus-input" value={form.phone} onChange={update('phone')} placeholder="+91 98765 43210" /></label>
            <label className="input-group"><span className="input-label"><MapPin size={14} /> Base location</span><input className="nexus-input" value={form.location} onChange={update('location')} placeholder="City, state" /></label>
            {(role === 'farmer' || role === 'logistics') && <label className="input-group"><span className="input-label">{role === 'farmer' ? 'FPO / farm name (optional)' : 'Company name (optional)'}</span><input className="nexus-input" value={form.organization} onChange={update('organization')} /></label>}
          </>}
          {error && <div className="nexus-alert danger auth-error">{error}</div>}
          <button className="btn-primary auth-submit" disabled={submitting}>{submitting ? 'Please wait...' : mode === 'login' ? 'Enter my dashboard' : 'Create my account'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-note">Your password is securely hashed and never stored in plain text.</p>
      </section>
    </main>
  );
}
