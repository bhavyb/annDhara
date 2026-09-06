import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  CheckCircle2,
  TrendingDown,
  Navigation,
  Compass,
  DollarSign,
  Fuel,
  Leaf,
  Layers,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Award,
  Star,
  ShieldCheck,
  Clock,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  Play,
  RotateCcw,
  PackageCheck,
  Building2,
  Store,
  Users,
  PlusCircle,
  XCircle,
  KeyRound,
  Phone,
  Check
} from 'lucide-react';
import DeliveryStatusPanel from './DeliveryStatusPanel.jsx';

const PRESET_FARMER_CARDS = [
  {
    name: 'Farmer A',
    title: 'Farmer A (Sanand)',
    location: 'Sanand Rural',
    crop: 'Tomato (300 kg)',
    customers: 'Grand Fortune Restaurant, FreshMart'
  },
  {
    name: 'Farmer C',
    title: 'Farmer C (Bavla)',
    location: 'Bavla Agri Belt',
    crop: 'Potato (400 kg)',
    customers: 'Grand Fortune Restaurant, FreshMart'
  },
  {
    name: 'Farmer B',
    title: 'Farmer B (Dholka)',
    location: 'Dholka Rural',
    crop: 'Onion (250 kg)',
    customers: 'Grand Fortune Restaurant, FreshMart'
  }
];

