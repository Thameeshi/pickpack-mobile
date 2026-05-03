import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToTasks } from '../services/taskService';
import { subscribeToTrips } from '../services/tripService';
import { subscribeToFuelExpenses } from '../services/fuelService';
import { getDrivers } from '../services/userService';
import { Task, TripSession, FuelExpense, UserProfile } from '../types';
import { Package, Truck, Navigation, Fuel, TrendingUp, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OverviewPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [trips, setTrips] = useState<TripSession[]>([]);
  const [fuel, setFuel] = useState<FuelExpense[]>([]);
  const [drivers, setDrivers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsub1 = subscribeToTasks(setTasks);
    const unsub2 = subscribeToTrips(setTrips);
    const unsub3 = subscribeToFuelExpenses(setFuel);
    getDrivers().then(setDrivers);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const activeTrips = trips.filter(t => t.status === 'active');
  const activeTasks = tasks.filter(t => !['delivered', 'failed'].includes(t.status));
  const deliveredToday = tasks.filter(t => t.status === 'delivered' && t.completedAt && t.completedAt > Date.now() - 86400000);
  const pendingFuel = fuel.filter(f => f.status === 'pending');
  const totalFuelCost = fuel.reduce((s, f) => s + (f.totalCost || 0), 0);
  const approvedDrivers = drivers.filter(d => d.status === 'approved');
  const pendingDrivers = drivers.filter(d => d.status === 'pending');
  const recentTasks = tasks.slice(0, 8);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Dashboard Overview</h2>
          <p>Welcome back, {profile?.name || 'Supervisor'}</p>
        </div>
        <div className="page-header-actions">
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>
      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-value">{activeTasks.length}</div>
            <div className="stat-label">Active Tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{deliveredToday.length}</div>
            <div className="stat-label">Delivered Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🚚</div>
            <div className="stat-value">{activeTrips.length}</div>
            <div className="stat-label">Active Trips</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👤</div>
            <div className="stat-value">{approvedDrivers.length}</div>
            <div className="stat-label">Active Drivers</div>
            {pendingDrivers.length > 0 && <div className="stat-change negative">+{pendingDrivers.length} pending approval</div>}
          </div>
          <div className="stat-card">
            <div className="stat-icon">⛽</div>
            <div className="stat-value">{pendingFuel.length}</div>
            <div className="stat-label">Pending Fuel Claims</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">LKR {totalFuelCost.toLocaleString()}</div>
            <div className="stat-label">Total Fuel Spend</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Tasks</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tasks.length} total</span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Route</th>
                    <th>Status</th>
                    <th>Driver</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.recipientName}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.pickupLocation?.substring(0, 15)}.. → {t.deliveryLocation?.substring(0, 15)}..
                      </td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>{t.assignedDriverName || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{timeAgo(t.createdAt)}</td>
                    </tr>
                  ))}
                  {recentTasks.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No tasks yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Active Trips</div>
              {activeTrips.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No active trips right now</p>
              ) : (
                activeTrips.map(t => (
                  <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.driverName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Started {timeAgo(t.startTime)}</div>
                    </div>
                    <span className="badge badge-success">Active</span>
                  </div>
                ))
              )}
            </div>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Pending Fuel Claims</div>
              {pendingFuel.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No pending claims</p>
              ) : (
                pendingFuel.slice(0, 5).map(f => (
                  <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{f.driverName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>LKR {f.totalCost?.toFixed(0)} • {f.litres}L</div>
                    </div>
                    <span className="badge badge-warning">Pending</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'badge-default', label: 'Pending' },
    assigned: { cls: 'badge-info', label: 'Assigned' },
    accepted: { cls: 'badge-purple', label: 'Accepted' },
    in_progress: { cls: 'badge-warning', label: 'In Progress' },
    arrived: { cls: 'badge-info', label: 'Arrived' },
    delivered: { cls: 'badge-success', label: 'Delivered' },
    failed: { cls: 'badge-danger', label: 'Failed' },
  };
  const m = map[status] || { cls: 'badge-default', label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}
