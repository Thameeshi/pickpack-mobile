import { useEffect, useState } from 'react';
import { getDrivers, updateUserStatus, subscribeToDriverLocations } from '../services/userService';
import { getTripsByDriver } from '../services/tripService';
import { UserProfile, Driver, TripSession } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Search, CheckCircle, XCircle, Eye, X } from 'lucide-react';

export default function DriversPage() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<UserProfile[]>([]);
  const [liveDrivers, setLiveDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [trips, setTrips] = useState<TripSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const d = await getDrivers();
    setDrivers(d);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const unsub = subscribeToDriverLocations(setLiveDrivers);
    return unsub;
  }, []);

  useEffect(() => {
    if (selected) {
      getTripsByDriver(selected.uid).then(setTrips);
    }
  }, [selected?.uid]);

  const filtered = drivers.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (d.name?.toLowerCase().includes(s) || d.email?.toLowerCase().includes(s) || d.vehiclePlate?.toLowerCase().includes(s) || d.phone?.includes(s));
    }
    return true;
  });

  const liveMap = new Map(liveDrivers.map(d => [d.uid, d]));

  const handleStatusChange = async (uid: string, status: 'approved' | 'suspended' | 'rejected') => {
    await updateUserStatus(uid, status, profile?.uid);
    refresh();
    if (selected?.uid === uid) setSelected(prev => prev ? { ...prev, status } : null);
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Drivers</h2>
          <p>{drivers.length} total drivers • {liveDrivers.length} online now</p>
        </div>
      </div>
      <div className="page-content">
        <div className="filters-row">
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search drivers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {['all', 'approved', 'pending', 'suspended', 'rejected'].map(f => (
            <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && <> ({drivers.filter(d => d.status === f).length})</>}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Contact</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Live</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const live = liveMap.get(d.uid);
                return (
                  <tr key={d.uid}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: live ? 'var(--success)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'white', flexShrink: 0 }}>
                          {d.name?.[0]?.toUpperCase() || 'D'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{d.name || d.displayName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{d.phone || '—'}</td>
                    <td>{d.vehiclePlate || '—'} {d.vehicleType ? `• ${d.vehicleType}` : ''}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td>{live ? <span className="badge badge-success">Online</span> : <span className="badge badge-default">Offline</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(d)}><Eye size={14} /> View</button>
                        {d.status === 'pending' && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(d.uid, 'approved')}><CheckCircle size={14} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange(d.uid, 'rejected')}><XCircle size={14} /></button>
                          </>
                        )}
                        {d.status === 'approved' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(d.uid, 'suspended')}>Suspend</button>
                        )}
                        {d.status === 'suspended' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(d.uid, 'approved')}>Reactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No drivers found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
              <div className="modal-header">
                <h3>Driver Details</h3>
                <button className="btn-ghost btn-icon" onClick={() => setSelected(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: 'white', margin: '0 auto 10px' }}>
                    {selected.name?.[0]?.toUpperCase() || 'D'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.name}</div>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="driver-detail-card">
                  <div className="detail-field"><label>Email</label><p>{selected.email}</p></div>
                  <div className="detail-field"><label>Phone</label><p>{selected.phone || '—'}</p></div>
                  <div className="detail-field"><label>Vehicle Plate</label><p>{selected.vehiclePlate || '—'}</p></div>
                  <div className="detail-field"><label>Vehicle Type</label><p>{selected.vehicleType || '—'}</p></div>
                  <div className="detail-field"><label>Vehicle Model</label><p>{selected.vehicleModel || '—'}</p></div>
                  <div className="detail-field"><label>License</label><p>{selected.licenseNumber || '—'}</p></div>
                  <div className="detail-field"><label>Joined</label><p>{selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : '—'}</p></div>
                  <div className="detail-field"><label>Total Trips</label><p>{trips.length}</p></div>
                </div>
                {trips.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Recent Trips</h4>
                    {trips.slice(0, 5).map(t => (
                      <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>{new Date(t.startTime).toLocaleDateString()}</span>
                        <span>{t.totalDistance?.toFixed(1) || '?'} km</span>
                        <span className={`badge ${t.status === 'completed' ? 'badge-success' : t.status === 'active' ? 'badge-warning' : 'badge-default'}`}>{t.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { approved: 'badge-success', pending: 'badge-warning', suspended: 'badge-default', rejected: 'badge-danger' };
  return <span className={`badge ${map[status] || 'badge-default'}`}>{status}</span>;
}
