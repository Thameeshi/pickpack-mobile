import { useEffect, useState } from 'react';
import { subscribeToFuelExpenses, updateFuelExpenseStatus } from '../services/fuelService';
import { FuelExpense } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Search, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

export default function FuelPage() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<FuelExpense[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => { return subscribeToFuelExpenses(setExpenses); }, []);

  const filtered = expenses.filter(f => {
    if (filter !== 'all' && f.status !== filter) return false;
    if (search) return f.driverName?.toLowerCase().includes(search.toLowerCase()) || f.stationName?.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const totalCost = expenses.reduce((s, f) => s + (f.totalCost || 0), 0);
  const totalLitres = expenses.reduce((s, f) => s + (f.litres || 0), 0);
  const pendingCount = expenses.filter(f => f.status === 'pending').length;
  const approvedCount = expenses.filter(f => f.status === 'approved').length;

  const handleApprove = async (id: string) => { await updateFuelExpenseStatus(id, 'approved', profile?.uid); };
  const handleReject = async (id: string) => { await updateFuelExpenseStatus(id, 'rejected', profile?.uid); };

  return (
    <>
      <div className="page-header"><div className="page-header-left"><h2>Fuel Expenses</h2><p>{expenses.length} total records</p></div></div>
      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon">💰</div><div className="stat-value">LKR {totalCost.toLocaleString()}</div><div className="stat-label">Total Spend</div></div>
          <div className="stat-card"><div className="stat-icon">⛽</div><div className="stat-value">{totalLitres.toFixed(1)}</div><div className="stat-label">Total Litres</div></div>
          <div className="stat-card"><div className="stat-icon">⏳</div><div className="stat-value">{pendingCount}</div><div className="stat-label">Pending Approval</div></div>
          <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-value">{approvedCount}</div><div className="stat-label">Approved</div></div>
        </div>
        <div className="filters-row">
          <div className="search-box"><Search size={16} /><input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          {['all', 'pending', 'approved', 'rejected'].map(f => (
            <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Driver</th><th>Date</th><th>Station</th><th>Fuel</th><th>Litres</th><th>Total</th><th>Status</th><th>Receipt</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.driverName}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{f.date}</td>
                  <td>{f.stationName || '—'}</td>
                  <td><span className={`badge ${f.fuelType === 'diesel' ? 'badge-info' : 'badge-warning'}`}>{f.fuelType}</span></td>
                  <td>{f.litres}L</td>
                  <td style={{ fontWeight: 600 }}>LKR {f.totalCost?.toFixed(0)}</td>
                  <td><span className={`badge ${f.status === 'approved' ? 'badge-success' : f.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>{f.status}</span></td>
                  <td>{f.receiptUrl ? <a href={f.receiptUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink size={13} />View</a> : '—'}</td>
                  <td>
                    {f.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(f.id!)}><CheckCircle size={13} /> Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(f.id!)}><XCircle size={13} /> Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No fuel expenses found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
