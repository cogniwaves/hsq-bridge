/**
 * Material Design 3 Elevation System
 * Box shadows and elevation tokens for depth hierarchy
 */

// MD3 Elevation Levels
export const elevationLevels = {
  // Level 0 - Surface level (no elevation)
  level0: {
    boxShadow: 'none',
    zIndex: 0,
  },

  // Level 1 - Slight elevation (cards, buttons)
  level1: {
    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
    zIndex: 1,
  },

  // Level 2 - Medium elevation (raised cards, dropdowns)
  level2: {
    boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06)',
    zIndex: 2,
  },

  // Level 3 - Higher elevation (floating elements)
  level3: {
    boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)',
    zIndex: 3,
  },

  // Level 4 - High elevation (modals, tooltips)
  level4: {
    boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 4,
  },

  // Level 5 - Very high elevation (overlays, notifications)
  level5: {
    boxShadow: '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)',
    zIndex: 5,
  },
} as const;

// Dark theme specific elevations (lighter shadows for dark backgrounds)
export const darkElevationLevels = {
  level0: {
    boxShadow: 'none',
    zIndex: 0,
  },

  level1: {
    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.3)',
    zIndex: 1,
  },

  level2: {
    boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.4), 0px 1px 2px 0px rgba(0, 0, 0, 0.2)',
    zIndex: 2,
  },

  level3: {
    boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.4), 0px 2px 4px -1px rgba(0, 0, 0, 0.2)',
    zIndex: 3,
  },

  level4: {
    boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.4), 0px 4px 6px -2px rgba(0, 0, 0, 0.2)',
    zIndex: 4,
  },

  level5: {
    boxShadow: '0px 20px 25px -5px rgba(0, 0, 0, 0.5), 0px 10px 10px -5px rgba(0, 0, 0, 0.3)',
    zIndex: 5,
  },
} as const;

// Semantic elevation mappings for business components
export const semanticElevation = {
  // Base surface (default state)
  surface: elevationLevels.level0,
  
  // Cards and containers
  card: elevationLevels.level1,
  cardHover: elevationLevels.level2,
  cardRaised: elevationLevels.level2,
  
  // Interactive elements
  button: elevationLevels.level0, // Flat by default
  buttonHover: elevationLevels.level1,
  buttonPressed: elevationLevels.level0,
  
  // Navigation
  navbar: elevationLevels.level2,
  sidebar: elevationLevels.level1,
  
  // Overlays
  dropdown: elevationLevels.level3,
  modal: elevationLevels.level4,
  tooltip: elevationLevels.level4,
  popover: elevationLevels.level3,
  
  // Notifications
  toast: elevationLevels.level5,
  alert: elevationLevels.level1,
  
  // Data display
  table: elevationLevels.level0,
  tableRow: elevationLevels.level0,
  tableRowHover: elevationLevels.level1,
  
  // Forms
  input: elevationLevels.level0,
  inputFocus: elevationLevels.level1,
  
  // Status elements
  badge: elevationLevels.level0,
  chip: elevationLevels.level1,
} as const;

// Business-specific elevation utilities
export const businessElevation = {
  // Dashboard components
  dashboardCard: elevationLevels.level1,
  dashboardCardHover: elevationLevels.level2,
  metricsCard: elevationLevels.level1,
  statusCard: elevationLevels.level1,
  
  // Invoice and financial data
  invoiceCard: elevationLevels.level1,
  invoiceCardSelected: elevationLevels.level2,
  paymentCard: elevationLevels.level1,
  
  // System status
  healthCard: elevationLevels.level1,
  errorCard: elevationLevels.level2,
  warningCard: elevationLevels.level1,
  
  // Interactive panels
  syncPanel: elevationLevels.level1,
  syncPanelActive: elevationLevels.level2,
  queuePanel: elevationLevels.level1,
  
  // Modal and detail views
  invoiceModal: elevationLevels.level4,
  detailPanel: elevationLevels.level3,
  
  // Action elements
  actionButton: elevationLevels.level1,
  actionButtonHover: elevationLevels.level2,
  primaryAction: elevationLevels.level2,
  
  // Data tables
  tableHeader: elevationLevels.level1,
  tableCell: elevationLevels.level0,
  tableCellHover: elevationLevels.level1,
} as const;

// Focus and interaction states
export const interactionElevation = {
  // Focus states
  focus: {
    outline: '2px solid',
    outlineOffset: '2px',
    boxShadow: '0 0 0 3px rgba(0, 200, 150, 0.1)', // Emerald focus ring
  },
  
  // Hover states
  hover: {
    transform: 'translateY(-1px)',
    transition: 'all 0.2s ease-in-out',
  },
  
  // Pressed states
  pressed: {
    transform: 'translateY(0px)',
    transition: 'all 0.1s ease-in-out',
  },
  
  // Disabled states
  disabled: {
    opacity: '0.5',
    pointerEvents: 'none' as const,
    filter: 'grayscale(50%)',
  },
} as const;

// Utility types
export type ElevationLevel = keyof typeof elevationLevels;
export type SemanticElevationRole = keyof typeof semanticElevation;
export type BusinessElevationRole = keyof typeof businessElevation;

// Export unified elevation object
export const elevation = {
  light: elevationLevels,
  dark: darkElevationLevels,
  semantic: semanticElevation,
  business: businessElevation,
  interaction: interactionElevation,
} as const;

export default elevation;