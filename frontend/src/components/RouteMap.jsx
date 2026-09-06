import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCcw,
  CheckCircle2,
  Clock,
  Truck,
  Sprout,
  ShoppingBag,
  Info
} from 'lucide-react';

// Custom SVG Icons for Leaflet
function createCustomIcon(type, number, isVerified) {
  let bgColor = '#2563EB';
  let badgeText = number || '1';
  let iconSvg = '';

  if (type === 'ORIGIN') {
    bgColor = '#4F46E5'; // Indigo
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5"></circle>
        <circle cx="18.5" cy="18.5" r="2.5"></circle>
      </svg>
    `;
  } else if (type === 'PICKUP') {
    bgColor = isVerified ? '#15803D' : '#16A34A'; // Emerald Green
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 20h10"></path>
        <path d="M10 20c0-4.4 3.6-8 8-8"></path>
        <path d="M4 20c0-6.6 5.4-12 12-12"></path>
        <path d="M12 4v4"></path>
      </svg>
    `;
  } else {
    bgColor = isVerified ? '#15803D' : '#EA580C'; // Amber / Orange
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <path d="M16 10a4 4 0 0 1-8 0"></path>
      </svg>
    `;
  }

  const html = `
    <div style="
      position: relative;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${bgColor};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      cursor: pointer;
      transition: transform 0.2s ease;
    ">
      ${iconSvg}
      <span style="
        position: absolute;
        top: -6px;
        right: -6px;
        background: #111827;
        color: white;
        font-size: 10px;
        font-weight: 800;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 2px solid white;
      ">${badgeText}</span>
      ${type === 'ORIGIN' ? `
        <span style="
          position: absolute;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2px solid ${bgColor};
          animation: mapPulse 2s infinite ease-out;
          pointer-events: none;
        "></span>
      ` : ''}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-map-marker',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20]
  });
}

