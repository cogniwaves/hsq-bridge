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
    
    // Navigation
    navigation: {
      backgroundColor: colorTokens.light.surface,
      borderColor: colorTokens.light.outline,
      height: spacingTokens.business.navHeight,
      padding: spacingTokens.business.navPadding,
      boxShadow: elevation.semantic.navbar.boxShadow,
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
  },
} as const;

export type LightTheme = typeof lightTheme;
export default lightTheme;