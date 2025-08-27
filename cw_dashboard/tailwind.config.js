/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Platform brand colors
        'hubspot': '#ff7a59',
        'stripe': '#635bff',
        'quickbooks': '#0077c5',
        
        // Theme system colors (CSS custom properties)
        primary: 'var(--color-primary)',
        'primary-container': 'var(--color-primary-container)',
        'on-primary': 'var(--color-on-primary)',
        'on-primary-container': 'var(--color-on-primary-container)',
        
        secondary: 'var(--color-secondary)',
        'secondary-container': 'var(--color-secondary-container)',
        'on-secondary': 'var(--color-on-secondary)',
        'on-secondary-container': 'var(--color-on-secondary-container)',
        
        surface: 'var(--color-surface)',
        'surface-variant': 'var(--color-surface-variant)',
        'on-surface': 'var(--color-on-surface)',
        'on-surface-variant': 'var(--color-on-surface-variant)',
        background: 'var(--color-background)',
        'on-background': 'var(--color-on-background)',
        
        error: 'var(--color-error)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        
        // Navigation-specific colors
        'nav-rail-bg': 'var(--nav-rail-bg)',
        'nav-drawer-bg': 'var(--nav-drawer-bg)',
        'nav-modal-bg': 'var(--nav-modal-bg)',
        'nav-item-hover': 'var(--nav-item-hover-bg)',
        'nav-item-active': 'var(--nav-item-active-bg)',
        'nav-item-focused': 'var(--nav-item-focused-bg)',
      },
      
      // Navigation-specific spacing values
      spacing: {
        // Navigation widths (using CSS custom properties)
        'nav-rail': 'var(--nav-width-rail)',     // 80px
        'nav-drawer': 'var(--nav-width-drawer)', // 280px
        'nav-modal': 'var(--nav-width-modal)',   // 320px
        
        // Navigation heights
        'nav-item': 'var(--nav-item-height)',    // 56px
        'nav-header': 'var(--nav-header-height)', // 80px
        
        // Semantic spacing tokens
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)',
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
        'xl': 'var(--spacing-xl)',
        
        // Standard Tailwind extensions
        '18': '4.5rem',   // 72px
        '20': '5rem',     // 80px (rail width)
        '70': '17.5rem',  // 280px (drawer width)
        '80': '20rem',    // 320px (modal width)
      },
      
      // Navigation and theme z-index values
      zIndex: {
        'nav-rail': 'var(--nav-rail-z)',
        'nav-drawer': 'var(--nav-drawer-z)', 
        'nav-modal': 'var(--nav-modal-z)',
        'nav-backdrop': 'var(--nav-modal-backdrop-z)',
        'nav-tooltip': 'var(--nav-tooltip-z)',
        'nav-badge': 'var(--nav-badge-z)',
        
        // Standard values
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      
      // Enhanced animation system
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        
        // Navigation-specific animations
        'nav-slide-in': 'nav-slide-in var(--nav-modal-enter-duration) var(--motion-easing-decelerated)',
        'nav-slide-out': 'nav-slide-out var(--nav-modal-exit-duration) var(--motion-easing-accelerated)', 
        'nav-fade-in': 'nav-fade-in var(--nav-modal-enter-duration) var(--motion-easing-decelerated)',
        'nav-fade-out': 'nav-fade-out var(--nav-modal-exit-duration) var(--motion-easing-accelerated)',
        'badge-pulse': 'badge-pulse 2s ease-in-out infinite',
        
        // Theme transition animations
        'theme-transition': 'theme-transition var(--motion-duration-medium) var(--motion-easing-standard)',
      },
      
      // Navigation keyframes
      keyframes: {
        'nav-slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'nav-slide-out': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        'nav-fade-in': {
          '0%': { opacity: '0', visibility: 'hidden' },
          '100%': { opacity: '1', visibility: 'visible' },
        },
        'nav-fade-out': {
          '0%': { opacity: '1', visibility: 'visible' },
          '100%': { opacity: '0', visibility: 'hidden' },
        },
        'badge-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'theme-transition': {
          '0%': { opacity: '0.8' },
          '100%': { opacity: '1' },
        },
      },
      
      // Typography scale using CSS custom properties
      fontSize: {
        'nav-item': ['14px', '20px'],
        'nav-badge': ['10px', '16px'],
        'nav-tooltip': ['12px', '16px'],
        'nav-section-header': ['11px', '16px'],
        'nav-user-name': ['14px', '20px'],
        'nav-user-email': ['12px', '16px'],
      },
      
      // Enhanced border radius values
      borderRadius: {
        'nav-item': '12px',
        'nav-badge': '8px',
        'nav-tooltip': '6px',
        'nav-modal': '16px',
      },
      
      // Box shadow system using CSS custom properties
      boxShadow: {
        'nav-rail': 'var(--nav-rail-shadow, 0 1px 3px 0 rgb(0 0 0 / 0.1))',
        'nav-drawer': 'var(--nav-drawer-shadow, 0 4px 6px -1px rgb(0 0 0 / 0.1))',
        'nav-modal': 'var(--nav-modal-shadow, 0 25px 50px -12px rgb(0 0 0 / 0.25))',
        'nav-tooltip': 'var(--nav-tooltip-shadow, 0 10px 15px -3px rgb(0 0 0 / 0.1))',
      },
      
      // Transition timing functions
      transitionTimingFunction: {
        'nav': 'var(--nav-transition-easing)',
        'nav-hover': 'var(--nav-item-hover-easing)',
        'emphasized': 'var(--motion-easing-emphasized)',
        'decelerated': 'var(--motion-easing-decelerated)',
        'accelerated': 'var(--motion-easing-accelerated)',
      },
      
      // Transition durations
      transitionDuration: {
        'nav': 'var(--nav-transition-duration)',
        'nav-hover': 'var(--nav-item-hover-duration)',
        'nav-modal-enter': 'var(--nav-modal-enter-duration)',
        'nav-modal-exit': 'var(--nav-modal-exit-duration)',
      },
      
      // Responsive breakpoints (matching navigation breakpoints)
      screens: {
        'nav-mobile': { 'max': '767px' },      // Modal navigation
        'nav-medium': { 'min': '768px', 'max': '1023px' }, // Rail navigation
        'nav-large': { 'min': '1024px' },      // Drawer navigation
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    
    // Custom plugin for navigation utilities
    function({ addUtilities, theme }) {
      addUtilities({
        // Navigation state utilities
        '.nav-state-rail': {
          width: theme('spacing.nav-rail'),
          '& .nav-item-text': {
            opacity: '0',
            width: '0',
          },
          '& .nav-section-header': {
            opacity: '0',
            height: '0',
            margin: '0',
          },
        },
        
        '.nav-state-drawer': {
          width: theme('spacing.nav-drawer'),
        },
        
        '.nav-state-modal': {
          width: theme('spacing.nav-modal'),
          position: 'fixed',
          top: '0',
          left: '0',
          bottom: '0',
          zIndex: theme('zIndex.nav-modal'),
        },
        
        // Navigation item state utilities  
        '.nav-item-state-default': {
          backgroundColor: 'var(--nav-item-default-bg)',
          color: 'var(--nav-item-default-color)',
        },
        
        '.nav-item-state-hover': {
          backgroundColor: 'var(--nav-item-hover-bg)',
          color: 'var(--nav-item-hover-color)',
        },
        
        '.nav-item-state-active': {
          backgroundColor: 'var(--nav-item-active-bg)',
          color: 'var(--nav-item-active-color)',
        },
        
        '.nav-item-state-focused': {
          backgroundColor: 'var(--nav-item-focused-bg)',
          color: 'var(--nav-item-focused-color)',
          boxShadow: '0 0 0 2px var(--nav-item-focused-outline)',
        },
        
        // Navigation surface utilities
        '.nav-surface-rail': {
          backgroundColor: 'var(--nav-rail-bg)',
          borderRight: '1px solid var(--nav-rail-border)',
        },
        
        '.nav-surface-drawer': {
          backgroundColor: 'var(--nav-drawer-bg)', 
          borderRight: '1px solid var(--nav-drawer-border)',
        },
        
        '.nav-surface-modal': {
          backgroundColor: 'var(--nav-modal-bg)',
          border: '1px solid var(--nav-modal-border)',
        },
        
        // Navigation responsive utilities
        '.nav-responsive': {
          '@media (max-width: 767px)': {
            width: theme('spacing.nav-modal'),
            position: 'fixed',
            top: '0',
            left: '0', 
            bottom: '0',
            zIndex: theme('zIndex.nav-modal'),
            transform: 'translateX(-100%)',
          },
          '@media (min-width: 768px) and (max-width: 1023px)': {
            width: theme('spacing.nav-rail'),
          },
          '@media (min-width: 1024px)': {
            width: theme('spacing.nav-drawer'),
          },
        },
      });
    },
  ],
}