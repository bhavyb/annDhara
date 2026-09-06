import React, { useState, useRef, useEffect } from 'react';
import { Sprout, RefreshCw, Database, AlertCircle, CheckCircle2, SlidersHorizontal, Globe, ChevronDown } from 'lucide-react';
import DatasetManagerModal from './DatasetManagerModal.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Header({ statusData, onRefreshSuccess, user, onLogout }) {
  const { currentLanguage, setLanguage, t, languages } = useLanguage();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [refreshToast, setRefreshToast] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    setRefreshToast(null);
    try {
      const res = await fetch('/api/refresh-data?mode=sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setRefreshToast(data.message || 'Live Agmarknet market rates refreshed for today!');
        if (onRefreshSuccess) onRefreshSuccess();
        setTimeout(() => setRefreshToast(null), 4000);
      } else {
        setRefreshError(data.error || 'Refresh failed');
        setTimeout(() => setRefreshError(null), 5000);
      }
    } catch (err) {
      setRefreshError('Could not connect to backend server');
      setTimeout(() => setRefreshError(null), 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isLive = statusData?.is_live ?? false;
  const lastUpdated = statusData?.last_updated
    ? new Date(statusData.last_updated).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
    : t('synchronizing');

  const activeLangObj = languages.find(l => l.code === currentLanguage) || languages[0];
  const [langSearch, setLangSearch] = useState('');

  const filteredLanguages = (languages || []).filter((l) => {
    if (!langSearch.trim()) return true;
    const q = langSearch.toLowerCase();
    return (
      (l.label && l.label.toLowerCase().includes(q)) ||
      (l.englishLabel && l.englishLabel.toLowerCase().includes(q)) ||
      (l.state && l.state.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand-section">
            <div className="brand-icon">
              <Sprout size={26} strokeWidth={2.4} />
            </div>
            <div>
              <div className="brand-title notranslate" translate="no">
                {t('brandTitle', 'AnnDhara')}
              </div>
              <div className="brand-tagline">
                {t('brandTagline')}
              </div>
            </div>
          </div>

          <div className="header-controls">
            <button
              className="refresh-btn"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Synchronize live Agmarknet market rates for today"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
              <span>{isRefreshing ? t('synchronizing') : t('refreshData')}</span>
            </button>

            {user && (
              <div className="user-menu">
                <div className="user-avatar">{(user?.name || user?.email || 'U').charAt(0).toUpperCase()}</div>
                <div className="user-identity">
                  <strong>{user?.name || user?.email || 'User'}</strong>
                  <span>
                    {user.role === 'customer'
                      ? 'Customer / Buyer'
                      : user.role === 'logistics'
                        ? 'Logistics Partner'
                        : 'Farmer / FPO'}
                  </span>
                </div>
                <button className="logout-btn" onClick={onLogout}>
                  {t('signOut')}
                </button>
              </div>
            )}

            {/* Language Switcher Dropdown (Right side) */}
            <div className="lang-switcher-wrapper" ref={langMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="lang-select-btn"
                onClick={() => setIsLangMenuOpen((prev) => !prev)}
                title={t('selectLanguage')}
                aria-expanded={isLangMenuOpen}
              >
                <Globe size={14} />
                <span>{activeLangObj.flag} {activeLangObj.label}</span>
                <ChevronDown size={12} className={`lang-chevron ${isLangMenuOpen ? 'open' : ''}`} />
              </button>

              {isLangMenuOpen && (
                <div className="lang-dropdown-menu">
                  <input
                    type="text"
                    className="lang-search-box"
                    placeholder="Search state or language..."
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {filteredLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        className={`lang-option-item ${currentLanguage === lang.code ? 'active' : ''}`}
                        onClick={() => {
                          setLanguage(lang.code);
                          setIsLangMenuOpen(false);
                          setLangSearch('');
                        }}
                      >
                        <span className="lang-flag">{lang.flag}</span>
                        <div className="lang-info-block">
                          <span className="lang-label">
                            {lang.label} {lang.englishLabel && lang.englishLabel !== lang.label ? `(${lang.englishLabel})` : ''}
                          </span>
                          <span className="lang-state-tag">{lang.state}</span>
                        </div>
                        {currentLanguage === lang.code && <span className="lang-check">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Toast for Refresh and Status Feedback */}
        {refreshToast && (
          <div className="header-toast-notification toast-success">
            <CheckCircle2 size={16} />
            <span>{refreshToast}</span>
          </div>
        )}
        {refreshError && (
          <div className="header-toast-notification toast-error">
            <AlertCircle size={16} />
            <span>{refreshError}</span>
          </div>
        )}
      </header>

      {/* Dataset Manager Modal */}
      <DatasetManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        statusData={statusData}
        onDataUpdated={() => {
          if (onRefreshSuccess) onRefreshSuccess();
        }}
      />
    </>
  );
}
