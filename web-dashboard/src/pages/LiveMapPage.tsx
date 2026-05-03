import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { subscribeToDriverLocations, getDrivers } from '../services/userService';
import { subscribeToTrips } from '../services/tripService';
import { Driver, UserProfile, TripSession } from '../types';
import { Search, RefreshCw } from 'lucide-react';

// Fix default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createDriverIcon(initial: string, color: string) {
  return L.divIcon({
    className: 'driver-map-marker',
    html: `<div style="
      width:38px;height:38px;border-radius:50%;
      background:${color};border:3px solid white;
      display:flex;align-items:center;justify-content:center;
      font-weight:800;font-size:15px;color:white;
      box-shadow:0 3px 10px rgba(0,0,0,0.35);
      font-family:Inter,sans-serif;
    ">${initial}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

function getStatusColor(speed?: number | null): string {
  if (!speed || speed < 1) return '#F59E0B'; // idle
  if (speed < 10) return '#3B82F6'; // transit
  return '#10B981'; // moving
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function LiveMapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const [liveDrivers, setLiveDrivers] = useState<Driver[]>([]);
  const [driverProfiles, setDriverProfiles] = useState<UserProfile[]>([]);
  const [trips, setTrips] = useState<TripSession[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [6.9271, 79.8612], // Colombo
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Load profiles
  useEffect(() => {
    getDrivers().then(setDriverProfiles);
  }, []);

  // Subscribe to live locations
  useEffect(() => {
    return subscribeToDriverLocations(setLiveDrivers);
  }, []);

  // Subscribe to trips
  useEffect(() => {
    return subscribeToTrips(setTrips);
  }, []);

  // Update markers when drivers change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const profileMap = new Map(driverProfiles.map(p => [p.uid, p]));
    const currentIds = new Set<string>();

    liveDrivers.forEach(d => {
      if (!d.location) return;
      currentIds.add(d.uid);

      const profile = profileMap.get(d.uid);
      const name = profile?.name || d.displayName || 'Driver';
      const initial = name[0]?.toUpperCase() || 'D';
      const color = getStatusColor(d.location.speed);
      const plate = profile?.vehiclePlate || d.vehiclePlate || 'No plate';
      const phone = profile?.phone || d.phoneNumber || '';

      const existing = markersRef.current.get(d.uid);

      if (existing) {
        existing.setLatLng([d.location.lat, d.location.lng]);
        existing.setIcon(createDriverIcon(initial, color));
        existing.setPopupContent(`
          <div style="font-family:Inter,sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${name}</div>
            <div style="font-size:11px;color:#666;margin-bottom:2px">🚗 ${plate}</div>
            <div style="font-size:11px;color:#666;margin-bottom:2px">📱 ${phone}</div>
            <div style="font-size:11px;color:#666">📍 ${d.location.lat.toFixed(4)}, ${d.location.lng.toFixed(4)}</div>
          </div>
        `);
      } else {
        const marker = L.marker([d.location.lat, d.location.lng], {
          icon: createDriverIcon(initial, color),
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${name}</div>
            <div style="font-size:11px;color:#666;margin-bottom:2px">🚗 ${plate}</div>
            <div style="font-size:11px;color:#666;margin-bottom:2px">📱 ${phone}</div>
            <div style="font-size:11px;color:#666">📍 ${d.location.lat.toFixed(4)}, ${d.location.lng.toFixed(4)}</div>
          </div>
        `);

        marker.on('click', () => setSelectedDriver(d.uid));
        markersRef.current.set(d.uid, marker);
      }
    });

    // Remove old markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });
  }, [liveDrivers, driverProfiles]);

  const fitAllDrivers = () => {
    const map = mapRef.current;
    if (!map || liveDrivers.length === 0) return;
    const coords = liveDrivers
      .filter(d => d.location)
      .map(d => [d.location!.lat, d.location!.lng] as [number, number]);
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [50, 50] });
    }
  };

  const focusDriver = (uid: string) => {
    const d = liveDrivers.find(x => x.uid === uid);
    if (d?.location && mapRef.current) {
      mapRef.current.setView([d.location.lat, d.location.lng], 16, { animate: true });
      const marker = markersRef.current.get(uid);
      marker?.openPopup();
      setSelectedDriver(uid);
    }
  };

  const profileMap = new Map(driverProfiles.map(p => [p.uid, p]));
  const activeTrips = trips.filter(t => t.status === 'active');
  const onlineCount = liveDrivers.filter(d => d.location).length;

  const filteredDrivers = liveDrivers.filter(d => {
    if (!d.location) return false;
    if (!search) return true;
    const p = profileMap.get(d.uid);
    const name = (p?.name || d.displayName || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Live Map</h2>
          <p>{onlineCount} drivers online • {activeTrips.length} active trips</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={fitAllDrivers}><RefreshCw size={15} /> Fit All</button>
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar driver list */}
        <div style={{
          width: 280, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 14px 10px' }}>
            <div className="search-box" style={{ maxWidth: '100%' }}>
              <Search size={15} />
              <input placeholder="Search driver..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}>
            <div style={{ flex: 1, background: 'rgba(16,185,129,0.1)', borderRadius: 8, padding: '8px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#34D399' }}>{onlineCount}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Online</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(245,158,11,0.1)', borderRadius: 8, padding: '8px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FBBF24' }}>{activeTrips.length}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Trips</div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, padding: '0 14px 12px', fontSize: 10, color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#10B981', marginRight: 4 }}></span>Moving</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#3B82F6', marginRight: 4 }}></span>Transit</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#F59E0B', marginRight: 4 }}></span>Idle</span>
          </div>

          {/* Driver list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {filteredDrivers.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                No online drivers
              </div>
            )}
            {filteredDrivers.map(d => {
              const p = profileMap.get(d.uid);
              const name = p?.name || d.displayName || 'Driver';
              const isSelected = selectedDriver === d.uid;
              return (
                <div
                  key={d.uid}
                  onClick={() => focusDriver(d.uid)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 10px', borderRadius: 10, cursor: 'pointer',
                    marginBottom: 4, transition: 'background 0.15s',
                    background: isSelected ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: getStatusColor(d.location?.speed),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, color: 'white', flexShrink: 0,
                  }}>
                    {name[0]?.toUpperCase() || 'D'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {p?.vehiclePlate || d.vehiclePlate || '—'}
                    </div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10B981', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Map container */}
        <div ref={mapContainerRef} style={{ flex: 1 }} />
      </div>
    </>
  );
}
