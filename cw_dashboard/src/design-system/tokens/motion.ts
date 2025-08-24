/**
 * Material Design 3 Motion System
 * Animation timing, easing, and duration tokens
 */

// MD3 Easing curves
export const easing = {
  // Standard easing for most animations
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  
  // Decelerated easing for entering elements
  decelerated: 'cubic-bezier(0, 0, 0, 1)',
  
  // Accelerated easing for exiting elements
  accelerated: 'cubic-bezier(0.3, 0, 1, 1)',
  
  // Emphasized easing for important transitions
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  
  // Legacy easing functions for compatibility
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Custom business-appropriate easing
  smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  gentle: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
} as const;

// MD3 Duration scale
export const duration = {
  // Ultra-fast (state changes)
  instant: '0ms',
  
  // Fast (micro-interactions)
  fast1: '50ms',
  fast2: '100ms',
  
  // Medium (component transitions)
  medium1: '150ms',
  medium2: '200ms',
  medium3: '250ms',
  medium4: '300ms',
  
  // Slow (layout changes, page transitions)
  slow1: '400ms',
  slow2: '500ms',
  slow3: '600ms',
  slow4: '700ms',
  
  // Extra slow (complex animations)
  extraSlow1: '800ms',
  extraSlow2: '900ms',
  extraSlow3: '1000ms',
  extraSlow4: '1200ms',
} as const;

// Semantic motion mappings
export const semanticMotion = {
  // Theme transitions
  themeSwitch: {
    duration: duration.medium3,
    easing: easing.standard,
    properties: ['background-color', 'color', 'border-color', 'box-shadow'],
  },
  
  // Interactive feedback
  buttonHover: {
    duration: duration.fast2,
    easing: easing.decelerated,
    properties: ['background-color', 'transform', 'box-shadow'],
  },
  buttonPress: {
    duration: duration.fast1,
    easing: easing.accelerated,
    properties: ['transform', 'box-shadow'],
  },
  
  // Focus states
  focus: {
    duration: duration.medium1,
    easing: easing.decelerated,
    properties: ['outline', 'box-shadow'],
  },
  
  // Layout changes
  cardHover: {
    duration: duration.medium2,
    easing: easing.standard,
    properties: ['transform', 'box-shadow'],
  },
  cardExpand: {
    duration: duration.medium4,
    easing: easing.emphasized,
    properties: ['height', 'opacity'],
  },
  
  // Modal and overlay
  modalEnter: {
    duration: duration.medium4,
    easing: easing.decelerated,
    properties: ['opacity', 'transform'],
  },
  modalExit: {
    duration: duration.medium2,
    easing: easing.accelerated,
    properties: ['opacity', 'transform'],
  },
  overlayFade: {
    duration: duration.medium3,
    easing: easing.standard,
    properties: ['opacity'],
  },
  
  // Loading states
  spinner: {
    duration: duration.extraSlow2,
    easing: 'linear',
    properties: ['transform'],
    iterationCount: 'infinite',
  },
  pulse: {
    duration: duration.extraSlow3,
    easing: easing.gentle,
    properties: ['opacity'],
    iterationCount: 'infinite',
    direction: 'alternate',
  },
  
  // Notification and feedback
  toast: {
    duration: duration.medium4,
    easing: easing.emphasized,
    properties: ['transform', 'opacity'],
  },
  alert: {
    duration: duration.medium2,
    easing: easing.decelerated,
    properties: ['opacity', 'max-height'],
  },
  
  // Data updates
  dataRefresh: {
    duration: duration.medium3,
    easing: easing.standard,
    properties: ['opacity'],
  },
  statusChange: {
    duration: duration.medium2,
    easing: easing.decelerated,
    properties: ['background-color', 'color'],
  },
} as const;

