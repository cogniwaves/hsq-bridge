/**
 * Material Design 3 Navigation Design Tokens
 * Comprehensive navigation system for HSQ Bridge Dashboard
 * Integrates with existing orange/amber theme and MD3 principles
 */

import { colorTokens } from './color';
import { spacingTokens } from './spacing';
import { typography } from './typography';
import { elevation } from './elevation';
import { motion } from './motion';

// Navigation Layout Constants
export const navigationLayout = {
  // Rail (collapsed) state
  rail: {
    width: '80px',
    iconSize: '24px',
    itemHeight: '64px',
    headerHeight: '80px',
    bottomPadding: '16px',
  },
  
  // Drawer (expanded) state
  drawer: {
    width: '280px',
    iconSize: '24px',
    itemHeight: '56px',
    headerHeight: '80px',
    bottomPadding: '24px',
  },
  
  // Modal (mobile) state
  modal: {
    width: '320px',
    maxWidth: '85vw',
    iconSize: '24px',
    itemHeight: '56px',
    headerHeight: '72px',
    backdropOpacity: '0.6',
  },
} as const;

// Navigation Surface Colors (MD3 Surface Tinting)
export const navigationSurfaces = {
  light: {
    // Rail surface (minimal treatment)
    rail: {
      background: colorTokens.light.surface,
      border: colorTokens.light.outlineVariant,
      overlay: 'rgba(193, 83, 1, 0.02)', // Subtle primary tint
    },
    
    // Drawer surface (elevated treatment)
    drawer: {
      background: colorTokens.light.surfaceContainer,
      border: colorTokens.light.outlineVariant,
      overlay: 'rgba(193, 83, 1, 0.03)',
    },
    
    // Modal surface (highest treatment)
    modal: {
      background: colorTokens.light.surfaceContainerHigh,
      border: colorTokens.light.outline,
      overlay: 'rgba(193, 83, 1, 0.04)',
      backdrop: 'rgba(28, 27, 31, 0.6)', // onSurface with opacity
    },
  },
  
  dark: {
    // Rail surface (warm black with orange undertones)
    rail: {
      background: colorTokens.dark.surface,
      border: colorTokens.dark.outlineVariant,
      overlay: 'rgba(193, 83, 1, 0.08)', // More prominent in dark
    },
    
    // Drawer surface (elevated warm treatment)
    drawer: {
      background: colorTokens.dark.surfaceContainer,
      border: colorTokens.dark.outline,
      overlay: 'rgba(193, 83, 1, 0.12)',
    },
    
    // Modal surface (highest elevation)
    modal: {
      background: colorTokens.dark.surfaceContainerHigh,
      border: colorTokens.dark.outline,
      overlay: 'rgba(193, 83, 1, 0.15)',
      backdrop: 'rgba(0, 0, 0, 0.8)', // Pure black backdrop
    },
  },
} as const;

// Navigation Elevation System (extends base elevation)
export const navigationElevation = {
  light: {
    rail: {
      ...elevation.light.level1,
      borderRight: `1px solid ${navigationSurfaces.light.rail.border}`,
    },
    drawer: {
      ...elevation.light.level2,
      borderRight: `1px solid ${navigationSurfaces.light.drawer.border}`,
    },
    modal: {
      ...elevation.light.level5,
      border: `1px solid ${navigationSurfaces.light.modal.border}`,
    },
    
    // Navigation item states
    itemDefault: elevation.light.level0,
    itemHover: {
      ...elevation.light.level1,
      transform: 'none', // Override base hover transform
    },
    itemActive: elevation.light.level0,
    itemFocused: {
      ...elevation.light.level0,
      outline: `2px solid ${colorTokens.light.primary}`,
      outlineOffset: '-2px',
    },
  },
  
  dark: {
    rail: {
      ...elevation.dark.level1,
      borderRight: `1px solid ${navigationSurfaces.dark.rail.border}`,
    },
    drawer: {
      ...elevation.dark.level2,
      borderRight: `1px solid ${navigationSurfaces.dark.drawer.border}`,
    },
    modal: {
      ...elevation.dark.level5,
      border: `1px solid ${navigationSurfaces.dark.modal.border}`,
    },
    
    // Navigation item states
    itemDefault: elevation.dark.level0,
    itemHover: {
      ...elevation.dark.level1,
      transform: 'none',
    },
    itemActive: elevation.dark.level0,
    itemFocused: {
      ...elevation.dark.level0,
      outline: `2px solid ${colorTokens.dark.primary}`,
      outlineOffset: '-2px',
    },
  },
} as const;

