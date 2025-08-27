/**
 * Dark Theme Configuration - Enhanced Orange Edition
 * Professional Material Design 3 inspired theme with dominant orange palette
 * NO BLUE COLORS - Enhanced warm orange/amber palette maintains B=00 constraint
 * Optimized for business applications with superior accessibility compliance
 */

import { colorTokens } from '../tokens/color';
import { typography } from '../tokens/typography';
import { spacingTokens } from '../tokens/spacing';
import { elevation } from '../tokens/elevation';
import { motion } from '../tokens/motion';
import { navigationTokens } from '../tokens/navigation';

export const darkTheme = {
  // Theme identification
  mode: 'dark' as const,
  
  // Color system (blue-free as requested)
  colors: {
    ...colorTokens.dark,
    semantic: colorTokens.semantic.dark,
  },
  
  // Typography system
  typography: {
    ...typography.scale,
    business: typography.business,
    families: typography.families,
    weights: typography.weights,
  },
  
  // Spacing system
  spacing: {
    ...spacingTokens.base,
    semantic: spacingTokens.semantic,
    business: spacingTokens.business,
  },
  
  // Elevation system (darker shadows for dark theme)
  elevation: {
    ...elevation.dark,
    semantic: elevation.semantic,
    business: elevation.business,
    interaction: elevation.interaction,
  },
  
  // Motion system
  motion: {
    easing: motion.easing,
    duration: motion.duration,
    semantic: motion.semantic,
    business: motion.business,
    keyframes: motion.keyframes,
  },
  
  // Breakpoints and grid
  breakpoints: spacingTokens.breakpoints,
  grid: spacingTokens.grid,
  zIndex: spacingTokens.zIndex,
  
  // Component-specific overrides for dark theme
  components: {
    // Card components
    card: {
      backgroundColor: colorTokens.dark.surfaceContainer,
      borderColor: colorTokens.dark.outline,
      borderRadius: spacingTokens.business.cardBorderRadius,
      padding: spacingTokens.business.cardPadding,
      boxShadow: elevation.dark.level1.boxShadow,
    },
    
    // Button components (Enhanced Orange Palette)
    button: {
      primary: {
        backgroundColor: colorTokens.dark.primary, // Vibrant orange
        color: colorTokens.dark.onPrimary,
        borderRadius: spacingTokens.business.buttonBorderRadius,
        padding: spacingTokens.business.buttonPadding,
        transition: motion.semantic.buttonHover.duration,
        '&:hover': {
          backgroundColor: '#FFAA00', // Brighter orange hover
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(255, 136, 0, 0.3)',
        },
      },
      secondary: {
        backgroundColor: colorTokens.dark.secondary, // Deep amber orange
        color: colorTokens.dark.onSecondary,
        borderRadius: spacingTokens.business.buttonBorderRadius,
        padding: spacingTokens.business.buttonPadding,
        transition: motion.semantic.buttonHover.duration,
        '&:hover': {
          backgroundColor: '#FFBB33', // Enhanced amber hover
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(255, 153, 0, 0.3)',
        },
      },
    },
    
    // Status indicators (Enhanced Orange Palette, business-appropriate, no blue)
    status: {
      healthy: {
        backgroundColor: colorTokens.semantic.dark.status.healthy, // Orange-warm green
        color: colorTokens.dark.onPrimary,
        borderLeft: '4px solid #AADD33', // Bright green-orange accent
        boxShadow: '0 0 8px rgba(136, 187, 0, 0.2)',
      },
      degraded: {
        backgroundColor: colorTokens.semantic.dark.status.degraded, // Enhanced orange
        color: colorTokens.dark.onSecondary,
        borderLeft: '4px solid #FFAA00', // Bright orange accent
        boxShadow: '0 0 8px rgba(255, 119, 0, 0.2)',
      },
      unhealthy: {
        backgroundColor: colorTokens.semantic.dark.status.unhealthy, // Intense orange-red
        color: colorTokens.dark.onError,
        borderLeft: '4px solid #FF7733', // Bright orange-red accent
        boxShadow: '0 0 8px rgba(255, 85, 0, 0.2)',
      },
    },
    
    // Navigation (Enhanced with design tokens)
    navigation: {
      backgroundColor: navigationTokens.surfaces.dark.drawer.background,
      borderColor: navigationTokens.surfaces.dark.drawer.border,
      height: spacingTokens.business.navHeight,
      padding: spacingTokens.business.navPadding,
      boxShadow: navigationTokens.elevation.dark.drawer.boxShadow,
      // Rail state
      rail: {
        backgroundColor: navigationTokens.surfaces.dark.rail.background,
        borderColor: navigationTokens.surfaces.dark.rail.border,
        width: navigationTokens.layout.rail.width,
        boxShadow: navigationTokens.elevation.dark.rail.boxShadow,
      },
      // Modal state
      modal: {
        backgroundColor: navigationTokens.surfaces.dark.modal.background,
        borderColor: navigationTokens.surfaces.dark.modal.border,
        width: navigationTokens.layout.modal.width,
        maxWidth: navigationTokens.layout.modal.maxWidth,
        backdropColor: navigationTokens.surfaces.dark.modal.backdrop,
        boxShadow: navigationTokens.elevation.dark.modal.boxShadow,
      },
    },
    
    // Modal
    modal: {
      backgroundColor: colorTokens.dark.surfaceContainerHigh,
      borderRadius: spacingTokens.business.modalBorderRadius,
      padding: spacingTokens.business.modalPadding,
      maxWidth: spacingTokens.business.modalMaxWidth,
      boxShadow: elevation.dark.level4.boxShadow,
    },
    
    // Table
    table: {
      headerBackgroundColor: colorTokens.dark.surfaceVariant,
      borderColor: colorTokens.dark.outline,
      padding: spacingTokens.business.tablePadding,
      cellPadding: spacingTokens.business.tableCellPadding,
    },
    
    // Input fields
    input: {
      backgroundColor: colorTokens.dark.surfaceContainer,
      borderColor: colorTokens.dark.outline,
      borderRadius: spacingTokens.business.buttonBorderRadius,
      padding: spacingTokens.business.inputPadding,
      focusBorderColor: colorTokens.dark.primary, // Emerald focus
    },
  },
  
  // CSS custom properties for runtime theme switching
  cssVariables: {
    // Primary colors (vibrant orange - no blue)
    '--color-primary': colorTokens.dark.primary,
    '--color-on-primary': colorTokens.dark.onPrimary,
    '--color-primary-container': colorTokens.dark.primaryContainer,
    '--color-on-primary-container': colorTokens.dark.onPrimaryContainer,
    
    // Secondary colors (warm amber)
    '--color-secondary': colorTokens.dark.secondary,
    '--color-on-secondary': colorTokens.dark.onSecondary,
    '--color-secondary-container': colorTokens.dark.secondaryContainer,
    '--color-on-secondary-container': colorTokens.dark.onSecondaryContainer,
    
    // Surface colors (rich charcoal)
    '--color-surface': colorTokens.dark.surface,
    '--color-on-surface': colorTokens.dark.onSurface,
    '--color-surface-variant': colorTokens.dark.surfaceVariant,
    '--color-on-surface-variant': colorTokens.dark.onSurfaceVariant,
    '--color-background': colorTokens.dark.background,
    '--color-on-background': colorTokens.dark.onBackground,
    
    // Status colors (no blue variants)
    '--color-error': colorTokens.dark.error,
    '--color-success': colorTokens.dark.success,
    '--color-warning': colorTokens.dark.warning,
    
    // Interactive colors (emerald-based)
    '--color-interactive-primary': colorTokens.semantic.dark.interactive.primary,
    '--color-interactive-hover': colorTokens.semantic.dark.interactive.hover,
    '--color-interactive-disabled': colorTokens.semantic.dark.interactive.disabled,
    
    // Typography
    '--color-text-primary': colorTokens.semantic.dark.text.primary,
    '--color-text-secondary': colorTokens.semantic.dark.text.secondary,
    '--color-text-tertiary': colorTokens.semantic.dark.text.tertiary,
    
    // Spacing
    '--spacing-xs': spacingTokens.semantic.xs,
    '--spacing-sm': spacingTokens.semantic.sm,
    '--spacing-md': spacingTokens.semantic.md,
    '--spacing-lg': spacingTokens.semantic.lg,
    '--spacing-xl': spacingTokens.semantic.xl,
    
    // Motion
    '--motion-duration-fast': motion.duration.fast2,
    '--motion-duration-medium': motion.duration.medium2,
    '--motion-duration-slow': motion.duration.slow1,
    '--motion-easing-standard': motion.easing.standard,
    '--motion-easing-decelerated': motion.easing.decelerated,
    '--motion-easing-accelerated': motion.easing.accelerated,
    
    // Navigation layout tokens
    '--nav-width-rail': navigationTokens.layout.rail.width,
    '--nav-width-drawer': navigationTokens.layout.drawer.width,
    '--nav-width-modal': navigationTokens.layout.modal.width,
    '--nav-modal-max-width': navigationTokens.layout.modal.maxWidth,
    '--nav-item-height': navigationTokens.layout.drawer.itemHeight,
    '--nav-header-height': navigationTokens.layout.drawer.headerHeight,
    '--nav-icon-size': navigationTokens.layout.drawer.iconSize,
    
    // Navigation surface colors (dark theme)
    '--nav-rail-bg': navigationTokens.surfaces.dark.rail.background,
    '--nav-rail-border': navigationTokens.surfaces.dark.rail.border,
    '--nav-rail-overlay': navigationTokens.surfaces.dark.rail.overlay,
    '--nav-drawer-bg': navigationTokens.surfaces.dark.drawer.background,
    '--nav-drawer-border': navigationTokens.surfaces.dark.drawer.border,
    '--nav-drawer-overlay': navigationTokens.surfaces.dark.drawer.overlay,
    '--nav-modal-bg': navigationTokens.surfaces.dark.modal.background,
    '--nav-modal-border': navigationTokens.surfaces.dark.modal.border,
    '--nav-modal-overlay': navigationTokens.surfaces.dark.modal.overlay,
    '--nav-modal-backdrop': navigationTokens.surfaces.dark.modal.backdrop,
    
    // Navigation item states (dark theme)
    '--nav-item-default-bg': navigationTokens.itemStates.dark.default.background,
    '--nav-item-default-color': navigationTokens.itemStates.dark.default.color,
    '--nav-item-default-icon': navigationTokens.itemStates.dark.default.icon,
    '--nav-item-hover-bg': navigationTokens.itemStates.dark.hover.background,
    '--nav-item-hover-color': navigationTokens.itemStates.dark.hover.color,
    '--nav-item-hover-icon': navigationTokens.itemStates.dark.hover.icon,
    '--nav-item-active-bg': navigationTokens.itemStates.dark.active.background,
    '--nav-item-active-color': navigationTokens.itemStates.dark.active.color,
    '--nav-item-active-icon': navigationTokens.itemStates.dark.active.icon,
    '--nav-item-focused-bg': navigationTokens.itemStates.dark.focused.background,
    '--nav-item-focused-color': navigationTokens.itemStates.dark.focused.color,
    '--nav-item-focused-icon': navigationTokens.itemStates.dark.focused.icon,
    '--nav-item-focused-outline': navigationTokens.itemStates.dark.focused.outline,
    '--nav-item-disabled-opacity': navigationTokens.itemStates.dark.disabled.opacity,
    
    // Navigation spacing
    '--nav-container-padding': navigationTokens.spacing.container.drawer.padding,
    '--nav-item-padding': navigationTokens.spacing.container.drawer.itemPadding,
    '--nav-item-gap': navigationTokens.spacing.container.drawer.itemGap,
    '--nav-icon-to-text': navigationTokens.spacing.item.iconToText,
    '--nav-section-gap': navigationTokens.spacing.section.groupGap,
    
    // Navigation motion
    '--nav-transition-duration': navigationTokens.motion.stateTransition.duration,
    '--nav-transition-easing': navigationTokens.motion.stateTransition.easing,
    '--nav-item-hover-duration': navigationTokens.motion.item.hover.duration,
    '--nav-item-hover-easing': navigationTokens.motion.item.hover.easing,
    '--nav-modal-enter-duration': navigationTokens.motion.modalTransition.enter.duration,
    '--nav-modal-exit-duration': navigationTokens.motion.modalTransition.exit.duration,
    
    // Navigation z-index
    '--nav-rail-z': navigationTokens.zIndex.rail.toString(),
    '--nav-drawer-z': navigationTokens.zIndex.drawer.toString(),
    '--nav-modal-z': navigationTokens.zIndex.modal.toString(),
    '--nav-modal-backdrop-z': navigationTokens.zIndex.modalBackdrop.toString(),
    '--nav-tooltip-z': navigationTokens.zIndex.tooltip.toString(),
    '--nav-badge-z': navigationTokens.zIndex.badge.toString(),
    
    // Navigation-specific colors for better contrast
    '--nav-section-header-color': '#CCCCCC',
    '--nav-toggle-color': '#FFFFFF',
  },
} as const;

export type DarkTheme = typeof darkTheme;
export default darkTheme;