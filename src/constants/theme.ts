// PickPack Design System — Colors, Spacing, Typography
export const COLORS = {
  // Brand
  PRIMARY: '#1E40AF',        // Deep blue
  PRIMARY_LIGHT: '#3B82F6',  // Lighter blue
  PRIMARY_DARK: '#1E3A8A',   // Darker blue
  SECONDARY: '#7C3AED',     // Purple accent
  ACCENT: '#F59E0B',        // Amber/gold

  // Status
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
  INFO: '#3B82F6',

  // Neutrals
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  BG_PRIMARY: '#F8FAFC',
  BG_SECONDARY: '#F1F5F9',
  BORDER: '#E2E8F0',
  BORDER_LIGHT: '#F1F5F9',

  // Gray scale
  GRAY_50: '#F8FAFC',
  GRAY_100: '#F1F5F9',
  GRAY_200: '#E2E8F0',
  GRAY_300: '#CBD5E1',
  GRAY_400: '#94A3B8',
  GRAY_500: '#64748B',
  GRAY_600: '#475569',
  GRAY_700: '#334155',
  GRAY_800: '#1E293B',
  GRAY_900: '#0F172A',

  // Task priority
  PRIORITY_HIGH: '#DC2626',
  PRIORITY_MEDIUM: '#F59E0B',
  PRIORITY_LOW: '#10B981',

  // Approval status
  STATUS_PENDING: '#F59E0B',
  STATUS_APPROVED: '#10B981',
  STATUS_REJECTED: '#EF4444',
  STATUS_SUSPENDED: '#6B7280',
} as const;

export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 24,
  XXL: 32,
  XXXL: 48,
} as const;

export const RADIUS = {
  SM: 6,
  MD: 8,
  LG: 12,
  XL: 16,
  FULL: 999,
} as const;

export const FONT_SIZES = {
  XS: 10,
  SM: 12,
  MD: 14,
  LG: 16,
  XL: 18,
  XXL: 24,
  XXXL: 32,
  DISPLAY: 40,
} as const;

export const SHADOWS = {
  SM: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  MD: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  LG: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;