// Business application specific motion
export const businessMotion = {
  // Dashboard animations
  dashboardLoad: {
    duration: duration.slow1,
    easing: easing.decelerated,
    stagger: duration.fast2, // Delay between elements
  },
  metricsUpdate: {
    duration: duration.medium4,
    easing: easing.emphasized,
    properties: ['opacity', 'transform'],
  },
  
  // Financial data
  currencyChange: {
    duration: duration.medium2,
    easing: easing.standard,
    properties: ['color', 'font-weight'],
  },
  statusIndicator: {
    duration: duration.medium1,
    easing: easing.decelerated,
    properties: ['background-color', 'transform'],
  },
  
  // Queue and sync operations
  queueUpdate: {
    duration: duration.medium3,
    easing: easing.standard,
    properties: ['opacity', 'height'],
  },
  syncProgress: {
    duration: duration.medium2,
    easing: easing.decelerated,
    properties: ['width', 'background-color'],
  },
  syncComplete: {
    duration: duration.slow1,
    easing: easing.emphasized,
    properties: ['background-color', 'transform'],
  },
  
  // Navigation and routing
  pageTransition: {
    duration: duration.medium4,
    easing: easing.standard,
    properties: ['opacity', 'transform'],
  },
  navHover: {
    duration: duration.fast2,
    easing: easing.decelerated,
    properties: ['background-color', 'color'],
  },
  
  // Error and success states
  errorHighlight: {
    duration: duration.medium2,
    easing: easing.emphasized,
    properties: ['background-color', 'border-color'],
  },
  successFeedback: {
    duration: duration.slow1,
    easing: easing.decelerated,
    properties: ['background-color', 'transform'],
  },
} as const;

// Animation utilities and helpers
export const animationUtils = {
  // Common CSS animation strings
  fadeIn: `opacity ${duration.medium2} ${easing.decelerated}`,
  fadeOut: `opacity ${duration.medium1} ${easing.accelerated}`,
  slideIn: `transform ${duration.medium3} ${easing.decelerated}`,
  slideOut: `transform ${duration.medium2} ${easing.accelerated}`,
  scaleIn: `transform ${duration.medium2} ${easing.emphasized}`,
  scaleOut: `transform ${duration.medium1} ${easing.accelerated}`,
  
  // Stagger calculations
  staggerDelay: (index: number, baseDelay: string = duration.fast2) => {
    const delayMs = parseInt(baseDelay);
    return `${delayMs * index}ms`;
  },
  
  // Reduced motion preferences
  reducedMotion: {
    duration: duration.fast1,
    easing: 'linear',
    transform: 'none',
  },
} as const;

// Keyframe definitions for common animations
export const keyframes = {
  // Loading spinner
  spin: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
  
  // Pulse animation
  pulse: {
    '0%': { opacity: '1' },
    '50%': { opacity: '0.5' },
    '100%': { opacity: '1' },
  },
  
  // Bounce for success states
  bounce: {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.05)' },
    '100%': { transform: 'scale(1)' },
  },
  
  // Slide in from right (for notifications)
  slideInRight: {
    '0%': { transform: 'translateX(100%)', opacity: '0' },
    '100%': { transform: 'translateX(0)', opacity: '1' },
  },
  
  // Fade and scale for modals
  modalEnter: {
    '0%': { transform: 'scale(0.95)', opacity: '0' },
    '100%': { transform: 'scale(1)', opacity: '1' },
  },
  
  // Status change highlight
  highlight: {
    '0%': { backgroundColor: 'transparent' },
    '50%': { backgroundColor: 'rgba(0, 200, 150, 0.1)' }, // Emerald highlight
    '100%': { backgroundColor: 'transparent' },
  },
} as const;

// Utility types
export type EasingToken = keyof typeof easing;
export type DurationToken = keyof typeof duration;
export type MotionRole = keyof typeof semanticMotion;
export type BusinessMotionRole = keyof typeof businessMotion;
export type KeyframeAnimation = keyof typeof keyframes;

// Export unified motion object
export const motion = {
  easing,
  duration,
  semantic: semanticMotion,
  business: businessMotion,
  utils: animationUtils,
  keyframes,
} as const;

export default motion;