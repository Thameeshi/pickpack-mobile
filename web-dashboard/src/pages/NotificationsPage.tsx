import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToNotifications, markAsRead, markAllAsRead } from '../services/notificationService';
import { AppNotification } from '../types';
import { CheckCheck, Bell } from 'lucide-react';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ICON_MAP: Record<string, string> = {
  task_assigned: '📦', task_accepted: '✅', task_rejected: '❌', task_completed: '🎉',
  trip_started: '🚚', trip_completed: '🏁', fuel_submitted: '⛽', fuel_approved: '💰',
  fuel_rejected: '🚫', chat_message: '💬', approval: '👤', general: '🔔',
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!profile?.uid) return;
    return subscribeToNotifications(profile.uid, setNotifications);
  }, [profile?.uid]);

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left"><h2>Notifications</h2><p>{unreadCount} unread</p></div>
        <div className="page-header-actions">
          {unreadCount > 0 && (
            <button className="btn btn-secondary" onClick={() => markAllAsRead(profile!.uid)}>
              <CheckCheck size={16} /> Mark All Read
            </button>
          )}
        </div>
      </div>
      <div className="page-content">
        <div className="tabs">
          <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All ({notifications.length})</button>
          <button className={`tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Unread ({unreadCount})</button>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔔</div>
            <h3>No notifications</h3>
            <p>{filter === 'unread' ? 'All caught up!' : 'Notifications will appear here.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(n => (
              <div key={n.id} className="card" style={{ cursor: 'pointer', borderLeft: n.read ? undefined : '3px solid var(--primary-light)', opacity: n.read ? 0.7 : 1 }}
                onClick={() => { if (!n.read && n.id) markAsRead(n.id); }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 24, lineHeight: 1 }}>{ICON_MAP[n.type] || '🔔'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt)}</div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{n.body}</div>
                    {n.senderName && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>From: {n.senderName}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