// Navigation Spacing Tokens (responsive and semantic)
export const navigationSpacing = {
  // Container spacing for different states
  container: {
    rail: {
      padding: spacingTokens.base[2], // 8px
      itemPadding: spacingTokens.base[3], // 12px
      itemGap: spacingTokens.base[1], // 4px
    },
    drawer: {
      padding: spacingTokens.base[4], // 16px
      itemPadding: spacingTokens.base[4], // 16px
      itemGap: spacingTokens.base[1], // 4px
    },
    modal: {
      padding: spacingTokens.base[6], // 24px
      itemPadding: spacingTokens.base[4], // 16px
      itemGap: spacingTokens.base[2], // 8px
    },
  },
  
  // Navigation item internal spacing
  item: {
    // Icon to text spacing
    iconToText: spacingTokens.base[3], // 12px
    iconToTextRail: spacingTokens.base[0], // 0px (no text in rail)
    
    // Vertical padding within items
    verticalPadding: spacingTokens.base[3], // 12px
    horizontalPadding: spacingTokens.base[4], // 16px
    
    // Badge positioning
    badgeOffset: spacingTokens.base[2], // 8px
    badgeSpacing: spacingTokens.base[1], // 4px
  },
  
  // Section and group spacing
  section: {
    // Section header spacing
    headerMarginTop: spacingTokens.base[6], // 24px
    headerMarginBottom: spacingTokens.base[2], // 8px
    headerPaddingHorizontal: spacingTokens.base[4], // 16px
    
    // Divider spacing
    dividerMargin: spacingTokens.base[4], // 16px
    
    // Group spacing between sections
    groupGap: spacingTokens.base[6], // 24px
  },
  
  // User profile area spacing
  userProfile: {
    marginTop: 'auto', // Push to bottom
    paddingTop: spacingTokens.base[6], // 24px
    borderTopMargin: spacingTokens.base[4], // 16px
    avatarToText: spacingTokens.base[3], // 12px
    infoGap: spacingTokens.base[1], // 4px
  },
} as const;

// Navigation Typography (extends base typography)
export const navigationTypography = {
  // Navigation item labels
  item: {
    primary: {
      ...typography.business.navItem,
      fontSize: '14px', // Slightly larger for navigation
      lineHeight: '20px',
    },
    rail: {
      // Hidden in rail mode, but defined for consistency
      ...typography.business.navItem,
      fontSize: '0px',
      lineHeight: '0px',
      overflow: 'hidden',
    },
  },
  
  // Section headers
  sectionHeader: {
    ...typography.scale.labelMedium,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px', // Enhanced tracking
  },
  
  // User profile text
  userProfile: {
    name: {
      ...typography.scale.titleSmall,
      fontWeight: typography.weights.medium,
    },
    email: {
      ...typography.scale.bodySmall,
      opacity: '0.8',
    },
    role: {
      ...typography.scale.labelSmall,
      fontWeight: typography.weights.medium,
      textTransform: 'uppercase' as const,
    },
  },
  
  // Badge and notification text
  badge: {
    ...typography.business.badge,
    fontSize: '10px',
    lineHeight: '16px',
    fontWeight: typography.weights.semibold,
  },
  
  // Tooltip text (for rail mode)
  tooltip: {
    ...typography.scale.bodySmall,
    fontWeight: typography.weights.medium,
  },
} as const;

