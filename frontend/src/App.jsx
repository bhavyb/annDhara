import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import SystemOverview from './components/SystemOverview.jsx';
import FarmerHub from './components/FarmerHub.jsx';
import MarketplaceModule from './components/MarketplaceModule.jsx';
import DemandForecastHeatmap from './components/DemandForecastHeatmap.jsx';
import SmartMatchingModule from './components/SmartMatchingModule.jsx';
import LogisticsOptimizerModule from './components/LogisticsOptimizerModule.jsx';

// Core Analytical Engines
import FairPriceModule from './components/FairPriceModule.jsx';
import MandiCompareModule from './components/MandiCompareModule.jsx';
import MarkupAnomalyModule from './components/MarkupAnomalyModule.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import StakeholderDashboard from './components/StakeholderDashboard.jsx';

import {
  Sparkles,
  LayoutDashboard,
  Sprout,
  ShoppingBag,
  TrendingUp,
  Flame,
  Truck,
  Award,
  Compass,
  AlertOctagon,
  RefreshCw,
  AlertCircle,
  ChevronDown
} from 'lucide-react';

import { LanguageProvider, useLanguage } from './context/LanguageContext.jsx';

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function AppContent() {
  const { t } = useLanguage();
  const [user, setUser] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('anndhara_user')) || JSON.parse(localStorage.getItem('anndhana_user')) ||
        JSON.parse(localStorage.getItem('nexus_user')) ||
        null
      );
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [statusData, setStatusData] = useState(null);
  const [commodities, setCommodities] = useState([]);
  const [locationsData, setLocationsData] = useState({ states: [], districts: [], markets: [] });
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [backendError, setBackendError] = useState(null);

  // Fetch commodities and server status on mount
  const loadInitialData = async () => {
    setLoadingInitial(true);
    setBackendError(null);

    try {
      // 1. Fetch system status & provenance
      const statusRes = await fetch('/api/status');
      const statusJson = await statusRes.json();
      if (statusJson.success) {
        setStatusData(statusJson.data);
      }

      // 2. Fetch all 185 distinct commodities (from active Agmarknet data)
      const commRes = await fetch('/api/commodities');
      const commJson = await commRes.json();
      if (commJson.success && commJson.commodities.length > 0) {
        setCommodities(commJson.commodities);
      } else {
        setCommodities(['Tomato', 'Onion', 'Potato', 'Wheat', 'Groundnut', 'Cotton']);
      }

      // 3. Fetch all authentic real locations from Agmarknet dataset
      const locRes = await fetch('/api/locations');
      const locJson = await locRes.json();
      if (locJson.success && locJson.data) {
        setLocationsData(locJson.data);
      }
    } catch (err) {
      console.error('Error connecting to backend:', err);
      setBackendError(
        'Cannot connect to the AnnDhara backend server. Please verify Flask is running on port 5000.'
      );
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const primaryTabs = [
    {
      id: 'dashboard',
      label: t('tabDashboard'),
      icon: <LayoutDashboard size={15} />
    },
    {
      id: 'overview',
      label: t('tabOverview'),
      icon: <LayoutDashboard size={15} />
    },
    {
      id: 'farmer-hub',
      label: t('tabFarmerHub'),
      icon: <Sprout size={15} />
    },
    {
      id: 'marketplace',
      label: t('tabMarketplace'),
      icon: <ShoppingBag size={15} />
    },
    {
      id: 'demand-forecast',
      label: t('tabDemandForecast'),
      icon: <TrendingUp size={15} />
    },
    {
      id: 'smart-match',
      label: t('tabSmartMatch'),
      icon: <Sparkles size={15} />
    },
    {
      id: 'logistics',
      label: t('tabLogistics'),
      icon: <Truck size={15} />
    }
  ].filter((tab) => {
    if (tab.id === 'overview') return false;
    if (tab.id === 'farmer-hub') return user?.role === 'farmer';
    if (tab.id === 'marketplace') return user?.role === 'customer' || user?.role === 'farmer';
    if (tab.id === 'logistics') return user?.role === 'logistics';
    if (tab.id === 'demand-forecast') return user?.role === 'farmer';
    if (tab.id === 'smart-match') return user?.role === 'customer' || user?.role === 'farmer';
    return tab.id === 'dashboard';
  });

  const secondaryTools = [
    { id: 'fair-price', label: t('tabFairPrice'), icon: <Sparkles size={14} /> },
    { id: 'mandi-compare', label: t('tabMandiCompare'), icon: <Compass size={14} /> },
    { id: 'markup-anomaly', label: t('tabMarkupAnomaly'), icon: <AlertOctagon size={14} /> }
  ].filter((tool) => user?.role === 'farmer' ? tool.id !== 'markup-anomaly' : user?.role === 'customer' ? tool.id === 'markup-anomaly' : false);

  const handleAuthenticated = (authenticatedUser) => {
    localStorage.setItem('anndhara_user', JSON.stringify(authenticatedUser));
    localStorage.setItem('anndhana_user', JSON.stringify(authenticatedUser));
    localStorage.setItem('nexus_user', JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('anndhara_user');
    localStorage.removeItem('anndhana_user');
    localStorage.removeItem('nexus_user');
    setUser(null);
  };

  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  return (
    <div>
      <Header statusData={statusData} onRefreshSuccess={loadInitialData} user={user} onLogout={handleLogout} />

      <main className="app-container">
        {/* Backend Error Banner */}
        {backendError && (
          <div className="nexus-alert danger" style={{ marginBottom: '16px' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong>Backend Connection Notice: </strong>
              {backendError}
            </div>
            <button
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={loadInitialData}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* Primary Tab Navigation */}
        <nav
          className="module-tabs"
          aria-label="AnnDhara Core Modules"
        >
          {primaryTabs.map((tab) => (
            <button
              key={tab.id}
              className={`module-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Secondary Sub-Bar for Deep Analytics Tools */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-bg-subtle)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 16px',
            marginBottom: '22px',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--color-soil-dark)' }}>
            {t('deepAnalyticsTitle')}
          </span>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {secondaryTools.map((tItem) => (
              <button
                key={tItem.id}
                onClick={() => setActiveTab(tItem.id)}
                style={{
                  background: activeTab === tItem.id ? 'white' : 'transparent',
                  border: activeTab === tItem.id ? '1px solid var(--color-crop-border)' : '1px solid transparent',
                  color: activeTab === tItem.id ? 'var(--color-crop)' : 'var(--color-text-secondary)',
                  fontWeight: activeTab === tItem.id ? 800 : 600,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.74rem'
                }}
              >
                {tItem.icon} {tItem.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loadingInitial ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)'
            }}
          >
            <RefreshCw
              size={32}
              className="spin-icon"
              style={{ margin: '0 auto 16px auto', color: 'var(--color-crop)' }}
            />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-soil-dark)' }}>
              {t('connectingMsg')}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {t('connectingSub')}
            </p>
          </div>
        ) : (
          <div>
            {/* 1. Overview & Pitch */}
            {activeTab === 'dashboard' && (
              <StakeholderDashboard user={user} onNavigate={(target) => setActiveTab(target)} />
            )}

            {activeTab === 'overview' && (
              <SystemOverview onNavigate={(target) => setActiveTab(target)} />
            )}

            {/* 2. Farmer & FPO Portal */}
            {activeTab === 'farmer-hub' && (
              <FarmerHub user={user} commodities={commodities} locationsData={locationsData} />
            )}

            {/* 3. Buyer & Community Marketplace */}
            {activeTab === 'marketplace' && (
              <MarketplaceModule user={user} commodities={commodities} locationsData={locationsData} />
            )}

            {/* 4. Demand Forecasting & Regional Heatmap */}
            {activeTab === 'demand-forecast' && (
              <DemandForecastHeatmap commodities={commodities} locationsData={locationsData} />
            )}

            {/* 5. AI Smart Buyer Matching */}
            {activeTab === 'smart-match' && (
              <SmartMatchingModule
                commodities={commodities}
                locationsData={locationsData}
                onNavigateToLogistics={() => setActiveTab('logistics')}
                user={user}
              />
            )}

            {/* 6. Shared Logistics */}
            {activeTab === 'logistics' && (
              <LogisticsOptimizerModule user={user} />
            )}

            {/* Deep Analytical Tools */}
            {activeTab === 'fair-price' && (
              <FairPriceModule commodities={commodities} initialCrop="Tomato" />
            )}

            {activeTab === 'mandi-compare' && (
              <MandiCompareModule commodities={commodities} initialCrop="Tomato" />
            )}

            {activeTab === 'markup-anomaly' && (
              <MarkupAnomalyModule commodities={commodities} />
            )}
          </div>
        )}

        {/* Footer */}
        <footer
          style={{
            marginTop: '40px',
            borderTop: '1px solid var(--color-border)',
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: 'var(--color-text-muted)',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <strong>{t('brandTitle', 'AnnDhara')}</strong> • {t('footerNetwork')}
          </div>
          <div>{t('footerSub')}</div>
        </footer>
      </main>
    </div>
  );
}
