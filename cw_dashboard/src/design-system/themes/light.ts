/**
 * Light Theme Configuration - Enhanced Orange Edition
 * Professional Material Design 3 inspired theme with orange-dominant palette
 * Maintains WCAG 2.1 AA accessibility compliance
 */

import { colorTokens } from '../tokens/color';
import { typography } from '../tokens/typography';
import { spacingTokens } from '../tokens/spacing';
import { elevation } from '../tokens/elevation';
import { motion } from '../tokens/motion';
import { navigationTokens } from '../tokens/navigation';

export const lightTheme = {
  // Theme identification
  mode: 'light' as const,
  
  // Color system
  colors: {
    ...colorTokens.light,
    semantic: colorTokens.semantic.light,
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
  
  // Elevation system
  elevation: {
    ...elevation.light,
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
  
  // Component-specific overrides
  components: {
    // Card components
    card: {
      backgroundColor: colorTokens.light.surface,
      borderColor: colorTokens.light.outline,
      borderRadius: spacingTokens.business.cardBorderRadius,
      padding: spacingTokens.business.cardPadding,
      boxShadow: elevation.business.dashboardCard.boxShadow,
    },
    
    // Button components (Enhanced Orange)
    button: {
      primary: {
        backgroundColor: colorTokens.light.primary, // Professional burnt orange
        color: colorTokens.light.onPrimary,
        borderRadius: spacingTokens.business.buttonBorderRadius,
        padding: spacingTokens.business.buttonPadding,
        transition: motion.semantic.buttonHover.duration,
        '&:hover': {
          backgroundColor: '#993300', // Darker orange hover
        },
      },
      secondary: {
        backgroundColor: colorTokens.light.secondary, // Rich amber orange
        color: colorTokens.light.onSecondary,
        borderRadius: spacingTokens.business.buttonBorderRadius,
        padding: spacingTokens.business.buttonPadding,
        transition: motion.semantic.buttonHover.duration,
        '&:hover': {
          backgroundColor: '#E65500', // Enhanced orange hover
        },
      },
    },
    
    // Status indicators (Orange-Enhanced)
    status: {
      healthy: {
        backgroundColor: colorTokens.semantic.light.status.healthy, // Orange-warm green
        color: colorTokens.light.onPrimary,
        borderLeft: '4px solid #4D7300', // Orange-green accent
      },
      degraded: {
        backgroundColor: colorTokens.semantic.light.status.degraded, // Pure orange warning
        color: colorTokens.light.onSecondary,
        borderLeft: '4px solid #993300', // Deep orange accent
      },
      unhealthy: {
        backgroundColor: colorTokens.semantic.light.status.unhealthy, // Orange-red error
        color: colorTokens.light.onError,
        borderLeft: '4px solid #B32400', // Dark orange-red accent
      },
    },
    
    // Navigation (Enhanced with design tokens)
    navigation: {
      backgroundColor: navigationTokens.surfaces.light.drawer.background,
      borderColor: navigationTokens.surfaces.light.drawer.border,
      height: spacingTokens.business.navHeight,
      padding: spacingTokens.business.navPadding,
      boxShadow: navigationTokens.elevation.light.drawer.boxShadow,
      // Rail state
      rail: {
        backgroundColor: navigationTokens.surfaces.light.rail.background,
        borderColor: navigationTokens.surfaces.light.rail.border,
        width: navigationTokens.layout.rail.width,
        boxShadow: navigationTokens.elevation.light.rail.boxShadow,
      },
      // Modal state
      modal: {
        backgroundColor: navigationTokens.surfaces.light.modal.background,
        borderColor: navigationTokens.surfaces.light.modal.border,
        width: navigationTokens.layout.modal.width,
        maxWidth: navigationTokens.layout.modal.maxWidth,
        backdropColor: navigationTokens.surfaces.light.modal.backdrop,
        boxShadow: navigationTokens.elevation.light.modal.boxShadow,
      },
    },
    
    // Modal
    modal: {
      backgroundColor: colorTokens.light.surface,
      borderRadius: spacingTokens.business.modalBorderRadius,
      padding: spacingTokens.business.modalPadding,
      maxWidth: spacingTokens.business.modalMaxWidth,
      boxShadow: elevation.business.invoiceModal.boxShadow,
    },
    
    // Table
    table: {
      headerBackgroundColor: colorTokens.light.surfaceVariant,
      borderColor: colorTokens.light.outline,
      padding: spacingTokens.business.tablePadding,
      cellPadding: spacingTokens.business.tableCellPadding,
    },
    
    // Input fields
    input: {
      backgroundColor: colorTokens.light.surface,
      borderColor: colorTokens.light.outline,
      borderRadius: spacingTokens.business.buttonBorderRadius,
      padding: spacingTokens.business.inputPadding,
      focusBorderColor: colorTokens.light.primary,
    },
  },
  
  // CSS custom properties for runtime theme switching
  cssVariables: {
    // Primary colors
    '--color-primary': colorTokens.light.primary,
    '--color-on-primary': colorTokens.light.onPrimary,
    '--color-primary-container': colorTokens.light.primaryContainer,
    '--color-on-primary-container': colorTokens.light.onPrimaryContainer,
    
    // Secondary colors
    '--color-secondary': colorTokens.light.secondary,
    '--color-on-secondary': colorTokens.light.onSecondary,
    '--color-secondary-container': colorTokens.light.secondaryContainer,
    '--color-on-secondary-container': colorTokens.light.onSecondaryContainer,
    
    // Surface colors
    '--color-surface': colorTokens.light.surface,
    '--color-on-surface': colorTokens.light.onSurface,
    '--color-surface-variant': colorTokens.light.surfaceVariant,
    '--color-on-surface-variant': colorTokens.light.onSurfaceVariant,
    '--color-background': colorTokens.light.background,
    '--color-on-background': colorTokens.light.onBackground,
    
    // Status colors
    '--color-error': colorTokens.light.error,
    '--color-success': colorTokens.light.success,
    '--color-warning': colorTokens.light.warning,
    
    // Interactive colors
    '--color-interactive-primary': colorTokens.semantic.light.interactive.primary,
    '--color-interactive-hover': colorTokens.semantic.light.interactive.hover,
    '--color-interactive-disabled': colorTokens.semantic.light.interactive.disabled,
    
    // Typography
    '--color-text-primary': colorTokens.semantic.light.text.primary,
    '--color-text-secondary': colorTokens.semantic.light.text.secondary,
    '--color-text-tertiary': colorTokens.semantic.light.text.tertiary,
    
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
    
    // Navigation surface colors
    '--nav-rail-bg': navigationTokens.surfaces.light.rail.background,
    '--nav-rail-border': navigationTokens.surfaces.light.rail.border,
    '--nav-rail-overlay': navigationTokens.surfaces.light.rail.overlay,
    '--nav-drawer-bg': navigationTokens.surfaces.light.drawer.background,
    '--nav-drawer-border': navigationTokens.surfaces.light.drawer.border,
    '--nav-drawer-overlay': navigationTokens.surfaces.light.drawer.overlay,
    '--nav-modal-bg': navigationTokens.surfaces.light.modal.background,
    '--nav-modal-border': navigationTokens.surfaces.light.modal.border,
    '--nav-modal-overlay': navigationTokens.surfaces.light.modal.overlay,
    '--nav-modal-backdrop': navigationTokens.surfaces.light.modal.backdrop,
    
    // Navigation item states
    '--nav-item-default-bg': navigationTokens.itemStates.light.default.background,
    '--nav-item-default-color': navigationTokens.itemStates.light.default.color,
    '--nav-item-default-icon': navigationTokens.itemStates.light.default.icon,
    '--nav-item-hover-bg': navigationTokens.itemStates.light.hover.background,
    '--nav-item-hover-color': navigationTokens.itemStates.light.hover.color,
    '--nav-item-hover-icon': navigationTokens.itemStates.light.hover.icon,
    '--nav-item-active-bg': navigationTokens.itemStates.light.active.background,
    '--nav-item-active-color': navigationTokens.itemStates.light.active.color,
    '--nav-item-active-icon': navigationTokens.itemStates.light.active.icon,
    '--nav-item-focused-bg': navigationTokens.itemStates.light.focused.background,
    '--nav-item-focused-color': navigationTokens.itemStates.light.focused.color,
    '--nav-item-focused-icon': navigationTokens.itemStates.light.focused.icon,
    '--nav-item-focused-outline': navigationTokens.itemStates.light.focused.outline,
    '--nav-item-disabled-opacity': navigationTokens.itemStates.light.disabled.opacity,
    
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
  },
} as const;

export type LightTheme = typeof lightTheme;
export default lightTheme;