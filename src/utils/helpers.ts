import { UserRole } from '../types';

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  return /^\+?[\d\s-]{7,15}$/.test(phone);
}

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 6) return { valid: false, message: 'Password must be at least 6 characters' };
  return { valid: true, message: '' };
}

export function canAccessDriverDashboard(role: UserRole): boolean {
  return role === 'driver';
}

export function canAccessSupervisorDashboard(role: UserRole): boolean {
  return role === 'supervisor' || role === 'superadmin';
}

export function canAccessAdminPanel(role: UserRole): boolean {
  return role === 'superadmin';
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateTime(timestamp: number): string {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

export function formatCurrency(amount: number, currency = 'LKR'): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
