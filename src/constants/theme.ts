// PickPack Design System — Brand Colors: Maroon & Gold
export const COLORS = {
  // Brand — Primary (Deep Maroon)
  PRIMARY: '#6F0A17',        // Deep maroon — headers, CTA, primary actions
  PRIMARY_LIGHT: '#9B1B2A',  // Lighter maroon — hover/focus states
  PRIMARY_DARK: '#4A0710',   // Darker maroon — pressed states
  SECONDARY: '#8B1A2B',      // Mid maroon — secondary elements
  ACCENT: '#F3CC2F',         // Golden yellow — highlights, badges, accents

  // Brand tints (for backgrounds / subtle highlights)
  PRIMARY_TINT: '#FFF0F1',   // Very light pink-maroon tint
  ACCENT_TINT: '#FFFBE6',    // Very light gold tint
  ACCENT_DARK: '#D4AD0F',    // Darker gold for text on light backgrounds

  // Status
  SUCCESS: '#0D9F6E',        // Emerald green
  WARNING: '#E5A100',        // Deep amber
  DANGER: '#DC2626',         // Red
  INFO: '#0284C7',           // Sky blue

  // Neutrals
  WHITE: '#FFFFFF',
  BLACK: '#1A1A1A',
  BG_PRIMARY: '#FAFAF8',     // Warm off-white
  BG_SECONDARY: '#F5F3EF',   // Warm cream
  BORDER: '#E8E4DD',         // Warm border
  BORDER_LIGHT: '#F0ECE6',   // Light warm border

  // Gray scale (warm-tinted)
  GRAY_50: '#FAFAF8',
  GRAY_100: '#F5F3EF',
  GRAY_200: '#E8E4DD',
  GRAY_300: '#D1CBC1',
  GRAY_400: '#A39E95',
  GRAY_500: '#6D675E',
  GRAY_600: '#4D4842',
  GRAY_700: '#3A362F',
  GRAY_800: '#262320',
  GRAY_900: '#1A1815',

  // Task priority
  PRIORITY_HIGH: '#DC2626',
  PRIORITY_MEDIUM: '#E5A100',
  PRIORITY_LOW: '#0D9F6E',

  // Approval status
  STATUS_PENDING: '#E5A100',
  STATUS_APPROVED: '#0D9F6E',
  STATUS_REJECTED: '#DC2626',
  STATUS_SUSPENDED: '#6D675E',
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
  MD: 10,
  LG: 14,
  XL: 20,
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
    shadowColor: '#6F0A17',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  MD: {
    shadowColor: '#6F0A17',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  LG: {
    shadowColor: '#6F0A17',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
