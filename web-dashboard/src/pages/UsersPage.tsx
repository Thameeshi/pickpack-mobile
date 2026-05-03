import { useEffect, useState } from 'react';
import { getAllUsers, updateUserStatus, updateUserRole } from '../services/userService';
import { UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Search, Shield, ShieldCheck, X } from 'lucide-react';

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => { setLoading(true); const u = await getAllUsers(); setUsers(u); setLoading(false); };
  useEffect(() => { refresh(); }, []);

  if (profile?.role !== 'superadmin') {
    return (
      <><div className="page-header"><div className="page-header-left"><h2>User Management</h2></div></div>
      <div className="page-content"><div className="empty-state"><div className="empty-state-icon">🔒</div><h3>Access Denied</h3><p>Only super admins can manage users.</p></div></div></>
    );
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) { const s = search.toLowerCase(); return u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s); }
    return true;
  });

  const handleRoleChange = async (uid: string, role: UserProfile['role']) => {
    await updateUserRole(uid, role); refresh();
  };
  const handleStatusChange = async (uid: string, status: UserProfile['status']) => {
    await updateUserStatus(uid, status, profile?.uid); refresh();
  };

  return (
    <>
      <div className="page-header"><div className="page-header-left"><h2>User Management</h2><p>{users.length} total users</p></div></div>
      <div className="page-content">
        <div className="filters-row">
          <div className="search-box"><Search size={16} /><input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          {['all', 'superadmin', 'supervisor', 'driver'].map(f => (
            <button key={f} className={`filter-chip ${roleFilter === f ? 'active' : ''}`} onClick={() => setRoleFilter(f)}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Phone</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.uid}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: u.role === 'superadmin' ? 'var(--secondary)' : u.role === 'supervisor' ? 'var(--primary)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'white' }}>{u.name?.[0]?.toUpperCase() || 'U'}</div>
                      <div><div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{u.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div></div>
                    </div>
                  </td>
                  <td>
                    <select className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12, background: 'transparent' }} value={u.role} onChange={e => handleRoleChange(u.uid, e.target.value as any)} disabled={u.uid === profile.uid}>
                      <option value="driver">Driver</option><option value="supervisor">Supervisor</option><option value="superadmin">Super Admin</option>
                    </select>
                  </td>
                  <td><span className={`badge ${u.status === 'approved' ? 'badge-success' : u.status === 'pending' ? 'badge-warning' : u.status === 'suspended' ? 'badge-default' : 'badge-danger'}`}>{u.status}</span></td>
                  <td>{u.phone || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {u.status === 'pending' && <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(u.uid, 'approved')}>Approve</button>}
                      {u.status === 'approved' && u.uid !== profile.uid && <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(u.uid, 'suspended')}>Suspend</button>}
                      {u.status === 'suspended' && <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(u.uid, 'approved')}>Reactivate</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
