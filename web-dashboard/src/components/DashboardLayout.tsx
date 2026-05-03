import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { subscribeToNotifications } from '../services/notificationService';
import { AppNotification } from '../types';
import { LayoutDashboard, Truck, ClipboardList, Navigation, Fuel, Users, Bell, LogOut, Menu, X, MapPin } from 'lucide-react';

export default function DashboardLayout() {
  const { profile, logout } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!profile?.uid) return;
    return subscribeToNotifications(profile.uid, setNotifications);
  }, [profile?.uid]);

  const isSuperAdmin = profile?.role === 'superadmin';

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">P</div>
          <h1>PickPack</h1>
          <button className="btn-ghost btn-icon" onClick={() => setSidebarOpen(false)} style={{ marginLeft: 'auto', display: sidebarOpen ? 'block' : 'none' }}>
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <LayoutDashboard size={20} /> Overview
          </NavLink>
          <NavLink to="/drivers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <Truck size={20} /> Drivers
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <ClipboardList size={20} /> Tasks
          </NavLink>
          <NavLink to="/trips" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <Navigation size={20} /> Trips
          </NavLink>
          <NavLink to="/fuel" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <Fuel size={20} /> Fuel Expenses
          </NavLink>
          <NavLink to="/live-map" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <MapPin size={20} /> Live Map
          </NavLink>
          <div className="nav-section-label">Management</div>
          <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <Bell size={20} /> Notifications
            {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
          </NavLink>
          {isSuperAdmin && (
            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <Users size={20} /> User Management
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-avatar">{profile?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{profile?.name || 'User'}</div>
            <div className="sidebar-user-role">{profile?.role}</div>
          </div>
          <button className="btn-ghost btn-icon" onClick={logout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <button className="btn-ghost btn-icon" onClick={() => setSidebarOpen(true)} style={{ position: 'fixed', top: 16, left: 16, zIndex: 99, display: 'none' }} id="mobile-menu-btn">
          <Menu size={22} />
        </button>
        <Outlet />
      </main>
    </div>
  );
}