export default function LogisticsOptimizerModule({ user }) {
  const [activeSubTab, setActiveSubTab] = useState('live-orders'); // 'live-orders', 'route-opt', 'matching', 'fleet'

  // Multi-Farmer & Multi-Customer Route Optimization State
  const [routeData, setRouteData] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [currentOnboardKg, setCurrentOnboardKg] = useState(0);
  const [otpModalStop, setOtpModalStop] = useState(null);
  const [routeOtpInput, setRouteOtpInput] = useState('');
  const [routeOtpError, setRouteOtpError] = useState('');
  const [routeOtpSuccess, setRouteOtpSuccess] = useState('');
  const [verifyingStopOtp, setVerifyingStopOtp] = useState(false);

  // Dynamic Route Selection State
  const [routeMode, setRouteMode] = useState('live-db'); // 'live-db' or 'preset'
  const [selectedRouteOrderRefs, setSelectedRouteOrderRefs] = useState([]);
  const [selectedFarmerNames, setSelectedFarmerNames] = useState([]);
  const [presetSelectedFarmers, setPresetSelectedFarmers] = useState(['Farmer A', 'Farmer C', 'Farmer B']);

  // Dynamic Matching & Live Deliveries State
  const [liveDeliveries, setLiveDeliveries] = useState([]);
  const [selectedOrderRef, setSelectedOrderRef] = useState('');
  const [dynamicCandidates, setDynamicCandidates] = useState([]);
  const [loadingDynamic, setLoadingDynamic] = useState(false);
  const [assignMessage, setAssignMessage] = useState('');

  // Group active orders by unique farmer for multi-farmer pickup routing
  const farmersWithOrders = React.useMemo(() => {
    const map = new Map();
    (liveDeliveries || []).forEach((d) => {
      const fName = d.farmer_name || 'Farmer';
      if (!map.has(fName)) {
        map.set(fName, {
          farmer_name: fName,
          pickup_location: d.pickup_location || 'Farmgate',
          orders: [],
          total_kg: 0,
          crops: new Set(),
          buyers: new Set(),
          references: []
        });
      }
      const entry = map.get(fName);
      entry.orders.push(d);
      entry.total_kg += Number(d.quantity_kg || 0);
      if (d.crop) entry.crops.add(d.crop);
      if (d.buyer_name) entry.buyers.add(d.buyer_name);
      entry.references.push(d.reference);
    });
    return Array.from(map.values()).map((f) => ({
      ...f,
      crop_list: Array.from(f.crops).join(', '),
      buyer_list: Array.from(f.buyers).join(', ')
    }));
  }, [liveDeliveries]);

  // Fleet state
  const [fleetList, setFleetList] = useState([]);
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerFormData, setRegisterFormData] = useState({
    company: '',
    vehicle_type: 'Mini Truck (Tata Ace)',
    vehicle_capacity_kg: 1000,
    current_location: 'Ahmedabad',
    service_areas: 'Ahmedabad, Gandhinagar, Sanand',
    vehicle_number: ''
  });
  const [registering, setRegistering] = useState(false);

  // Fetch Live Orders scoped to carrier or unassigned
  const fetchLiveDeliveries = () => {
    const carrierParam = user?.organization || user?.name || user?.email ? `&stakeholder=${encodeURIComponent(user.organization || user.name || user.email)}` : '';
    fetch(`/api/deliveries?role=logistics${carrierParam}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.deliveries) {
          const valid = data.deliveries.filter(
            (d) => !(d.farmer_name || '').toLowerCase().includes('test') &&
              !(d.buyer_name || '').toLowerCase().includes('test') &&
              d.reference !== 'ADH-1001' &&
              (d.farmer_name || '').toLowerCase() !== 'matched farmer'
          );
          setLiveDeliveries(valid);
          if (valid.length > 0) {
            setSelectedOrderRef((prev) => prev && valid.some((v) => v.reference === prev) ? prev : valid[0].reference);
            const uniqueFarmers = Array.from(new Set(valid.map((v) => v.farmer_name).filter(Boolean)));
            setSelectedFarmerNames((prev) => {
              if (prev.length > 0 && prev.some((fn) => uniqueFarmers.includes(fn))) {
                return prev;
              }
              return uniqueFarmers.slice(0, 2);
            });
            setSelectedRouteOrderRefs((prev) => {
              if (prev.length > 0 && prev.some((r) => valid.some((v) => v.reference === r))) {
                return prev;
              }
              return valid.slice(0, 3).map((v) => v.reference);
            });
          } else {
            setSelectedOrderRef('');
            setSelectedFarmerNames([]);
            setDynamicCandidates([]);
          }
        }
      })
      .catch((err) => console.error('Error fetching deliveries:', err));
  };

  // Run Dynamic Vehicle Matching on Genuine Orders
  const runDynamicVehicleMatch = (orderRef) => {
    if (!liveDeliveries || liveDeliveries.length === 0) {
      setDynamicCandidates([]);
      return;
    }
    const targetOrder = liveDeliveries.find((d) => d.reference === orderRef) || liveDeliveries[0];
    if (!targetOrder) {
      setDynamicCandidates([]);
      return;
    }
    const loadKg = targetOrder.quantity_kg;
    const pickupLoc = targetOrder.pickup_location || 'Ahmedabad';
    const dropLoc = targetOrder.destination || 'Ahmedabad';

    setLoadingDynamic(true);
    setAssignMessage('');
    fetch('/api/logistics/dynamic-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        load_kg: Number(loadKg),
        pickup_location: pickupLoc,
        destination: dropLoc
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.candidates) {
          setDynamicCandidates(data.candidates);
        }
      })
      .catch((err) => console.error('Error running dynamic match:', err))
      .finally(() => setLoadingDynamic(false));
  };

  // Fetch Fleet
  const fetchFleet = () => {
    setLoadingFleet(true);
    fetch('/api/logistics/fleet')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setFleetList(data.fleet);
        }
      })
      .catch((err) => console.error('Error fetching fleet:', err))
      .finally(() => setLoadingFleet(false));
  };

  useEffect(() => {
    fetchFleet();
    fetchLiveDeliveries();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'matching' && selectedOrderRef) {
      runDynamicVehicleMatch(selectedOrderRef);
    }
  }, [activeSubTab, selectedOrderRef]);

  // Fetch multi-stop route optimization
  const fetchRouteOptimization = (farmerList = null, explicitMode = null, orderRefs = null) => {
    setLoadingRoute(true);
    const activeMode = explicitMode || (routeMode === 'preset' ? 'preset' : 'live');
    const targetFarmers = farmerList !== null ? farmerList : (activeMode === 'preset' ? presetSelectedFarmers : selectedFarmerNames);
    const body = {
      vehicle_capacity_kg: 1000,
      cost_per_km: 24,
      mode: activeMode,
      selected_farmers: targetFarmers
    };
    if (orderRefs && orderRefs.length > 0) {
      body.order_references = orderRefs;
    }
    fetch('/api/route-optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setRouteData(data.data);
          const stops = data.data.route_sequence || data.data.route_stops || [];
          setRouteStops(
            stops.map((s) => ({
              ...s,
              is_verified: s.type === 'ORIGIN',
              verified_at: s.type === 'ORIGIN' ? 'Departed from Yard' : null
            }))
          );
          setCurrentOnboardKg(0);
        }
      })
      .catch((err) => console.error('Error fetching route optimization:', err))
      .finally(() => setLoadingRoute(false));
  };

  const toggleFarmerSelection = (farmerName) => {
    setSelectedFarmerNames((prev) => {
      const next = prev.includes(farmerName) ? prev.filter((f) => f !== farmerName) : [...prev, farmerName];
      fetchRouteOptimization(next, 'live');
      return next;
    });
  };

  const togglePresetFarmerSelection = (farmerName) => {
    setPresetSelectedFarmers((prev) => {
      const next = prev.includes(farmerName) ? prev.filter((f) => f !== farmerName) : [...prev, farmerName];
      fetchRouteOptimization(next, 'preset');
      return next;
    });
  };

  const toggleOrderSelection = (ref) => {
    setSelectedRouteOrderRefs((prev) => {
      const next = prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref];
      fetchRouteOptimization(null, 'live', next.length > 0 ? next : null);
      return next;
    });
  };

  const handleVerifyStopOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpModalStop || !routeOtpInput.trim()) return;
    setVerifyingStopOtp(true);
    setRouteOtpError('');
    setRouteOtpSuccess('');

    try {
      const res = await fetch('/api/route-optimize/verify-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stop_id: otpModalStop.stop_id,
          otp: routeOtpInput.trim(),
          stop_type: otpModalStop.otp_type,
          entity: otpModalStop.entity,
          reference: otpModalStop.reference || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setRouteOtpSuccess(data.message);
        setRouteStops((prevStops) =>
          prevStops.map((s) =>
            s.stop_id === otpModalStop.stop_id
              ? {
                  ...s,
                  is_verified: true,
                  verified_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              : s
          )
        );
        setCurrentOnboardKg(otpModalStop.onboard_load_kg);
        fetchLiveDeliveries();
        setTimeout(() => {
          setOtpModalStop(null);
          setRouteOtpInput('');
          setRouteOtpSuccess('');
        }, 1100);
      } else {
        setRouteOtpError(data.error || 'Invalid verification OTP code.');
      }
    } catch (err) {
      setRouteOtpError('Network connection error while verifying OTP.');
    } finally {
      setVerifyingStopOtp(false);
    }
  };

  const handleResetRoute = () => {
    if (routeData) {
      const stops = routeData.route_sequence || routeData.route_stops || [];
      setRouteStops(
        stops.map((s) => ({
          ...s,
          is_verified: s.type === 'ORIGIN',
          verified_at: s.type === 'ORIGIN' ? 'Departed from Yard' : null
        }))
      );
      setCurrentOnboardKg(0);
      setOtpModalStop(null);
      setRouteOtpInput('');
      setRouteOtpError('');
      setRouteOtpSuccess('');
    } else {
      fetchRouteOptimization(routeMode === 'preset' ? presetSelectedFarmers : selectedFarmerNames);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'route-opt') {
      if (routeMode === 'live-db') {
        fetchRouteOptimization(selectedFarmerNames, 'live');
      } else {
        fetchRouteOptimization(presetSelectedFarmers, 'preset');
      }
    }
  }, [activeSubTab, routeMode]);

  // Handle Partner Registration
  const handleRegisterPartner = (e) => {
    e.preventDefault();
    if (!registerFormData.company) return;
    setRegistering(true);
    fetch('/api/logistics/partner-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerFormData)
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setShowRegisterModal(false);
          fetchFleet();
          setRegisterFormData({
            company: '',
            vehicle_type: 'Mini Truck (Tata Ace)',
            vehicle_capacity_kg: 1000,
            current_location: 'Ahmedabad',
            service_areas: 'Ahmedabad, Gandhinagar, Sanand',
            vehicle_number: ''
          });
        }
      })
      .catch((err) => console.error('Error registering partner:', err))
      .finally(() => setRegistering(false));
  };

  // Assign vehicle to order in database
  const handleAssignVehicle = async (vehicle) => {
    const targetOrder = liveDeliveries.find((d) => d.reference === selectedOrderRef) || liveDeliveries[0];
    if (!targetOrder) {
      setAssignMessage('No active order selected to dispatch.');
      return;
    }
    setAssignMessage('');
    try {
      const res = await fetch(`/api/deliveries/${targetOrder.reference}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logistics_name: vehicle.company,
          vehicle_number: vehicle.vehicle_number || 'Fleet Vehicle',
          current_location: `Carrier ${vehicle.company} dispatched for produce pickup at ${targetOrder.pickup_location}`
        })
      });
      const data = await res.json();
      if (data.success) {
        setAssignMessage(`✓ Successfully assigned ${vehicle.company} (${vehicle.vehicle_number}) to order ${targetOrder.reference}!`);
        fetchLiveDeliveries();
      } else {
        setAssignMessage(data.error || 'Assignment failed');
      }
    } catch (err) {
      setAssignMessage('Network error while assigning vehicle.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>
            <Sparkles size={14} /> AI Logistics Engine & Shared Delivery Platform
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0 0 0' }}>
            Smart Logistics & Shared Fleet Dispatch
          </h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Aggregates nearby farm orders into shared vehicles and matches the best logistics partner.
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div
          style={{
            background: 'var(--color-bg-subtle)',
            padding: '4px',
            borderRadius: '12px',
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={() => setActiveSubTab('live-orders')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'live-orders' ? 'white' : 'transparent',
              color: activeSubTab === 'live-orders' ? 'var(--color-soil-dark)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'live-orders' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Truck size={15} color="#7C3AED" /> ⚡ Live Orders & Dispatch
          </button>

          <button
            onClick={() => setActiveSubTab('route-opt')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'route-opt' ? 'white' : 'transparent',
              color: activeSubTab === 'route-opt' ? 'var(--color-soil-dark)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'route-opt' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Navigation size={15} color="#059669" /> AI Route Optimization
          </button>

          <button
            onClick={() => setActiveSubTab('matching')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'matching' ? 'white' : 'transparent',
              color: activeSubTab === 'matching' ? 'var(--color-soil-dark)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'matching' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={15} color="var(--color-crop)" /> 1. Smart Matching
          </button>

          <button
            onClick={() => setActiveSubTab('fleet')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'fleet' ? 'white' : 'transparent',
              color: activeSubTab === 'fleet' ? 'var(--color-soil-dark)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'fleet' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Users size={15} color="#2563EB" /> 2. Fleet ({fleetList.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 0: LIVE BUYER-FARMER ORDERS & LOGISTICS DISPATCH TRACKING         */}
      {/* ========================================================================= */}
      {activeSubTab === 'live-orders' && (
        <DeliveryStatusPanel
          role="logistics"
          stakeholder={user?.organization || user?.name || user?.email || 'Logistics Partner'}
          user={user}
        />
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB: AI ROUTE OPTIMIZATION (MULTI-FARMER & MULTI-CUSTOMER WITH OTP)  */}
      {/* ========================================================================= */}
      {activeSubTab === 'route-opt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Controls Banner */}
          <div
            style={{
              background: 'white',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                <Navigation size={14} /> Shared Multi-Farm Pickup & Multi-Buyer Delivery
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0 2px 0' }}>
                AI Route Optimization
              </h3>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                Sequences multiple farmgate pickups into an optimal route and fulfills clustered buyers with two-sided OTP verification at every stop.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn-secondary"
                onClick={handleResetRoute}
                style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} /> Reset Route
              </button>
            </div>
          </div>

          {/* DYNAMIC MODE CONTROLS & LIVE DATABASE ORDER PICKER */}
          <div
            style={{
              background: 'white',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-soil-dark)', textTransform: 'uppercase' }}>
                  📦 Route Optimization Mode:
                </span>
                <div style={{ display: 'inline-flex', background: 'var(--color-bg-subtle)', padding: '3px', borderRadius: '8px', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setRouteMode('live-db');
                      fetchRouteOptimization(selectedFarmerNames, 'live');
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: routeMode === 'live-db' ? 'white' : 'transparent',
                      color: routeMode === 'live-db' ? '#059669' : 'var(--color-text-secondary)',
                      boxShadow: routeMode === 'live-db' ? 'var(--shadow-sm)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    ⚡ Dynamic Live Farmers ({farmersWithOrders.length} Available)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRouteMode('preset');
                      fetchRouteOptimization(presetSelectedFarmers, 'preset');
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: routeMode === 'preset' ? 'white' : 'transparent',
                      color: routeMode === 'preset' ? '#7C3AED' : 'var(--color-text-secondary)',
                      boxShadow: routeMode === 'preset' ? 'var(--shadow-sm)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    🌾 3-Farm Sample Corridor
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {routeMode === 'live-db' ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => fetchRouteOptimization(selectedFarmerNames, 'live')}
                    disabled={selectedFarmerNames.length < 1 || loadingRoute}
                    style={{ fontSize: '0.78rem', padding: '6px 14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={13} className={loadingRoute ? 'spin-icon' : ''} />
                    {loadingRoute ? 'Calculating Route...' : `Optimize Route (${selectedFarmerNames.length} Farmers Selected)`}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => fetchRouteOptimization(presetSelectedFarmers, 'preset')}
                    disabled={presetSelectedFarmers.length < 1 || loadingRoute}
                    style={{ fontSize: '0.78rem', padding: '6px 14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', background: '#7C3AED', borderColor: '#7C3AED' }}
                  >
                    <RefreshCw size={13} className={loadingRoute ? 'spin-icon' : ''} />
                    {loadingRoute ? 'Calculating Route...' : `Optimize Preset (${presetSelectedFarmers.length} Farmers)`}
                  </button>
                )}
              </div>
            </div>

            {/* LIVE-DB MODE: FARMER PICKUP SELECTION */}
            {routeMode === 'live-db' && (
              <div style={{ background: 'var(--color-bg-subtle)', padding: '14px 16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-soil-dark)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🚜 Select 2 or More Farmers for Farmgate Pickup:
                    </span>
                    <div style={{ fontSize: '0.73rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                      ✓ Customer Doorstep Delivery stops will strictly show ONLY the customers who ordered from these selected farmers.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allF = farmersWithOrders.map((f) => f.farmer_name);
                        setSelectedFarmerNames(allF);
                        fetchRouteOptimization(allF, 'live');
                      }}
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Select All ({farmersWithOrders.length})
                    </button>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const topTwo = farmersWithOrders.slice(0, 2).map((f) => f.farmer_name);
                        setSelectedFarmerNames(topTwo);
                        fetchRouteOptimization(topTwo, 'live');
                      }}
                      style={{ background: 'none', border: 'none', color: '#059669', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Select Top 2 Farmers
                    </button>
                  </div>
                </div>

                {farmersWithOrders.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '10px' }}>
                    {farmersWithOrders.map((farmer) => {
                      const isChecked = selectedFarmerNames.includes(farmer.farmer_name);
                      return (
                        <div
                          key={farmer.farmer_name}
                          onClick={() => toggleFarmerSelection(farmer.farmer_name)}
                          style={{
                            background: isChecked ? '#ECFDF5' : 'white',
                            border: `1.5px solid ${isChecked ? '#059669' : 'var(--color-border)'}`,
                            borderRadius: '8px',
                            padding: '12px 14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            boxShadow: isChecked ? '0 2px 8px rgba(5,150,105,0.12)' : 'var(--shadow-sm)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ accentColor: '#059669', cursor: 'pointer', width: '18px', height: '18px', marginTop: '2px' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                                🌾 {farmer.farmer_name}
                              </span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', background: '#E8F5E9', padding: '2px 7px', borderRadius: '12px' }}>
                                {farmer.total_kg} kg cargo
                              </span>
                            </div>

                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                              📍 <strong>Pickup:</strong> {farmer.pickup_location} • <em>{farmer.crop_list}</em>
                            </div>

                            <div style={{ fontSize: '0.73rem', color: '#1E40AF', background: '#EFF6FF', padding: '4px 8px', borderRadius: '6px', marginTop: '6px', lineHeight: 1.3 }}>
                              🛒 <strong>Customers with Orders:</strong> {farmer.buyer_list || 'Direct Buyers'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', padding: '6px 0' }}>
                    No active farmers with pending orders in the live queue.
                  </div>
                )}

                {selectedFarmerNames.length < 2 && (
                  <div style={{ fontSize: '0.74rem', color: '#D97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertTriangle size={13} /> Please select 2 or more farmers to pool a multi-farmgate pickup and consolidated customer doorstep route.
                  </div>
                )}
              </div>
            )}

            {/* PRESET MODE: CORRIDOR FARMER SELECTION */}
            {routeMode === 'preset' && (
              <div style={{ background: 'var(--color-bg-subtle)', padding: '14px 16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🚜 Preset 3-Farm Corridor Pickup Selection:
                    </span>
                    <div style={{ fontSize: '0.73rem', color: '#6D28D9', fontWeight: 600, marginTop: '2px' }}>
                      ✓ Doorstep customer drops will strictly route to buyers receiving harvest from your selected farmers.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allP = PRESET_FARMER_CARDS.map((f) => f.name);
                        setPresetSelectedFarmers(allP);
                        fetchRouteOptimization(allP, 'preset');
                      }}
                      style={{ background: 'none', border: 'none', color: '#7C3AED', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Select All (3)
                    </button>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const two = ['Farmer A', 'Farmer C'];
                        setPresetSelectedFarmers(two);
                        fetchRouteOptimization(two, 'preset');
                      }}
                      style={{ background: 'none', border: 'none', color: '#059669', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Select 2 Farmers (A & C)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {PRESET_FARMER_CARDS.map((farmer) => {
                    const isChecked = presetSelectedFarmers.includes(farmer.name);
                    return (
                      <div
                        key={farmer.name}
                        onClick={() => togglePresetFarmerSelection(farmer.name)}
                        style={{
                          background: isChecked ? '#F5F3FF' : 'white',
                          border: `1.5px solid ${isChecked ? '#7C3AED' : 'var(--color-border)'}`,
                          borderRadius: '8px',
                          padding: '12px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          boxShadow: isChecked ? '0 2px 8px rgba(124,58,237,0.12)' : 'var(--shadow-sm)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ accentColor: '#7C3AED', cursor: 'pointer', width: '18px', height: '18px', marginTop: '2px' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                              🌾 {farmer.title}
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', padding: '2px 7px', borderRadius: '12px' }}>
                              {farmer.crop}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                            📍 <strong>Location:</strong> {farmer.location}
                          </div>

                          <div style={{ fontSize: '0.73rem', color: '#4338CA', background: '#EEF2FF', padding: '4px 8px', borderRadius: '6px', marginTop: '6px', lineHeight: 1.3 }}>
                            🛒 <strong>Destination Customers:</strong> {farmer.customers}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ROUTE METRICS & VEHICLE CAPACITY PROGRESS BAR */}
          {routeData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {/* Vehicle Capacity Gauge */}
              <div
                style={{
                  background: 'white',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-soil-dark)', textTransform: 'uppercase' }}>
                    🚚 Vehicle Live Load Tracker
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#059669' }}>
                    {currentOnboardKg} / {routeData.vehicle_capacity_kg} kg ({Math.round((currentOnboardKg / routeData.vehicle_capacity_kg) * 100)}%)
                  </span>
                </div>

                {/* Gauge Progress Track */}
                <div style={{ width: '100%', height: '10px', background: 'var(--color-bg-subtle)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round((currentOnboardKg / routeData.vehicle_capacity_kg) * 100))}%`,
                      background: currentOnboardKg > 800 ? 'linear-gradient(90deg, #059669, #10B981)' : '#2563EB',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>

                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{routeData.partner?.company} ({routeData.vehicle_type})</span>
                  <span>Max Payload: 1,000 kg</span>
                </div>
              </div>

              {/* Distance Efficiency */}
              <div
                style={{
                  background: 'white',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-crop)', textTransform: 'uppercase' }}>
                  Consolidated Distance Saved
                </span>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--color-soil-dark)' }}>
                  {routeData.metrics?.distance_saved_km} km <span style={{ fontSize: '0.9rem', color: 'var(--color-crop)' }}>({routeData.metrics?.distance_saved_pct}% saved)</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                  Shared Route: {routeData.metrics?.optimized_route_distance_km} km vs 3 Uncoordinated: {routeData.metrics?.uncoordinated_distance_km} km
                </div>
              </div>

              {/* Cost & Carbon Reduction */}
              <div
                style={{
                  background: 'white',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>
                  Shared Freight & Carbon Savings
                </span>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#7C3AED' }}>
                  ₹{routeData.metrics?.cost_saved_inr} <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>saved ({routeData.metrics?.cost_reduction_pct}%)</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                  🌿 {routeData.metrics?.co2_saved_kg} kg CO₂ emissions prevented
                </div>
              </div>
            </div>
          )}

          {/* STOP-BY-STOP SEQUENCED TIMELINE WITH LIVE OTP VERIFICATION */}
          <div
            style={{
              background: 'white',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                  Optimized Stop Sequence & Two-Sided Verification
                </h4>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  Driver must collect and input the unique 4-digit OTP at each farmer farmgate and buyer facility to proceed.
                </div>
              </div>

              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: '12px' }}>
                {routeStops.filter((s) => s.is_verified).length} of {routeStops.length} Milestones Verified
              </span>
            </div>

            {/* Stops Timeline List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {routeStops.map((stop, idx) => {
                const isOrigin = stop.type === 'ORIGIN';
                const isPickup = stop.type === 'PICKUP';
                const isDelivery = stop.type === 'DELIVERY';
                const isVerified = stop.is_verified;

                return (
                  <div
                    key={stop.stop_id}
                    style={{
                      border: `1.5px solid ${isVerified ? '#A7F3D0' : isPickup ? '#BAE6FD' : '#DDD6FE'}`,
                      background: isVerified ? '#F0FDF4' : 'white',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '14px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '650px' }}>
                      {/* Step Number Circle */}
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: isVerified ? '#059669' : isPickup ? '#0284C7' : '#7C3AED',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          flexShrink: 0
                        }}
                      >
                        {isVerified ? <Check size={18} /> : stop.step}
                      </div>

                      {/* Stop Info */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              color: isOrigin ? '#6B7280' : isPickup ? '#0369A1' : '#6D28D9',
                              background: isOrigin ? '#F3F4F6' : isPickup ? '#E0F2FE' : '#EDE9FE',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}
                          >
                            {isOrigin ? 'Origin Depot' : isPickup ? '🌾 Farmer Farmgate Pickup' : '🛒 Customer Doorstep Delivery'}
                          </span>

                          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            +{stop.distance_leg_km} km leg ({stop.cumulative_distance_km} km total)
                          </span>
                        </div>

                        <h5 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0 2px 0' }}>
                          {stop.entity}
                        </h5>

                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} color="var(--color-crop)" /> {stop.location}
                        </div>

                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isVerified ? '#047857' : 'var(--color-soil-dark)', marginTop: '4px' }}>
                          {stop.action}
                        </div>

                        {isPickup && stop.target_customers && (
                          <div style={{ fontSize: '0.74rem', color: '#1E40AF', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '3px 8px', borderRadius: '6px', marginTop: '4px', display: 'inline-block' }}>
                            🛒 <strong>Target Doorstep Customers:</strong> {stop.target_customers}
                          </div>
                        )}

                        {isDelivery && stop.from_farmer && (
                          <div style={{ fontSize: '0.74rem', color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: '6px', marginTop: '4px', display: 'inline-block' }}>
                            🌾 <strong>Harvest Source:</strong> Ordered exclusively from <strong>{stop.from_farmer}</strong>
                          </div>
                        )}

                        <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          📦 Cargo onboard: {stop.cargo_breakdown}
                        </div>
                      </div>
                    </div>

                    {/* Verification Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      {isVerified ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            color: '#047857',
                            background: '#ECFDF5',
                            border: '1px solid #A7F3D0',
                            padding: '6px 14px',
                            borderRadius: '8px'
                          }}
                        >
                          <CheckCircle2 size={16} />
                          {isOrigin ? 'Vehicle Departed' : 'OTP Verified by Driver'}
                        </div>
                      ) : (
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setOtpModalStop(stop);
                            setRouteOtpInput('');
                            setRouteOtpError('');
                            setRouteOtpSuccess('');
                          }}
                          style={{
                            padding: '8px 16px',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: isPickup ? '#0284C7' : '#7C3AED',
                            borderColor: isPickup ? '#0284C7' : '#7C3AED'
                          }}
                        >
                          <KeyRound size={15} />
                          {isPickup ? "Enter Farmer's Pickup OTP" : "Enter Buyer's Delivery OTP"}
                        </button>
                      )}

                      {!isOrigin && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          {isVerified ? `Verified at ${stop.verified_at}` : `Contact: ${stop.phone}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OTP VERIFICATION MODAL */}
          {otpModalStop && (
            <div className="modal-overlay" onClick={() => setOtpModalStop(null)}>
              <div
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '440px', padding: '24px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: otpModalStop.type === 'PICKUP' ? '#ECFDF5' : '#EFF6FF', color: otpModalStop.type === 'PICKUP' ? '#047857' : '#1E40AF', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                      <KeyRound size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                        {otpModalStop.type === 'PICKUP' ? 'Verify Farmgate Pickup' : 'Verify Doorstep Delivery'}
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {otpModalStop.entity} • {otpModalStop.location}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setOtpModalStop(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <XCircle size={20} color="var(--color-text-muted)" />
                  </button>
                </div>

                <form onSubmit={handleVerifyStopOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: 'var(--color-bg-subtle)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                      {otpModalStop.type === 'PICKUP'
                        ? `Please collect the 4-digit Farmgate Pickup OTP directly from ${otpModalStop.entity} before loading produce into the vehicle.`
                        : `Please collect the 4-digit Doorstep Delivery OTP from ${otpModalStop.entity} upon safe handover of the produce.`}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800 }}>
                      Enter 4-Digit {otpModalStop.type === 'PICKUP' ? 'Farmer Pickup' : 'Buyer Delivery'} OTP *
                    </label>
                    <input
                      type="text"
                      className="nexus-input"
                      maxLength={4}
                      placeholder="e.g. 4821"
                      autoFocus
                      required
                      value={routeOtpInput}
                      onChange={(e) => setRouteOtpInput(e.target.value.replace(/\D/g, ''))}
                      style={{
                        textAlign: 'center',
                        fontSize: '1.5rem',
                        fontWeight: 900,
                        letterSpacing: '6px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>

                  {routeOtpError && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FECACA'
                      }}
                    >
                      {routeOtpError}
                    </div>
                  )}

                  {routeOtpSuccess && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: '#ECFDF5',
                        color: '#047857',
                        border: '1px solid #A7F3D0'
                      }}
                    >
                      {routeOtpSuccess}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setOtpModalStop(null)}
                      style={{ flex: 1, padding: '10px 0', fontWeight: 700 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={verifyingStopOtp || routeOtpInput.length !== 4}
                      style={{
                        flex: 2,
                        padding: '10px 0',
                        fontWeight: 800,
                        background: otpModalStop.type === 'PICKUP' ? '#0284C7' : '#7C3AED',
                        borderColor: otpModalStop.type === 'PICKUP' ? '#0284C7' : '#7C3AED'
                      }}
                    >
                      {verifyingStopOtp ? 'Validating Code...' : 'Verify Stop & Update Vehicle'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: DYNAMIC SMART VEHICLE MATCHING ALGORITHM                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'matching' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Controls: Live Order Selector */}
          <div
            style={{
              background: 'white',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-crop)', textTransform: 'uppercase' }}>
                  Dynamic Fleet Matching Engine
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: '4px 0 2px 0' }}>
                  AI Multi-Criteria Logistics Partner Matching
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  Evaluates vehicle capacity fit, proximity to farmgate pickup, and driver reliability scores from your registered fleet in real-time.
                </div>
              </div>

              <button
                className="btn-secondary"
                onClick={() => runDynamicVehicleMatch(selectedOrderRef)}
                disabled={loadingDynamic}
                style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <RefreshCw size={14} className={loadingDynamic ? 'spin-icon' : ''} />
                {loadingDynamic ? 'Evaluating Fleet...' : 'Re-Calculate Matches'}
              </button>
            </div>

            {/* Select Live Order to Match */}
            <div style={{ background: 'var(--color-bg-subtle)', padding: '14px 18px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>
                  📦 Select Active Live Order to Dispatch:
                </label>
                {liveDeliveries.length > 0 && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-crop)', fontWeight: 700 }}>
                    {liveDeliveries.length} active delivery orders in network
                  </span>
                )}
              </div>

              {liveDeliveries.length > 0 ? (
                <select
                  className="nexus-select"
                  value={selectedOrderRef}
                  onChange={(e) => {
                    setSelectedOrderRef(e.target.value);
                    runDynamicVehicleMatch(e.target.value);
                  }}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', fontWeight: 600, background: 'white' }}
                >
                  {liveDeliveries.map((order) => (
                    <option key={order.reference} value={order.reference}>
                      {order.reference} — {order.quantity_kg} kg {order.crop} (From {order.farmer_name} at {order.pickup_location} ➔ To {order.buyer_name} at {order.destination}) [{order.status}]
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', padding: '10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="var(--color-text-muted)" />
                  <span>No active delivery orders currently pending in your queue. When buyers place orders in the Marketplace, orders will appear here for dynamic fleet matching.</span>
                </div>
              )}

              {assignMessage && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    background: assignMessage.startsWith('✓') ? '#ECFDF5' : '#FEF2F2',
                    color: assignMessage.startsWith('✓') ? '#047857' : '#DC2626',
                    border: `1px solid ${assignMessage.startsWith('✓') ? '#A7F3D0' : '#FECACA'}`
                  }}
                >
                  {assignMessage}
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Candidate Vehicles List */}
          {liveDeliveries.length > 0 && dynamicCandidates.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
              {dynamicCandidates.map((veh, idx) => {
                const isBest = idx === 0;
                return (
                  <div
                    key={veh.id}
                    style={{
                      background: 'white',
                      border: `2px solid ${isBest ? 'var(--color-crop)' : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '20px',
                      boxShadow: isBest ? 'var(--shadow-md)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: veh.status_color || 'var(--color-crop)' }}>
                          {veh.badge}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          ~{veh.distance_km} km proximity
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                        {veh.company}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {veh.vehicle_type} {veh.vehicle_number ? `• ${veh.vehicle_number}` : ''}
                      </div>

                      <div style={{ margin: '14px 0', background: 'var(--color-bg-subtle)', padding: '10px 12px', borderRadius: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Capacity</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-soil-dark)' }}>{veh.capacity_kg} kg</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Reliability Score</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7C3AED' }}>{veh.reliability_score}/100 ⭐</div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: isBest ? 'var(--color-soil-dark)' : 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                        <strong>AI Evaluation:</strong> {veh.match_reason}
                      </div>
                    </div>

                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                      <button
                        className="btn-primary"
                        onClick={() => handleAssignVehicle(veh)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          background: isBest ? 'var(--color-crop)' : '#2563EB',
                          borderColor: isBest ? 'var(--color-crop)' : '#2563EB',
                          justifyContent: 'center'
                        }}
                      >
                        <Truck size={14} /> Assign {veh.company} to Order
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : liveDeliveries.length === 0 ? (
            <div style={{ background: 'white', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <Truck size={36} color="var(--color-text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--color-soil-dark)', fontSize: '1.05rem', fontWeight: 700 }}>No Orders Available for Matching</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Once an active order is placed in Marketplace, the AI engine will dynamically rank your fleet by load capacity, farm proximity, and reliability score.</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: REGISTERED FLEET & PARTNER ONBOARDING                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'fleet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Action */}
          <div
            style={{
              background: 'white',
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                Verified Logistics Partners & Commercial Fleet ({fleetList.length} Active)
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                Every logistics partner receives a dynamic Reliability Score based on on-time delivery, success rate, and farmer ratings.
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={() => setShowRegisterModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 16px' }}
            >
              <PlusCircle size={15} /> Register New Logistics Partner
            </button>
          </div>

          {/* Fleet Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px' }}>
            {fleetList.map((partner) => (
              <div
                key={partner.id}
                className="nexus-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#E8F5E9', color: 'var(--color-crop)', padding: '3px 8px', borderRadius: '10px' }}>
                      {partner.status}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Star size={13} fill="#D97706" /> {partner.rating} ★
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                    {partner.company}
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {partner.vehicle_type} • <strong>{partner.vehicle_capacity_kg} kg</strong>
                  </div>

                  <div style={{ margin: '14px 0', background: 'var(--color-bg-subtle)', padding: '10px 12px', borderRadius: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Reliability Score</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#7C3AED' }}>{partner.reliability_score}/100</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>On-Time Rate</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-crop)' }}>{partner.on_time_pct}%</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    📍 <strong>Service Areas:</strong> {partner.service_areas}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                    🚚 <strong>Completed Deliveries:</strong> {partner.completed_deliveries} trips
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Register Partner Modal */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-soil-dark)', margin: 0 }}>
                Register Commercial Vehicle & Partner
              </h3>
              <button onClick={() => setShowRegisterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <XCircle size={20} color="var(--color-text-muted)" />
              </button>
            </div>

            <form onSubmit={handleRegisterPartner} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Logistics Company / Transporter Name *</label>
                <input
                  type="text"
                  className="nexus-input"
                  required
                  placeholder="e.g. ABC Logistics"
                  value={registerFormData.company}
                  onChange={(e) => setRegisterFormData({ ...registerFormData, company: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Vehicle Model *</label>
                  <select
                    className="nexus-select"
                    value={registerFormData.vehicle_type}
                    onChange={(e) => setRegisterFormData({ ...registerFormData, vehicle_type: e.target.value })}
                  >
                    <option value="Mini Truck (Tata Ace)">Mini Truck (Tata Ace)</option>
                    <option value="Pickup Truck (Mahindra Bolero)">Pickup (Bolero Maxi)</option>
                    <option value="Light Commercial Truck (407)">LCV (Eicher / 407)</option>
                    <option value="Electric Cargo EV">Electric Cargo EV</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Capacity (kg) *</label>
                  <input
                    type="number"
                    className="nexus-input"
                    required
                    value={registerFormData.vehicle_capacity_kg}
                    onChange={(e) => setRegisterFormData({ ...registerFormData, vehicle_capacity_kg: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Current City / Hub *</label>
                  <input
                    type="text"
                    className="nexus-input"
                    required
                    placeholder="e.g. Ahmedabad"
                    value={registerFormData.current_location}
                    onChange={(e) => setRegisterFormData({ ...registerFormData, current_location: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Vehicle Registration No.</label>
                  <input
                    type="text"
                    className="nexus-input"
                    placeholder="e.g. GJ-01-ET-8412"
                    value={registerFormData.vehicle_number}
                    onChange={(e) => setRegisterFormData({ ...registerFormData, vehicle_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Service Operational Areas *</label>
                <input
                  type="text"
                  className="nexus-input"
                  required
                  placeholder="e.g. Ahmedabad, Gandhinagar, Sanand"
                  value={registerFormData.service_areas}
                  onChange={(e) => setRegisterFormData({ ...registerFormData, service_areas: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={registering}
                style={{ marginTop: '10px', padding: '10px 0', fontWeight: 800 }}
              >
                {registering ? 'Registering Partner...' : 'Confirm Partner Onboarding'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