// Navigation Item State Colors
export const navigationItemStates = {
  light: {
    // Default state
    default: {
      background: 'transparent',
      color: colorTokens.light.onSurface,
      icon: colorTokens.light.onSurfaceVariant,
    },
    
    // Hover state
    hover: {
      background: `rgba(193, 83, 1, 0.08)`, // Primary with low opacity
      color: colorTokens.light.onSurface,
      icon: colorTokens.light.primary,
    },
    
    // Active/Selected state
    active: {
      background: colorTokens.light.primaryContainer,
      color: colorTokens.light.onPrimaryContainer,
      icon: colorTokens.light.onPrimaryContainer,
    },
    
    // Focused state
    focused: {
      background: `rgba(193, 83, 1, 0.12)`,
      color: colorTokens.light.onSurface,
      icon: colorTokens.light.primary,
      outline: colorTokens.light.primary,
    },
    
    // Disabled state
    disabled: {
      background: 'transparent',
      color: colorTokens.light.onSurface,
      icon: colorTokens.light.onSurface,
      opacity: '0.38', // MD3 disabled opacity
    },
  },
  
  dark: {
    // Default state
    default: {
      background: 'transparent',
      color: colorTokens.dark.onSurface,
      icon: colorTokens.dark.onSurfaceVariant,
    },
    
    // Hover state
    hover: {
      background: `rgba(193, 83, 1, 0.16)`, // More prominent in dark
      color: colorTokens.dark.onSurface,
      icon: colorTokens.dark.primary,
    },
    
    // Active/Selected state
    active: {
      background: colorTokens.dark.primaryContainer,
      color: colorTokens.dark.onPrimaryContainer,
      icon: colorTokens.dark.onPrimaryContainer,
    },
    
    // Focused state
    focused: {
      background: `rgba(193, 83, 1, 0.20)`,
      color: colorTokens.dark.onSurface,
      icon: colorTokens.dark.primary,
      outline: colorTokens.dark.primary,
    },
    
    // Disabled state
    disabled: {
      background: 'transparent',
      color: colorTokens.dark.onSurface,
      icon: colorTokens.dark.onSurface,
      opacity: '0.38',
    },
  },
} as const;

// Navigation Motion System (extends base motion)
export const navigationMotion = {
  // Rail to drawer expansion
  stateTransition: {
    duration: motion.duration.medium4, // 300ms
    easing: motion.easing.emphasized,
    properties: ['width', 'padding', 'opacity'],
  },
  
  // Modal show/hide animations
  modalTransition: {
    enter: {
      duration: motion.duration.medium4,
      easing: motion.easing.decelerated,
      properties: ['opacity', 'transform'],
      transform: 'translateX(-100%)',
    },
    exit: {
      duration: motion.duration.medium2,
      easing: motion.easing.accelerated,
      properties: ['opacity', 'transform'],
      transform: 'translateX(-100%)',
    },
  },
  
  // Navigation item animations
  item: {
    hover: {
      duration: motion.duration.fast2, // 100ms
      easing: motion.easing.decelerated,
      properties: ['background-color', 'color', 'transform'],
    },
    press: {
      duration: motion.duration.fast1, // 50ms
      easing: motion.easing.accelerated,
      properties: ['transform', 'background-color'],
    },
    focus: {
      duration: motion.duration.medium1, // 150ms
      easing: motion.easing.decelerated,
      properties: ['outline', 'background-color'],
    },
  },
  
  // Badge animations
  badge: {
    pulse: {
      duration: motion.duration.extraSlow3, // 1000ms
      easing: motion.easing.gentle,
      properties: ['transform', 'opacity'],
      iterationCount: 'infinite',
      direction: 'alternate',
    },
    appear: {
      duration: motion.duration.medium2,
      easing: motion.easing.emphasized,
      properties: ['scale', 'opacity'],
      keyframes: {
        '0%': { transform: 'scale(0)', opacity: '0' },
        '80%': { transform: 'scale(1.1)', opacity: '1' },
        '100%': { transform: 'scale(1)', opacity: '1' },
      },
    },
  },
  
  // Tooltip animations (for rail mode)
  tooltip: {
    show: {
      duration: motion.duration.medium1,
      easing: motion.easing.decelerated,
      properties: ['opacity', 'transform'],
      delay: '500ms', // Show after hover delay
    },
    hide: {
      duration: motion.duration.fast2,
      easing: motion.easing.accelerated,
      properties: ['opacity'],
    },
  },
  
  // Section transitions
  section: {
    expand: {
      duration: motion.duration.medium4,
      easing: motion.easing.emphasized,
      properties: ['max-height', 'opacity'],
    },
    collapse: {
      duration: motion.duration.medium2,
      easing: motion.easing.accelerated,
      properties: ['max-height', 'opacity'],
    },
  },
} as const;

