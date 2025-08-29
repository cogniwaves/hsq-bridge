/**
 * Animation Utilities for Navigation System
 * Provides consistent animations, timing functions, and micro-interactions
 * for the HSQ Bridge navigation system
 */

// Animation durations (in milliseconds)
export const ANIMATION_DURATIONS = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  extra_slow: 1000,
} as const;

// Easing functions based on Material Design 3
export const EASING_FUNCTIONS = {
  standard: 'cubic-bezier(0.2, 0.0, 0, 1.0)',
  decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  emphasize: 'cubic-bezier(0.2, 0.0, 0, 1)',
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// Animation presets for common navigation interactions
export const ANIMATION_PRESETS = {
  fadeIn: {
    duration: ANIMATION_DURATIONS.fast,
    easing: EASING_FUNCTIONS.decelerate,
    keyframes: [
      { opacity: 0 },
      { opacity: 1 },
    ],
  },
  fadeOut: {
    duration: ANIMATION_DURATIONS.fast,
    easing: EASING_FUNCTIONS.accelerate,
    keyframes: [
      { opacity: 1 },
      { opacity: 0 },
    ],
  },
  scaleIn: {
    duration: ANIMATION_DURATIONS.normal,
    easing: EASING_FUNCTIONS.emphasize,
    keyframes: [
      { transform: 'scale(0.8)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1 },
    ],
  },
  scaleOut: {
    duration: ANIMATION_DURATIONS.fast,
    easing: EASING_FUNCTIONS.accelerate,
    keyframes: [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(0.95)', opacity: 0 },
    ],
  },
  slideInRight: {
    duration: ANIMATION_DURATIONS.normal,
    easing: EASING_FUNCTIONS.emphasize,
    keyframes: [
      { transform: 'translateX(-100%)', opacity: 0 },
      { transform: 'translateX(0)', opacity: 1 },
    ],
  },
  slideOutLeft: {
    duration: ANIMATION_DURATIONS.normal,
    easing: EASING_FUNCTIONS.emphasize,
    keyframes: [
      { transform: 'translateX(0)', opacity: 1 },
      { transform: 'translateX(-100%)', opacity: 0 },
    ],
  },
  expandVertical: {
    duration: ANIMATION_DURATIONS.normal,
    easing: EASING_FUNCTIONS.emphasize,
    keyframes: [
      { height: '0px', overflow: 'hidden' },
      { height: 'auto', overflow: 'visible' },
    ],
  },
  collapseVertical: {
    duration: ANIMATION_DURATIONS.normal,
    easing: EASING_FUNCTIONS.emphasize,
    keyframes: [
      { height: 'auto', overflow: 'visible' },
      { height: '0px', overflow: 'hidden' },
    ],
  },
  ripple: {
    duration: ANIMATION_DURATIONS.slow,
    easing: EASING_FUNCTIONS.decelerate,
    keyframes: [
      { transform: 'scale(0)', opacity: 0.6 },
      { transform: 'scale(4)', opacity: 0 },
    ],
  },
  pulse: {
    duration: ANIMATION_DURATIONS.extra_slow,
    easing: EASING_FUNCTIONS.standard,
    keyframes: [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.05)', opacity: 0.7 },
      { transform: 'scale(1)', opacity: 1 },
    ],
  },
  bounce: {
    duration: ANIMATION_DURATIONS.slow,
    easing: EASING_FUNCTIONS.bounce,
    keyframes: [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-10px)' },
      { transform: 'translateY(0)' },
    ],
  },
  glow: {
    duration: ANIMATION_DURATIONS.normal,
    easing: EASING_FUNCTIONS.standard,
    keyframes: [
      { boxShadow: '0 0 0 rgba(255, 165, 0, 0)' },
      { boxShadow: '0 0 20px rgba(255, 165, 0, 0.3)' },
    ],
  },
  iconRotate: {
    duration: ANIMATION_DURATIONS.normal,
    easing: EASING_FUNCTIONS.emphasize,
    keyframes: [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(180deg)' },
    ],
  },
} as const;

