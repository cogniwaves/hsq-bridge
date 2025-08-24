/**
 * Material Design 3 Spacing Scale
 * Consistent spacing system for layouts and components
 */

// Base spacing unit (4px)
const baseUnit = 4;

// MD3 Spacing Scale
export const spacing = {
  // Base units
  0: '0px',
  1: `${baseUnit * 1}px`, // 4px
  2: `${baseUnit * 2}px`, // 8px
  3: `${baseUnit * 3}px`, // 12px
  4: `${baseUnit * 4}px`, // 16px
  5: `${baseUnit * 5}px`, // 20px
  6: `${baseUnit * 6}px`, // 24px
  8: `${baseUnit * 8}px`, // 32px
  10: `${baseUnit * 10}px`, // 40px
  12: `${baseUnit * 12}px`, // 48px
  16: `${baseUnit * 16}px`, // 64px
  20: `${baseUnit * 20}px`, // 80px
  24: `${baseUnit * 24}px`, // 96px
  32: `${baseUnit * 32}px`, // 128px
  40: `${baseUnit * 40}px`, // 160px
  48: `${baseUnit * 48}px`, // 192px
  56: `${baseUnit * 56}px`, // 224px
  64: `${baseUnit * 64}px`, // 256px
} as const;

// Semantic spacing names
export const semanticSpacing = {
  // Component internal spacing
  xs: spacing[1], // 4px
  sm: spacing[2], // 8px
  md: spacing[4], // 16px
  lg: spacing[6], // 24px
  xl: spacing[8], // 32px
  xxl: spacing[12], // 48px

  // Layout spacing
  layoutXs: spacing[4], // 16px
  layoutSm: spacing[6], // 24px
  layoutMd: spacing[8], // 32px
  layoutLg: spacing[12], // 48px
  layoutXl: spacing[16], // 64px
  layoutXxl: spacing[24], // 96px

  // Section spacing
  sectionXs: spacing[8], // 32px
  sectionSm: spacing[12], // 48px
  sectionMd: spacing[16], // 64px
  sectionLg: spacing[20], // 80px
  sectionXl: spacing[24], // 96px

  // Container spacing
  containerPadding: spacing[6], // 24px
  containerPaddingMobile: spacing[4], // 16px
  containerMaxWidth: '1280px',
} as const;

// Business application specific spacing
export const businessSpacing = {
  // Dashboard layout
  dashboardPadding: spacing[6], // 24px
  dashboardGap: spacing[6], // 24px
  dashboardSection: spacing[8], // 32px

  // Cards and panels
  cardPadding: spacing[6], // 24px
  cardPaddingSmall: spacing[4], // 16px
  cardGap: spacing[4], // 16px
  cardBorderRadius: spacing[2], // 8px
  cardBorderRadiusLarge: spacing[3], // 12px

  // Form elements
  formFieldGap: spacing[4], // 16px
  formSectionGap: spacing[8], // 32px
  inputPadding: spacing[3], // 12px
  inputPaddingLarge: spacing[4], // 16px

  // Table spacing
  tablePadding: spacing[4], // 16px
  tableCellPadding: spacing[3], // 12px
  tableRowGap: spacing[1], // 4px

  // Navigation
  navPadding: spacing[4], // 16px
  navItemGap: spacing[2], // 8px
  navHeight: spacing[16], // 64px

  // Modal and overlay
  modalPadding: spacing[6], // 24px
  modalMaxWidth: '768px',
  modalBorderRadius: spacing[4], // 16px

  // Status and indicators
  badgePadding: spacing[2], // 8px
  badgePaddingHorizontal: spacing[3], // 12px
  statusIconSize: spacing[5], // 20px
  statusIconGap: spacing[2], // 8px

  // Interactive elements
  buttonPadding: spacing[3], // 12px
  buttonPaddingLarge: spacing[4], // 16px
  buttonGap: spacing[2], // 8px
  buttonBorderRadius: spacing[2], // 8px

  // Data visualization
  chartPadding: spacing[4], // 16px
  chartMargin: spacing[6], // 24px
  legendGap: spacing[2], // 8px
} as const;

// Responsive breakpoints (aligned with Tailwind for consistency)
export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Container queries and grid
export const grid = {
  columns: 12,
  gutterWidth: spacing[6], // 24px
  marginWidth: spacing[4], // 16px
  marginWidthLarge: spacing[6], // 24px
  maxWidth: '1280px',
} as const;

// Z-index scale for layering
export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  overlay: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
  top: 900,
} as const;

// Utility types
export type SpacingToken = keyof typeof spacing;
export type SemanticSpacingToken = keyof typeof semanticSpacing;
export type BusinessSpacingToken = keyof typeof businessSpacing;
export type Breakpoint = keyof typeof breakpoints;
export type ZIndexLevel = keyof typeof zIndex;

// Export unified spacing object
export const spacingTokens = {
  base: spacing,
  semantic: semanticSpacing,
  business: businessSpacing,
  breakpoints,
  grid,
  zIndex,
} as const;

export default spacingTokens;