export default function RouteMap({
  routeData,
  height = '420px',
  title = 'AI Optimized Route & GPS Road Geometry',
  showSummaryHeader = true,
  interactive = true
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const polylineLayerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedStop, setSelectedStop] = useState(null);

  const stops = routeData?.route_stops || routeData?.route_sequence || [];
  const pathCoords = routeData?.path_coordinates || [];
  const navUrl = routeData?.navigation_url;
  const totalKm = routeData?.total_distance_km || routeData?.metrics?.optimized_route_distance_km || 0;
  const etaMins = routeData?.eta_minutes || Math.max(15, Math.round((totalKm / 35.0) * 60));

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultCenter = [23.0225, 72.5714];
    const initialZoom = 11;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: initialZoom,
      zoomControl: interactive,
      scrollWheelZoom: interactive ? 'center' : false,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markersLayerRef.current = L.featureGroup().addTo(map);
    polylineLayerRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !polylineLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    polylineLayerRef.current.clearLayers();

    const validStops = stops.filter(
      (s) => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng) && s.lat !== 0 && s.lng !== 0
    );

    if (validStops.length === 0) return;

    validStops.forEach((stop, idx) => {
      const stepNumber = stop.step || idx + 1;
      const isVerified = Boolean(stop.otp_verified);
      const icon = createCustomIcon(stop.type, stepNumber, isVerified);

      const marker = L.marker([stop.lat, stop.lng], { icon });

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4; min-width: 200px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="
              background: ${stop.type === 'ORIGIN' ? '#4F46E5' : stop.type === 'PICKUP' ? '#16A34A' : '#EA580C'};
              color: white;
              font-size: 10px;
              font-weight: 800;
              padding: 2px 8px;
              border-radius: 9999px;
              text-transform: uppercase;
            ">
              Stop ${stepNumber}: ${stop.type}
            </span>
            ${isVerified ? '<span style="color: #16A34A; font-weight: 700; font-size: 11px;">✓ Verified</span>' : '<span style="color: #F59E0B; font-weight: 700; font-size: 11px;">⏳ Pending</span>'}
          </div>
          <strong style="font-size: 14px; color: #111827; display: block; margin-bottom: 4px;">
            ${stop.title || stop.entity || stop.stakeholder_label || 'Waypoint'}
          </strong>
          <div style="color: #4B5563; margin-bottom: 6px; font-size: 12px;">
            📍 ${stop.location || 'Location designated'}
          </div>
          <div style="background: #F3F4F6; padding: 6px 8px; border-radius: 6px; margin-bottom: 6px;">
            <strong>Action:</strong> ${stop.action || 'Produce Transfer'}
          </div>
          ${stop.phone ? `<div style="color: #2563EB; font-size: 12px; font-weight: 600;">📞 <a href="tel:${stop.phone}" style="color: inherit; text-decoration: none;">${stop.phone}</a></div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 280 });
      marker.on('click', () => setSelectedStop(stop));
      markersLayerRef.current.addLayer(marker);
    });

    let routeLineCoords = [];
    if (pathCoords && pathCoords.length > 1) {
      routeLineCoords = pathCoords;
    } else {
      routeLineCoords = validStops.map((s) => [s.lat, s.lng]);
    }

    if (routeLineCoords.length > 1) {
      const glowPolyline = L.polyline(routeLineCoords, {
        color: '#1E40AF',
        weight: 7,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      });
      polylineLayerRef.current.addLayer(glowPolyline);

      const mainPolyline = L.polyline(routeLineCoords, {
        color: '#2563EB',
        weight: 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      });
      polylineLayerRef.current.addLayer(mainPolyline);
    }

    try {
      const bounds = markersLayerRef.current.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    } catch (e) {
      console.warn('Map fitBounds error:', e);
    }

    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 150);
  }, [routeData, stops, pathCoords]);

  const handleResetBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current) return;
    try {
      const bounds = markersLayerRef.current.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    } catch (e) {
      console.warn('Reset view error:', e);
    }
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--color-border, #E5E7EB)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : 'auto',
        zIndex: isFullscreen ? 99999 : 1,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <style>{`
        @keyframes mapPulse {
          0% { transform: scale(0.8); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 10px !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
          padding: 4px !important;
        }
        .leaflet-popup-tip {
          background: white !important;
        }
      `}</style>

      {/* Header bar with route metrics & actions */}
      {showSummaryHeader && (
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border, #E5E7EB)',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={18} color="#2563EB" />
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-soil-dark, #1F2937)' }}>
                {title}
              </h4>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary, #6B7280)' }}>
              OpenStreetMap + OSRM Driving Engine with precision Indian Agricultural Micro-locations
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Metric Pills */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#EFF6FF',
                color: '#1E40AF',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: '1px solid #BFDBFE'
              }}
            >
              <Truck size={14} />
              <span>{totalKm} km Total</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ECFDF5',
                color: '#065F46',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: '1px solid #A7F3D0'
              }}
            >
              <Clock size={14} />
              <span>~{etaMins} mins ETA</span>
            </div>

            {navUrl && (
              <a
                href={navUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#2563EB',
                  color: 'white',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                  transition: 'background 0.2s ease'
                }}
                title="Launch turn-by-turn navigation in Google Maps app"
              >
                <span>Google Maps GPS</span>
                <ExternalLink size={13} />
              </a>
            )}

            <button
              type="button"
              onClick={handleResetBounds}
              title="Fit route bounds"
              style={{
                background: 'white',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                color: '#374151'
              }}
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFullscreen((prev) => !prev);
                setTimeout(() => {
                  if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
                }, 100);
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
              style={{
                background: 'white',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                color: '#374151'
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Map Canvas Container */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 120px)' : height,
          minHeight: '320px',
          background: '#E5E7EB',
          position: 'relative'
        }}
      />

      {/* Stop Sequence Timeline Footer */}
      <div
        style={{
          padding: '10px 16px',
          background: '#F9FAFB',
          borderTop: '1px solid var(--color-border, #E5E7EB)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          overflowX: 'auto',
          fontSize: '0.78rem'
        }}
      >
        <span style={{ fontWeight: 800, color: 'var(--color-text-secondary, #6B7280)', whiteSpace: 'nowrap' }}>
          WAYPOINT SEQUENCE:
        </span>
        {stops.map((s, idx) => (
          <div
            key={s.stop_id || idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: s.type === 'ORIGIN' ? '#EEF2FF' : s.type === 'PICKUP' ? '#F0FDF4' : '#FFF7ED',
              border: `1px solid ${s.type === 'ORIGIN' ? '#C7D2FE' : s.type === 'PICKUP' ? '#BBF7D0' : '#FFEDD5'}`,
              whiteSpace: 'nowrap',
              color: '#1F2937'
            }}
          >
            {s.type === 'ORIGIN' ? <Truck size={12} color="#4F46E5" /> : s.type === 'PICKUP' ? <Sprout size={12} color="#16A34A" /> : <ShoppingBag size={12} color="#EA580C" />}
            <strong>Stop {s.step || idx + 1}:</strong>
            <span>{s.entity || s.title || s.location}</span>
            {s.otp_verified ? (
              <CheckCircle2 size={12} color="#16A34A" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