// CSS class generators for animations
export const createAnimationClass = (
  name: string,
  preset: typeof ANIMATION_PRESETS[keyof typeof ANIMATION_PRESETS],
  infinite = false
): string => {
  const animationString = `${name} ${preset.duration}ms ${preset.easing} ${infinite ? 'infinite' : 'forwards'}`;
  return animationString;
};

// CSS custom properties for consistent animation values
export const ANIMATION_CSS_VARIABLES = {
  '--duration-instant': `${ANIMATION_DURATIONS.instant}ms`,
  '--duration-fast': `${ANIMATION_DURATIONS.fast}ms`,
  '--duration-normal': `${ANIMATION_DURATIONS.normal}ms`,
  '--duration-slow': `${ANIMATION_DURATIONS.slow}ms`,
  '--duration-extra-slow': `${ANIMATION_DURATIONS.extra_slow}ms`,
  '--easing-standard': EASING_FUNCTIONS.standard,
  '--easing-decelerate': EASING_FUNCTIONS.decelerate,
  '--easing-accelerate': EASING_FUNCTIONS.accelerate,
  '--easing-emphasize': EASING_FUNCTIONS.emphasize,
  '--easing-sharp': EASING_FUNCTIONS.sharp,
  '--easing-bounce': EASING_FUNCTIONS.bounce,
} as const;

// Animation state management
export interface AnimationState {
  isAnimating: boolean;
  animationType: string | null;
  startTime: number | null;
  endTime: number | null;
}

export class AnimationManager {
  private animations = new Map<string, AnimationState>();
  private callbacks = new Map<string, () => void>();

  startAnimation(
    id: string,
    type: string,
    duration: number,
    onComplete?: () => void
  ): void {
    const now = Date.now();
    
    this.animations.set(id, {
      isAnimating: true,
      animationType: type,
      startTime: now,
      endTime: now + duration,
    });

    if (onComplete) {
      this.callbacks.set(id, onComplete);
      setTimeout(() => {
        this.completeAnimation(id);
      }, duration);
    }
  }

  stopAnimation(id: string): void {
    this.animations.delete(id);
    this.callbacks.delete(id);
  }

  completeAnimation(id: string): void {
    const callback = this.callbacks.get(id);
    this.stopAnimation(id);
    if (callback) callback();
  }

  isAnimating(id: string): boolean {
    const state = this.animations.get(id);
    return state?.isAnimating ?? false;
  }

  getAnimationState(id: string): AnimationState | null {
    return this.animations.get(id) || null;
  }

  getAllAnimatingIds(): string[] {
    return Array.from(this.animations.keys());
  }

  clearAll(): void {
    this.animations.clear();
    this.callbacks.clear();
  }
}