// Responsive Breakpoints for Navigation States
export const navigationBreakpoints = {
  // Mobile: Modal drawer only
  mobile: {
    maxWidth: spacingTokens.breakpoints.md, // < 768px
    navigationMode: 'modal',
    touchTargetSize: '48px', // Minimum touch target
  },
  
  // Medium: Navigation rail (collapsed)
  medium: {
    minWidth: spacingTokens.breakpoints.md, // 768px
    maxWidth: spacingTokens.breakpoints.lg, // < 1024px
    navigationMode: 'rail',
    allowToggle: true,
  },
  
  // Large: Navigation drawer (expanded) by default
  large: {
    minWidth: spacingTokens.breakpoints.lg, // >= 1024px
    navigationMode: 'drawer',
    allowCollapse: true,
  },
} as const;

// Z-index layering for navigation
export const navigationZIndex = {
  rail: spacingTokens.zIndex.fixed, // 300
  drawer: spacingTokens.zIndex.fixed, // 300
  modal: spacingTokens.zIndex.modal, // 500
  modalBackdrop: spacingTokens.zIndex.overlay, // 400
  tooltip: spacingTokens.zIndex.tooltip, // 700
  badge: spacingTokens.zIndex.raised, // 10
} as const;

// Accessibility Configuration
export const navigationA11y = {
  // ARIA labels and roles
  landmarks: {
    navigation: 'Main navigation',
    banner: 'Application header',
    complementary: 'User profile',
  },
  
  // Screen reader text
  srOnly: {
    toggleButton: 'Toggle navigation menu',
    closeModal: 'Close navigation menu',
    currentPage: '(current page)',
    hasNotifications: 'has notifications',
    itemCount: (count: number) => `${count} items`,
  },
  
  // Focus management
  focus: {
    trapInModal: true,
    returnToTrigger: true,
    skipToContent: 'Skip to main content',
  },
  
  // Keyboard shortcuts
  shortcuts: {
    toggleNav: 'Alt+M',
    focusSearch: 'Ctrl+K',
    jumpToProfile: 'Alt+P',
  },
} as const;

// Usage Examples and Component Mappings
export const navigationExamples = {
  // CSS custom properties for theme integration
  cssVariables: {
    '--nav-width-rail': navigationLayout.rail.width,
    '--nav-width-drawer': navigationLayout.drawer.width,
    '--nav-width-modal': navigationLayout.modal.width,
    '--nav-item-height': navigationLayout.drawer.itemHeight,
    '--nav-transition-duration': navigationMotion.stateTransition.duration,
    '--nav-transition-easing': navigationMotion.stateTransition.easing,
  },
  
  // Tailwind class combinations
  tailwindClasses: {
    railContainer: 'w-20 border-r bg-surface shadow-sm',
    drawerContainer: 'w-70 border-r bg-surface-container shadow-md',
    modalContainer: 'w-80 bg-surface-container-high shadow-2xl',
    navigationItem: 'flex items-center h-14 px-4 hover:bg-primary/8 focus:bg-primary/12 transition-colors',
    activeItem: 'bg-primary-container text-on-primary-container',
    badge: 'absolute -top-1 -right-1 bg-error text-on-error text-xs rounded-full',
  },
  
  // Component state combinations
  componentStates: {
    railItem: {
      default: 'w-12 h-12 justify-center',
      hover: 'bg-primary/8',
      active: 'bg-primary-container',
    },
    drawerItem: {
      default: 'px-4 py-3 gap-3',
      hover: 'bg-primary/8',
      active: 'bg-primary-container',
    },
    modalItem: {
      default: 'px-6 py-3 gap-4 min-h-[48px]',
      hover: 'bg-primary/8',
      active: 'bg-primary-container',
    },
  },
} as const;

// Utility types for TypeScript integration
export type NavigationMode = 'rail' | 'drawer' | 'modal';
export type NavigationItemState = 'default' | 'hover' | 'active' | 'focused' | 'disabled';
export type NavigationBreakpoint = keyof typeof navigationBreakpoints;
export type NavigationSurface = keyof typeof navigationSurfaces.light;
export type NavigationSpacingToken = keyof typeof navigationSpacing;

// Export unified navigation tokens object
export const navigationTokens = {
  layout: navigationLayout,
  surfaces: navigationSurfaces,
  elevation: navigationElevation,
  spacing: navigationSpacing,
  typography: navigationTypography,
  itemStates: navigationItemStates,
  motion: navigationMotion,
  breakpoints: navigationBreakpoints,
  zIndex: navigationZIndex,
  a11y: navigationA11y,
  examples: navigationExamples,
} as const;

export default navigationTokens;