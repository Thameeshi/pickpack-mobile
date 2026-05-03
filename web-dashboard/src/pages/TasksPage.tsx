import { useEffect, useState } from 'react';
import { subscribeToTasks, createTask, assignTaskToDriver, updateTask, deleteTask } from '../services/taskService';
import { getDrivers } from '../services/userService';
import { Task, UserProfile, TaskStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, X, Trash2, UserPlus } from 'lucide-react';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'badge-default', label: 'Pending' },
  assigned: { cls: 'badge-info', label: 'Assigned' },
  accepted: { cls: 'badge-purple', label: 'Accepted' },
  in_progress: { cls: 'badge-warning', label: 'In Progress' },
  arrived: { cls: 'badge-info', label: 'Arrived' },
  delivered: { cls: 'badge-success', label: 'Delivered' },
  failed: { cls: 'badge-danger', label: 'Failed' },
};

export default function TasksPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [drivers, setDrivers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<Task | null>(null);
  const [showDetail, setShowDetail] = useState<Task | null>(null);

  useEffect(() => {
    const unsub = subscribeToTasks(setTasks);
    getDrivers().then(d => setDrivers(d.filter(x => x.status === 'approved')));
    return unsub;
  }, []);

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (t.recipientName?.toLowerCase().includes(s) || t.pickupLocation?.toLowerCase().includes(s) || t.deliveryLocation?.toLowerCase().includes(s) || t.assignedDriverName?.toLowerCase().includes(s));
    }
    return true;
  });

  const statusCounts = tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Tasks</h2>
          <p>{tasks.length} total tasks</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Create Task</button>
        </div>
      </div>
      <div className="page-content">
        <div className="filters-row">
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {['all', 'pending', 'assigned', 'accepted', 'in_progress', 'delivered', 'failed'].map(f => (
            <button key={f} className={`filter-chip ${statusFilter === f ? 'active' : ''}`} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All' : STATUS_MAP[f]?.label || f} {f !== 'all' && statusCounts[f] ? `(${statusCounts[f]})` : ''}
            </button>
          ))}
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Recipient</th><th>Pickup</th><th>Delivery</th><th>Status</th><th>Priority</th><th>Driver</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(t => {
                const sm = STATUS_MAP[t.status] || { cls: 'badge-default', label: t.status };
                const prioMap: Record<string, string> = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', LOW: 'badge-success' };
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.recipientName}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.pickupLocation}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.deliveryLocation}</td>
                    <td><span className={`badge ${sm.cls}`}>{sm.label}</span></td>
                    <td><span className={`badge ${prioMap[t.priority] || 'badge-default'}`}>{t.priority}</span></td>
                    <td>{t.assignedDriverName || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{timeAgo(t.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowDetail(t)}>View</button>
                        {!t.assignedDriverId && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setShowAssign(t)}><UserPlus size={13} /></button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm('Delete this task?')) { await deleteTask(t.id!); }}}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No tasks found</td></tr>}
            </tbody>
          </table>
        </div>

        {showCreate && <CreateTaskModal drivers={drivers} supervisorId={profile?.uid || ''} supervisorName={profile?.name || ''} onClose={() => setShowCreate(false)} />}
        {showAssign && <AssignModal task={showAssign} drivers={drivers} onClose={() => setShowAssign(null)} />}
        {showDetail && <TaskDetailModal task={showDetail} onClose={() => setShowDetail(null)} />}
      </div>
    </>
  );
}

function CreateTaskModal({ drivers, supervisorId, supervisorName, onClose }: { drivers: UserProfile[]; supervisorId: string; supervisorName: string; onClose: () => void }) {
  const [form, setForm] = useState({ pickupLocation: '', deliveryLocation: '', recipientName: '', recipientPhone: '', description: '', priority: 'MEDIUM' as any, assignedDriverId: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const driver = drivers.find(d => d.uid === form.assignedDriverId);
    await createTask({ ...form, supervisorId, supervisorName, assignedDriverName: driver?.name || '' });
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Create New Task</h3><button className="btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Pickup Location *</label><input className="form-input" required value={form.pickupLocation} onChange={e => setForm(p => ({ ...p, pickupLocation: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Delivery Location *</label><input className="form-input" required value={form.deliveryLocation} onChange={e => setForm(p => ({ ...p, deliveryLocation: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Recipient Name *</label><input className="form-input" required value={form.recipientName} onChange={e => setForm(p => ({ ...p, recipientName: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Recipient Phone *</label><input className="form-input" required value={form.recipientPhone} onChange={e => setForm(p => ({ ...p, recipientPhone: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Priority</label><select className="form-select" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></div>
              <div className="form-group"><label className="form-label">Assign Driver</label><select className="form-select" value={form.assignedDriverId} onChange={e => setForm(p => ({ ...p, assignedDriverId: e.target.value }))}><option value="">Unassigned</option>{drivers.map(d => <option key={d.uid} value={d.uid}>{d.name}</option>)}</select></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Task'}</button></div>
        </form>
      </div>
    </div>
  );
}

function AssignModal({ task, drivers, onClose }: { task: Task; drivers: UserProfile[]; onClose: () => void }) {
  const [driverId, setDriverId] = useState('');
  const handleAssign = async () => {
    const driver = drivers.find(d => d.uid === driverId);
    if (driver) { await assignTaskToDriver(task.id!, driverId, driver.name); onClose(); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header"><h3>Assign Driver</h3><button className="btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Assign a driver to: <strong>{task.recipientName}</strong></p>
          <select className="form-select" value={driverId} onChange={e => setDriverId(e.target.value)}>
            <option value="">Select a driver...</option>
            {drivers.map(d => <option key={d.uid} value={d.uid}>{d.name} — {d.vehiclePlate || 'No plate'}</option>)}
          </select>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleAssign} disabled={!driverId}>Assign</button></div>
      </div>
    </div>
  );
}

function TaskDetailModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const sm = STATUS_MAP[task.status] || { cls: 'badge-default', label: task.status };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header"><h3>Task Details</h3><button className="btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span className={`badge ${sm.cls}`}>{sm.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {task.id?.substring(0, 8)}</span>
          </div>
          <div className="driver-detail-card">
            <div className="detail-field"><label>Recipient</label><p>{task.recipientName}</p></div>
            <div className="detail-field"><label>Phone</label><p>{task.recipientPhone}</p></div>
            <div className="detail-field"><label>Pickup</label><p>{task.pickupLocation}</p></div>
            <div className="detail-field"><label>Delivery</label><p>{task.deliveryLocation}</p></div>
            <div className="detail-field"><label>Driver</label><p>{task.assignedDriverName || 'Unassigned'}</p></div>
            <div className="detail-field"><label>Priority</label><p>{task.priority}</p></div>
            {task.description && <div className="detail-field" style={{ gridColumn: '1/-1' }}><label>Description</label><p>{task.description}</p></div>}
            {task.proofOfDeliveryUrl && <div className="detail-field"><label>Proof of Delivery</label><p><a href={task.proofOfDeliveryUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)' }}>View Photo</a></p></div>}
            {task.signatureUrl && <div className="detail-field"><label>Signature</label><p><a href={task.signatureUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)' }}>View Signature</a></p></div>}
            {task.rejectedReason && <div className="detail-field" style={{ gridColumn: '1/-1' }}><label>Rejection Reason</label><p style={{ color: 'var(--danger)' }}>{task.rejectedReason}</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