// Micro-interaction helpers
export const createRippleEffect = (
  element: HTMLElement,
  event: React.MouseEvent
): void => {
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  const ripple = document.createElement('div');
  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    background: rgba(255, 165, 0, 0.3);
    border-radius: 50%;
    transform: scale(0);
    animation: nav-ripple ${ANIMATION_DURATIONS.slow}ms ${EASING_FUNCTIONS.decelerate};
    pointer-events: none;
    z-index: 1000;
  `;

  element.style.position = 'relative';
  element.style.overflow = 'hidden';
  element.appendChild(ripple);

  ripple.addEventListener('animationend', () => {
    element.removeChild(ripple);
  });
};

// Focus ring animation
export const createFocusRing = (element: HTMLElement): void => {
  element.style.outline = 'none';
  element.style.boxShadow = `0 0 0 2px rgba(255, 165, 0, 0.5)`;
  element.style.transition = `box-shadow ${ANIMATION_DURATIONS.fast}ms ${EASING_FUNCTIONS.standard}`;
};

export const removeFocusRing = (element: HTMLElement): void => {
  element.style.boxShadow = 'none';
};

// Hover state animations
export const createHoverGlow = (element: HTMLElement): void => {
  element.style.transition = `box-shadow ${ANIMATION_DURATIONS.normal}ms ${EASING_FUNCTIONS.standard}`;
  element.style.boxShadow = '0 0 20px rgba(255, 165, 0, 0.2)';
};

export const removeHoverGlow = (element: HTMLElement): void => {
  element.style.boxShadow = 'none';
};

// Loading state animations
export const createLoadingPulse = (element: HTMLElement): void => {
  element.style.animation = `nav-pulse ${ANIMATION_DURATIONS.extra_slow}ms ${EASING_FUNCTIONS.standard} infinite`;
};

export const removeLoadingPulse = (element: HTMLElement): void => {
  element.style.animation = 'none';
};

// Page transition helpers
export interface PageTransition {
  enter: keyof typeof ANIMATION_PRESETS;
  exit: keyof typeof ANIMATION_PRESETS;
  duration: number;
}

export const PAGE_TRANSITIONS: Record<string, PageTransition> = {
  fade: {
    enter: 'fadeIn',
    exit: 'fadeOut',
    duration: ANIMATION_DURATIONS.fast,
  },
  scale: {
    enter: 'scaleIn',
    exit: 'scaleOut',
    duration: ANIMATION_DURATIONS.normal,
  },
  slide: {
    enter: 'slideInRight',
    exit: 'slideOutLeft',
    duration: ANIMATION_DURATIONS.normal,
  },
};

// Animation performance helpers
export const isAnimationSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'animate' in HTMLElement.prototype;
};

export const isReducedMotionPreferred = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const getOptimalAnimationDuration = (baseDuration: number): number => {
  if (isReducedMotionPreferred()) {
    return Math.max(baseDuration * 0.5, 50); // Reduce duration but maintain minimum
  }
  return baseDuration;
};

// CSS keyframes generator
export const generateKeyframesCSS = (): string => {
  return `
    @keyframes nav-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes nav-fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    @keyframes nav-scale-in {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    
    @keyframes nav-scale-out {
      from { transform: scale(1); opacity: 1; }
      to { transform: scale(0.95); opacity: 0; }
    }
    
    @keyframes nav-slide-in-right {
      from { transform: translateX(-100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes nav-slide-out-left {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(-100%); opacity: 0; }
    }
    
    @keyframes nav-expand-vertical {
      from { height: 0; overflow: hidden; }
      to { height: auto; overflow: visible; }
    }
    
    @keyframes nav-collapse-vertical {
      from { height: auto; overflow: visible; }
      to { height: 0; overflow: hidden; }
    }
    
    @keyframes nav-ripple {
      from { transform: scale(0); opacity: 0.6; }
      to { transform: scale(4); opacity: 0; }
    }
    
    @keyframes nav-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.7; }
    }
    
    @keyframes nav-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes nav-glow {
      from { box-shadow: 0 0 0 rgba(255, 165, 0, 0); }
      to { box-shadow: 0 0 20px rgba(255, 165, 0, 0.3); }
    }
    
    @keyframes nav-icon-rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(180deg); }
    }
    
    @keyframes nav-badge-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    
    @keyframes nav-badge-bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-3px); }
      60% { transform: translateY(-1px); }
    }
    
    @keyframes nav-badge-fade {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }
    
    @keyframes nav-badge-scale {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }
  `;
};

const animationUtils = {
  ANIMATION_DURATIONS,
  EASING_FUNCTIONS,
  ANIMATION_PRESETS,
  ANIMATION_CSS_VARIABLES,
  AnimationManager,
  createRippleEffect,
  createFocusRing,
  removeFocusRing,
  createHoverGlow,
  removeHoverGlow,
  createLoadingPulse,
  removeLoadingPulse,
  PAGE_TRANSITIONS,
  isAnimationSupported,
  isReducedMotionPreferred,
  getOptimalAnimationDuration,
  generateKeyframesCSS,
};

export default animationUtils;