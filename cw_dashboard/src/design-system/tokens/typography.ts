/**
 * Material Design 3 Typography Scale
 * Professional typography system for business applications
 */

// MD3 Typography Scale
export const typographyScale = {
  // Display - Large, impactful headlines
  displayLarge: {
    fontSize: '57px',
    lineHeight: '64px',
    fontWeight: '400',
    letterSpacing: '-0.25px',
  },
  displayMedium: {
    fontSize: '45px',
    lineHeight: '52px',
    fontWeight: '400',
    letterSpacing: '0px',
  },
  displaySmall: {
    fontSize: '36px',
    lineHeight: '44px',
    fontWeight: '400',
    letterSpacing: '0px',
  },

  // Headline - High-emphasis text
  headlineLarge: {
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: '400',
    letterSpacing: '0px',
  },
  headlineMedium: {
    fontSize: '28px',
    lineHeight: '36px',
    fontWeight: '400',
    letterSpacing: '0px',
  },
  headlineSmall: {
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: '400',
    letterSpacing: '0px',
  },

  // Title - Medium-emphasis text
  titleLarge: {
    fontSize: '22px',
    lineHeight: '28px',
    fontWeight: '400',
    letterSpacing: '0px',
  },
  titleMedium: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: '500',
    letterSpacing: '0.15px',
  },
  titleSmall: {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: '500',
    letterSpacing: '0.1px',
  },

  // Label - Text for components
  labelLarge: {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: '500',
    letterSpacing: '0.1px',
  },
  labelMedium: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: '500',
    letterSpacing: '0.5px',
  },
  labelSmall: {
    fontSize: '11px',
    lineHeight: '16px',
    fontWeight: '500',
    letterSpacing: '0.5px',
  },

  // Body - Reading text
  bodyLarge: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: '400',
    letterSpacing: '0.5px',
  },
  bodyMedium: {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: '400',
    letterSpacing: '0.25px',
  },
  bodySmall: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: '400',
    letterSpacing: '0.4px',
  },
} as const;

// Font families
export const fontFamilies = {
  primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  monospace: '"JetBrains Mono", "SF Mono", Monaco, Inconsolata, "Roboto Mono", Consolas, monospace',
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

// Font weights
export const fontWeights = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// Business-specific typography roles
export const businessTypography = {
  // Dashboard specific
  dashboardTitle: {
    ...typographyScale.headlineMedium,
    fontWeight: fontWeights.semibold,
  },
  sectionTitle: {
    ...typographyScale.titleLarge,
    fontWeight: fontWeights.medium,
  },
  cardTitle: {
    ...typographyScale.titleMedium,
    fontWeight: fontWeights.medium,
  },
  
  // Data display
  metric: {
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: fontWeights.semibold,
    letterSpacing: '0px',
  },
  metricLabel: {
    ...typographyScale.labelMedium,
    textTransform: 'uppercase' as const,
  },
  
  // Financial data
  currency: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: fontWeights.medium,
    fontFamily: fontFamilies.monospace,
    letterSpacing: '0px',
  },
  currencyLarge: {
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: fontWeights.semibold,
    fontFamily: fontFamilies.monospace,
    letterSpacing: '0px',
  },
  
  // Status and indicators
  status: {
    ...typographyScale.labelSmall,
    fontWeight: fontWeights.medium,
    textTransform: 'uppercase' as const,
  },
  badge: {
    ...typographyScale.labelSmall,
    fontWeight: fontWeights.medium,
  },
  
  // Table and list content
  tableHeader: {
    ...typographyScale.labelMedium,
    fontWeight: fontWeights.medium,
    textTransform: 'uppercase' as const,
  },
  tableCell: {
    ...typographyScale.bodyMedium,
  },
  listItem: {
    ...typographyScale.bodyMedium,
  },
  
  // Interactive elements
  button: {
    ...typographyScale.labelLarge,
    fontWeight: fontWeights.medium,
  },
  link: {
    ...typographyScale.bodyMedium,
    fontWeight: fontWeights.medium,
  },
  
  // Forms
  inputLabel: {
    ...typographyScale.labelMedium,
    fontWeight: fontWeights.medium,
  },
  inputText: {
    ...typographyScale.bodyLarge,
  },
  helperText: {
    ...typographyScale.bodySmall,
  },
  
  // Navigation
  navItem: {
    ...typographyScale.labelLarge,
    fontWeight: fontWeights.medium,
  },
  breadcrumb: {
    ...typographyScale.bodySmall,
  },
} as const;

// Utility types
export type TypographyToken = keyof typeof typographyScale;
export type BusinessTypographyRole = keyof typeof businessTypography;
export type FontFamily = keyof typeof fontFamilies;
export type FontWeight = keyof typeof fontWeights;

// Export unified typography object
export const typography = {
  scale: typographyScale,
  families: fontFamilies,
  weights: fontWeights,
  business: businessTypography,
} as const;

export default typography;