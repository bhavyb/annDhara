import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Calendar,
  Layers,
  Info,
  CheckCircle,
  RefreshCw,
  Search,
  Check,
  ChevronDown,
  X,
  MapPin
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { getCropDisplayName } from '../utils/cropTranslations';

export default function FairPriceModule({ commodities, initialCrop }) {
  const [selectedCrop, setSelectedCrop] = useState(initialCrop || 'Onion');
  const [mandisList, setMandisList] = useState([]);
  const [selectedMandi, setSelectedMandi] = useState('');
  const [loadingMandis, setLoadingMandis] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [error, setError] = useState(null);

  // Searchable combobox dropdown state
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const comboboxRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch forecast function
  const fetchForecastFor = (crop, mandi, retrain = false) => {
    if (!crop || !mandi) return;
    setLoadingForecast(true);
    setError(null);

    const url = `/api/fair-price?crop=${encodeURIComponent(crop)}&mandi=${encodeURIComponent(
      mandi
    )}${retrain ? '&retrain=true' : ''}`;

    fetch(url)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setForecastData(res.data);
        } else {
          setError(res.error || 'Failed to forecast fair price');
        }
      })
      .catch(() => setError('Could not connect to forecasting service'))
      .finally(() => setLoadingForecast(false));
  };

  // Coordinated crop change: fetch comprehensive mandis and immediately forecast for the new crop
  useEffect(() => {
    if (!selectedCrop) return;
    setLoadingMandis(true);
    setError(null);

    fetch(`/api/mandis?commodity=${encodeURIComponent(selectedCrop)}&all=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.mandis.length > 0) {
          setMandisList(data.mandis);

          // Check if currently selected mandi has live data for this new crop
          const existingMatch = data.mandis.find(
            (m) => m.market === selectedMandi && m.has_crop_data
          );
          // If not, pick the first mandi that has recorded arrival data for this crop
          const firstWithData = data.mandis.find((m) => m.has_crop_data);
          const targetMandi = existingMatch
            ? existingMatch.market
            : firstWithData
            ? firstWithData.market
            : data.mandis[0].market;

          setSelectedMandi(targetMandi);
          // Fetch forecast directly for the resolved crop and mandi pair
          fetchForecastFor(selectedCrop, targetMandi, false);
        } else {
          setMandisList([]);
          setSelectedMandi('');
          setForecastData(null);
        }
      })
      .catch(() => setError('Failed to load mandis directory'))
      .finally(() => setLoadingMandis(false));
  }, [selectedCrop]);

  // Handle user selecting a new mandi from the dropdown
  const handleSelectMandi = (mandiName) => {
    setSelectedMandi(mandiName);
    setIsDropdownOpen(false);
    setSearchQuery('');
    fetchForecastFor(selectedCrop, mandiName, false);
  };

  // Filter mandis based on search query across Market, District, and State
  const filteredMandis = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return mandisList;
    return mandisList.filter((m) => {
      const marketMatch = m.market.toLowerCase().includes(q);
      const districtMatch = m.district ? m.district.toLowerCase().includes(q) : false;
      const stateMatch = m.state ? m.state.toLowerCase().includes(q) : false;
      return marketMatch || districtMatch || stateMatch;
    });
  }, [mandisList, searchQuery]);

  // Combine historical and 7-day forecast points for the chart
  const getChartSeries = () => {
    if (!forecastData) return [];
    const hist = (forecastData.historical_points || []).map((p) => ({
      date: p.display_date,
      actualPrice: p.actual_price_kg,
      fairForecast: null,
      bandLower: null,
      bandUpper: null,
      isHistorical: true
    }));

    const lastHist = hist[hist.length - 1];

    const forecast = (forecastData.forecast_7_days || []).map((f) => ({
      date: f.display_date,
      actualPrice: null,
      fairForecast: f.predicted_price_kg,
      bandLower: f.lower_band_kg,
      bandUpper: f.upper_band_kg,
      isForecast: true
    }));

    if (lastHist && forecast.length > 0) {
      forecast[0].actualPrice = lastHist.actualPrice;
    }

    return [...hist, ...forecast];
  };

  const chartData = getChartSeries();
  const bandKg = forecastData?.fair_price_band_kg;
  const trend = forecastData?.trend_summary;
  const isFallback = forecastData?.is_fallback || forecastData?.model_engine === 'Prototype/Fallback Data';
  const engineName = forecastData?.model_engine || 'Facebook Prophet';

  // Find object of selected mandi for rich header display
  const currentMandiObj = mandisList.find((m) => m.market === selectedMandi);

  return (
    <div className="nexus-card">
      <div className="card-header-bar">
        <div className="card-title-group">
          <div className="card-icon-pill">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="card-title">Module 1: Fair Price Predictor</h2>
            <p className="card-subtitle">
              Time-series AI forecasting (Facebook Prophet) predicting next 7 days' fair price band
            </p>
          </div>
        </div>

        {forecastData?.model_engine && (
          <div
            className="data-status-pill"
            style={{
              background: isFallback ? '#FEF3C7' : '#DCFCE7',
              color: isFallback ? '#92400E' : '#166534',
              borderColor: isFallback ? '#FDE68A' : '#BBF7D0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: 600,
              fontSize: '0.8rem'
            }}
          >
            {isFallback ? <Info size={14} /> : <Sparkles size={14} />}
            <span>
              Engine: <strong>{engineName}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Dynamic Dropdowns & Searchable Combobox */}
      <div className="form-grid">
        {/* Commodity Selector */}
        <div className="input-group">
          <label className="input-label" htmlFor="crop-select">
            Select Agricultural Commodity
          </label>
          <select
            id="crop-select"
            className="nexus-select"
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
          >
            {commodities.map((c) => (
              <option key={c} value={c}>
                {getCropDisplayName(c)}
              </option>
            ))}
          </select>
        </div>

        {/* Searchable Mandi / APMC Combobox */}
        <div className="input-group" ref={comboboxRef} style={{ position: 'relative' }}>
          <label className="input-label" htmlFor="mandi-combobox">
            Select Mandi / Market {loadingMandis && '(Loading Directory...)'}
          </label>

          {/* Combobox Trigger Field */}
          <div
            id="mandi-combobox"
            className="nexus-select"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              background: '#FFFFFF',
              userSelect: 'none'
            }}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <MapPin size={16} color="var(--color-crop)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: 'var(--color-soil-dark)' }}>
                {currentMandiObj ? (
                  <>
                    {currentMandiObj.market}{' '}
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>
                      ({currentMandiObj.district ? `${currentMandiObj.district}, ` : ''}{currentMandiObj.state})
                    </span>
                  </>
                ) : selectedMandi ? (
                  selectedMandi
                ) : (
                  'Select a mandi...'
                )}
              </span>
            </div>
            <ChevronDown size={16} color="var(--color-text-secondary)" style={{ flexShrink: 0, transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>

          {/* Searchable Dropdown Menu */}
          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.12)',
                border: '1px solid var(--color-border)',
                marginTop: '4px',
                overflow: 'hidden'
              }}
            >
              {/* Search Bar Input */}
              <div
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--color-border)',
                  background: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Search size={15} color="var(--color-text-secondary)" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by mandi name, district, or state..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '0.85rem',
                    color: 'var(--color-soil-dark)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                {searchQuery && (
                  <X
                    size={14}
                    color="var(--color-text-muted)"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                    }}
                  />
                )}
              </div>

              {/* Scrollable Mandi List */}
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {filteredMandis.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    No APMCs found matching "{searchQuery}"
                  </div>
                ) : (
                  filteredMandis.map((m) => {
                    const isSelected = m.market === selectedMandi;
                    return (
                      <div
                        key={m.market}
                        onClick={() => handleSelectMandi(m.market)}
                        style={{
                          padding: '8px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--color-crop-light)' : 'transparent',
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-crop)' : 'var(--color-soil-dark)' }}>
                            {m.market}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                            {m.district ? `${m.district}, ` : ''}{m.state}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {m.has_crop_data ? (
                            <span
                              style={{
                                background: '#DCFCE7',
                                color: '#166534',
                                fontSize: '0.68rem',
                                padding: '2px 7px',
                                borderRadius: '10px',
                                fontWeight: 600
                              }}
                            >
                              ✓ Live Agmarknet
                            </span>
                          ) : (
                            <span
                              style={{
                                background: '#F1F5F9',
                                color: '#64748B',
                                fontSize: '0.68rem',
                                padding: '2px 7px',
                                borderRadius: '10px'
                              }}
                            >
                              APMC
                            </span>
                          )}
                          {isSelected && <Check size={14} color="var(--color-crop)" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="nexus-alert danger" style={{ marginTop: '14px' }}>
          <Info size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Prototype / Fallback Data Banner */}
      {!loadingForecast && isFallback && (
        <div
          className="nexus-alert warning"
          style={{
            marginTop: '16px',
            marginBottom: '4px',
            background: '#FFFBEB',
            borderColor: '#FDE68A',
            color: '#92400E',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <Info size={18} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.84rem' }}>
            <strong>Prototype / Fallback Data: </strong>
            {forecastData?.fallback_notice ||
              `Historical Agmarknet arrival records are unavailable for ${selectedCrop} at ${selectedMandi}. Displaying regional prototype baseline estimate.`}
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {loadingForecast && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-soil)' }}>
          <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 12px auto' }} />
          <p style={{ fontWeight: 600 }}>Training Facebook Prophet Model & Forecasting Fair Price...</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Fitting time-series model on arrival price history for {selectedCrop} at {selectedMandi}
          </span>
        </div>
      )}

      {/* Forecast Results Dashboard */}
      {!loadingForecast && forecastData && (
        <div>
          {/* Fair Price Band Banner */}
          <div className="band-banner">
            <div className="band-stat-group">
              <div className="band-stat">
                <span className="band-stat-label">Today's Reported Modal</span>
                <span className="band-stat-value">
                  ₹{forecastData.current_modal_price_kg}{' '}
                  <span style={{ fontSize: '1rem', fontWeight: 500 }}>/kg</span>
                </span>
                <span className="band-stat-sub">
                  ₹{forecastData.current_modal_price_quintal} / quintal
                </span>
              </div>

              <div className="band-stat">
                <span className="band-stat-label">AI Fair Price Band (7-Day Target)</span>
                <span className="band-stat-value" style={{ color: '#FDE68A' }}>
                  ₹{bandKg?.min} – ₹{bandKg?.max}{' '}
                  <span style={{ fontSize: '1rem', fontWeight: 500 }}>/kg</span>
                </span>
                <span className="band-stat-sub">
                  Recommended Fair Benchmark: ₹{bandKg?.fair} / kg
                </span>
              </div>
            </div>

            <div>
              <div
                className={`trend-badge-pill ${
                  trend?.direction.includes('Rising')
                    ? 'rising'
                    : trend?.direction.includes('Softening')
                    ? 'falling'
                    : 'stable'
                }`}
              >
                {trend?.direction.includes('Rising') && <TrendingUp size={16} />}
                {trend?.direction.includes('Softening') && <TrendingDown size={16} />}
                {trend?.direction.includes('Stable') && <Minus size={16} />}
                <span>
                  {trend?.direction} ({trend?.change_pct > 0 ? '+' : ''}
                  {trend?.change_pct}%)
                </span>
              </div>
            </div>
          </div>

          {/* Actionable Selling Recommendation */}
          <div className="nexus-alert success" style={{ marginBottom: '24px' }}>
            <CheckCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Farmer Selling Guidance: </strong>
              {trend?.recommendation}
            </div>
          </div>

          {/* 7-Day Trend Chart */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-soil)' }}>
                14-Day Price History & 7-Day Prophet Forward Forecast
              </h3>
              <button
                className="refresh-btn"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => fetchForecastFor(selectedCrop, selectedMandi, true)}
                title="Force retrain model on latest records"
              >
                <RefreshCw size={12} /> Retrain Model
              </button>
            </div>

            <div style={{ height: 320, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fairColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D9822B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#D9822B" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="actualColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E6B2D" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#1E6B2D" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E0D3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#78716C' }} />
                  <YAxis
                    unit=" ₹"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 12, fill: '#78716C' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div
                            style={{
                              background: 'white',
                              padding: '10px 14px',
                              border: '1px solid #E7E0D3',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              fontSize: '0.85rem'
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Date: {label}</div>
                            {data.actualPrice !== null && (
                              <div style={{ color: '#1E6B2D' }}>
                                Actual Modal Price: <strong>₹{data.actualPrice} / kg</strong>
                              </div>
                            )}
                            {data.fairForecast !== null && (
                              <>
                                <div style={{ color: '#D9822B' }}>
                                  Prophet Fair Forecast: <strong>₹{data.fairForecast} / kg</strong>
                                </div>
                                <div style={{ color: '#78716C', fontSize: '0.75rem' }}>
                                  Confidence Band: ₹{data.bandLower} – ₹{data.bandUpper} / kg
                                </div>
                              </>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area
                    type="monotone"
                    dataKey="actualPrice"
                    name="Actual Mandi Arrival (₹/kg)"
                    stroke="#1E6B2D"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#actualColor)"
                  />
                  <Area
                    type="monotone"
                    dataKey="fairForecast"
                    name="Prophet 7-Day Forecast (₹/kg)"
                    stroke="#D9822B"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#fairColor)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
