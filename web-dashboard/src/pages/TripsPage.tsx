import { useEffect, useState } from 'react';
import { subscribeToTrips } from '../services/tripService';
import { TripSession } from '../types';
import { Search } from 'lucide-react';

function formatDate(ts: number) { return new Date(ts).toLocaleString(); }
function formatDuration(start: number, end?: number) {
  const diff = (end || Date.now()) - start;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export default function TripsPage() {
  const [trips, setTrips] = useState<TripSession[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => { return subscribeToTrips(setTrips); }, []);

  const filtered = trips.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search) return t.driverName?.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const activeCount = trips.filter(t => t.status === 'active').length;
  const completedCount = trips.filter(t => t.status === 'completed').length;
  const totalDistance = trips.reduce((s, t) => s + (t.totalDistance || 0), 0);
  const totalDeliveries = trips.reduce((s, t) => s + (t.deliveriesCompleted || 0), 0);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left"><h2>Trips</h2><p>{trips.length} total trips</p></div>
      </div>
      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon">🚛</div><div className="stat-value">{activeCount}</div><div className="stat-label">Active Now</div></div>
          <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-value">{completedCount}</div><div className="stat-label">Completed</div></div>
          <div className="stat-card"><div className="stat-icon">📏</div><div className="stat-value">{totalDistance.toFixed(0)} km</div><div className="stat-label">Total Distance</div></div>
          <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-value">{totalDeliveries}</div><div className="stat-label">Total Deliveries</div></div>
        </div>
        <div className="filters-row">
          <div className="search-box"><Search size={16} /><input placeholder="Search by driver..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          {['all', 'active', 'completed', 'cancelled'].map(f => (
            <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Driver</th><th>Status</th><th>Start</th><th>Duration</th><th>Distance</th><th>Deliveries</th><th>Fuel Cost</th></tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.driverName}</td>
                  <td><span className={`badge ${t.status === 'active' ? 'badge-success' : t.status === 'completed' ? 'badge-info' : 'badge-default'}`}>{t.status}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.startTime)}</td>
                  <td>{formatDuration(t.startTime, t.endTime)}</td>
                  <td>{t.totalDistance ? `${t.totalDistance.toFixed(1)} km` : '—'}</td>
                  <td>{t.deliveriesCompleted || 0} ✅ / {t.deliveriesFailed || 0} ❌</td>
                  <td>{t.totalFuelCost ? `LKR ${t.totalFuelCost.toFixed(0)}` : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No trips found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
