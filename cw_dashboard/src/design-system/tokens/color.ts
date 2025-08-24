/**
 * Material Design 3 Color System
 * Professional palette for HubSpot Bridge Dashboard
 * Dark theme avoids all blue colors as requested
 */

// Light Theme Colors - Enhanced Orange Palette
export const lightTheme = {
  // Primary - Rich Orange (C15301 variant for light theme)
  primary: '#C15301',
  onPrimary: '#FFFFFF',
  primaryContainer: '#FFE0CC',
  onPrimaryContainer: '#2A1100',

  // Secondary - Rich Amber Business Orange
  secondary: '#FF7700',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#FFD9B3',
  onSecondaryContainer: '#4D1F00',

  // Tertiary - Deep Warm Gold (premium, sophisticated orange)
  tertiary: '#B8860B',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F5E6A3',
  onTertiaryContainer: '#2D2200',

  // Error - Orange-tinted Red (maintains readability)
  error: '#D42B00',
  onError: '#FFFFFF',
  errorContainer: '#FFE6E0',
  onErrorContainer: '#4D1100',

  // Success - Warm Green (orange undertones)
  success: '#669900',
  onSuccess: '#FFFFFF',
  successContainer: '#E6F2CC',
  onSuccessContainer: '#1A2600',

  // Warning - Pure Orange
  warning: '#CC4400',
  onWarning: '#FFFFFF',
  warningContainer: '#FFE6D9',
  onWarningContainer: '#4D1F00',

  // Surface Colors
  surface: '#FFFFFF',
  onSurface: '#1C1B1F',
  surfaceVariant: '#F3F4F6',
  onSurfaceVariant: '#49454F',
  surfaceContainer: '#F9FAFB',
  surfaceContainerHigh: '#F3F4F6',
  surfaceContainerHighest: '#E5E7EB',

  // Background
  background: '#FEFEFE',
  onBackground: '#1C1B1F',

  // Outline & Border
  outline: '#D1D5DB',
  outlineVariant: '#E5E7EB',

  // Inverse
  inverseSurface: '#313033',
  inverseOnSurface: '#F4EFF4',
  inversePrimary: '#00C896',
} as const;

// Dark Theme Colors - Enhanced Orange Palette (Blue-free, B component always #00)
export const darkTheme = {
  // Primary - Rich Orange (#c15301 base)
  primary: '#C15301',
  onPrimary: '#FFFFFF',
  primaryContainer: '#8B3A00',
  onPrimaryContainer: '#FFE0CC',

  // Secondary - Complementary Orange
  secondary: '#E66A00',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#A34700',
  onSecondaryContainer: '#FFD1B3',

  // Tertiary - Warm Orange Gold
  tertiary: '#CC5500',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#994000',
  onTertiaryContainer: '#FFCCB3',

  // Error - Intense Orange-Red (no blue component)
  error: '#FF5500',
  onError: '#2D1000',
  errorContainer: '#4D1B00',
  onErrorContainer: '#FFB399',

  // Success - Orange-warm Green (no blue component)
  success: '#88BB00',
  onSuccess: '#1D2600',
  successContainer: '#2E3D00',
  onSuccessContainer: '#CCDD80',

  // Warning - Enhanced Pure Orange (no blue component)
  warning: '#FF7700',
  onWarning: '#2D1800',
  warningContainer: '#4D2800',
  onWarningContainer: '#FFBB80',

  // Surface - Warm Black with Orange Undertones (no blue component)
  surface: '#1A0F00',
  onSurface: '#FFD700',
  surfaceVariant: '#0F0A00',
  onSurfaceVariant: '#E6C200',
  surfaceContainer: '#0A0500',
  surfaceContainerHigh: '#000000',
  surfaceContainerHighest: '#000000',

  // Background - Completely Black
  background: '#000000',
  onBackground: '#FFD700',

  // Outline - Orange-Gold tinted (no blue component)
  outline: '#B8860B',
  outlineVariant: '#665500',

  // Inverse
  inverseSurface: '#FFD700',
  inverseOnSurface: '#332200',
  inversePrimary: '#CC5500',
} as const;

// Semantic Color Mappings for Business Application
export const semanticColors = {
  light: {
    // Status Colors (Business appropriate with orange enhancement)
    status: {
      healthy: lightTheme.success,
      degraded: lightTheme.warning,
      unhealthy: lightTheme.error,
      pending: '#996633', // Warm neutral (orange-tinted)
      synced: lightTheme.success,
      failed: lightTheme.error,
    },
    
    // Data Visualization (Enhanced Orange Palette)
    chart: {
      primary: lightTheme.primary,
      secondary: lightTheme.secondary,
      tertiary: lightTheme.tertiary,
      accent1: '#669900', // Orange-warm green
      accent2: '#E63300', // Orange-red
      accent3: '#CC7700', // Deep orange
    },

    // Interactive Elements (Orange-Enhanced)
    interactive: {
      primary: lightTheme.primary,
      secondary: lightTheme.secondary,
      hover: '#993300', // Darker orange
      focus: lightTheme.primary,
      disabled: '#A3A399', // Warm neutral gray
    },

    // Typography (Warm Orange Undertones)
    text: {
      primary: lightTheme.onSurface,
      secondary: '#806B55', // Warm brown-orange
      tertiary: '#A3996B', // Warm neutral
      inverse: lightTheme.onPrimary,
    },
  },

  dark: {
    // Status Colors (Business appropriate, enhanced orange, no blue)
    status: {
      healthy: darkTheme.success,
      degraded: darkTheme.warning,
      unhealthy: darkTheme.error,
      pending: '#BB7700', // Orange neutral (no blue)
      synced: darkTheme.success,
      failed: darkTheme.error,
    },
    
    // Data Visualization (Enhanced Orange Palette, no blue components)
    chart: {
      primary: darkTheme.primary,
      secondary: darkTheme.secondary,
      tertiary: darkTheme.tertiary,
      accent1: '#88BB00', // Orange-warm green
      accent2: '#FF5500', // Intense orange
      accent3: '#DD8800', // Rich orange-gold
    },

    // Interactive Elements (C15301 base, no blue components)
    interactive: {
      primary: darkTheme.primary,
      secondary: darkTheme.secondary,
      hover: '#E66A00', // Brighter orange hover
      focus: darkTheme.primary,
      disabled: '#804000', // Orange-tinted disabled
    },

    // Typography (Enhanced Orange-Gold Fonts)
    text: {
      primary: '#FFCC66', // Warm orange-gold
      secondary: '#E6AA33', // Rich orange-amber
      tertiary: '#CC8800', // Deep orange-amber
      inverse: darkTheme.onPrimary,
    },
  },
} as const;

// Color utility types
export type ThemeMode = 'light' | 'dark';
export type ColorToken = keyof typeof lightTheme;
export type SemanticColorCategory = keyof typeof semanticColors.light;

// Export unified theme object
export const colorTokens = {
  light: lightTheme,
  dark: darkTheme,
  semantic: semanticColors,
} as const;

export default colorTokens;