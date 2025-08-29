/**
 * Gesture Recognition Utilities
 * Touch and swipe gesture handling for mobile navigation
 * with proper touch target optimization and haptic feedback simulation
 */

'use client';

// Gesture types
export type GestureType = 'swipe' | 'tap' | 'press' | 'pinch' | 'pan';
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

// Touch configuration
export interface TouchConfig {
  /** Minimum distance for swipe recognition (px) */
  swipeThreshold: number;
  /** Maximum time for tap recognition (ms) */
  tapTimeout: number;
  /** Minimum time for press recognition (ms) */
  pressTimeout: number;
  /** Velocity threshold for swipe detection */
  velocityThreshold: number;
  /** Maximum movement for tap recognition (px) */
  tapMaxMovement: number;
  /** Touch target minimum size (px) */
  minTouchTarget: number;
  /** Enable haptic feedback simulation */
  hapticFeedback: boolean;
}

// Default touch configuration
export const DEFAULT_TOUCH_CONFIG: TouchConfig = {
  swipeThreshold: 50,
  tapTimeout: 300,
  pressTimeout: 500,
  velocityThreshold: 0.5,
  tapMaxMovement: 10,
  minTouchTarget: 44, // Apple's recommended minimum
  hapticFeedback: true,
};

// Touch event data
export interface TouchEventData {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  startTime: number;
  currentTime: number;
  duration: number;
  velocity: number;
  distance: number;
  direction: SwipeDirection | null;
}

// Gesture event handlers
export interface GestureHandlers {
  onSwipe?: (direction: SwipeDirection, data: TouchEventData) => void;
  onTap?: (data: TouchEventData) => void;
  onPress?: (data: TouchEventData) => void;
  onPanStart?: (data: TouchEventData) => void;
  onPanMove?: (data: TouchEventData) => void;
  onPanEnd?: (data: TouchEventData) => void;
}

// Touch point tracking
interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Calculate distance between two points
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Calculate velocity (pixels per millisecond)
 */
function calculateVelocity(distance: number, duration: number): number {
  return duration > 0 ? distance / duration : 0;
}

/**
 * Determine swipe direction
 */
function determineSwipeDirection(deltaX: number, deltaY: number): SwipeDirection {
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);
  
  if (absDeltaX > absDeltaY) {
    return deltaX > 0 ? 'right' : 'left';
  } else {
    return deltaY > 0 ? 'down' : 'up';
  }
}

/**
 * Simulate haptic feedback
 */
function simulateHapticFeedback(type: 'light' | 'medium' | 'heavy' = 'medium'): void {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [50],
    };
    navigator.vibrate(patterns[type]);
  }
}

/**
 * Ensure element meets touch target size requirements
 */
export function validateTouchTarget(element: HTMLElement, minSize: number = DEFAULT_TOUCH_CONFIG.minTouchTarget): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width >= minSize && rect.height >= minSize;
}

/**
 * Apply touch target optimizations
 */
export function optimizeTouchTarget(element: HTMLElement, minSize: number = DEFAULT_TOUCH_CONFIG.minTouchTarget): void {
  const rect = element.getBoundingClientRect();
  const style = element.style;
  
  if (rect.width < minSize) {
    const padding = (minSize - rect.width) / 2;
    style.paddingLeft = Math.max(parseInt(style.paddingLeft || '0'), padding) + 'px';
    style.paddingRight = Math.max(parseInt(style.paddingRight || '0'), padding) + 'px';
  }
  
  if (rect.height < minSize) {
    const padding = (minSize - rect.height) / 2;
    style.paddingTop = Math.max(parseInt(style.paddingTop || '0'), padding) + 'px';
    style.paddingBottom = Math.max(parseInt(style.paddingBottom || '0'), padding) + 'px';
  }
}

/**
 * Enhanced gesture recognizer class
 */
export class GestureRecognizer {
  private element: HTMLElement;
  private config: TouchConfig;
  private handlers: GestureHandlers;
  private touchStart: TouchPoint | null = null;
  private isTracking = false;
  private pressTimer: NodeJS.Timeout | null = null;
  private isPanning = false;

  constructor(
    element: HTMLElement,
    handlers: GestureHandlers,
    config: Partial<TouchConfig> = {}
  ) {
    this.element = element;
    this.handlers = handlers;
    this.config = { ...DEFAULT_TOUCH_CONFIG, ...config };
    
    this.bindEvents();
    
    // Optimize touch targets
    if (this.config.minTouchTarget > 0) {
      optimizeTouchTarget(element, this.config.minTouchTarget);
    }
  }

  private bindEvents(): void {
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
    
    // Mouse events for desktop testing
    this.element.addEventListener('mousedown', this.handleMouseDown);
    this.element.addEventListener('mousemove', this.handleMouseMove);
    this.element.addEventListener('mouseup', this.handleMouseUp);
    this.element.addEventListener('mouseleave', this.handleMouseLeave);
  }

  private unbindEvents(): void {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);
    
    this.element.removeEventListener('mousedown', this.handleMouseDown);
    this.element.removeEventListener('mousemove', this.handleMouseMove);
    this.element.removeEventListener('mouseup', this.handleMouseUp);
    this.element.removeEventListener('mouseleave', this.handleMouseLeave);
  }

  private createTouchEventData(): TouchEventData | null {
    if (!this.touchStart) return null;
    
    const currentTime = Date.now();
    const duration = currentTime - this.touchStart.timestamp;
    const deltaX = this.touchStart.x;
    const deltaY = this.touchStart.y;
    const distance = calculateDistance(0, 0, deltaX, deltaY);
    const velocity = calculateVelocity(distance, duration);
    const direction = distance > this.config.swipeThreshold ? determineSwipeDirection(deltaX, deltaY) : null;
    
    return {
      startX: this.touchStart.x,
      startY: this.touchStart.y,
      currentX: this.touchStart.x + deltaX,
      currentY: this.touchStart.y + deltaY,
      deltaX,
      deltaY,
      startTime: this.touchStart.timestamp,
      currentTime,
      duration,
      velocity,
      distance,
      direction,
    };
  }

  private handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.startTouch(touch.clientX, touch.clientY);
      
      // Prevent default to avoid conflicts with native gestures
      if (this.handlers.onPanStart || this.handlers.onSwipe) {
        event.preventDefault();
      }
    }
  };

  private handleTouchMove = (event: TouchEvent): void => {
    if (this.isTracking && event.touches.length === 1) {
      const touch = event.touches[0];
      this.updateTouch(touch.clientX, touch.clientY);
      event.preventDefault();
    }
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    if (this.isTracking) {
      this.endTouch();
      event.preventDefault();
    }
  };

  private handleTouchCancel = (): void => {
    this.cancelTouch();
  };

  private handleMouseDown = (event: MouseEvent): void => {
    this.startTouch(event.clientX, event.clientY);
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (this.isTracking) {
      this.updateTouch(event.clientX, event.clientY);
    }
  };

  private handleMouseUp = (): void => {
    if (this.isTracking) {
      this.endTouch();
    }
  };

  private handleMouseLeave = (): void => {
    this.cancelTouch();
  };

  private startTouch(x: number, y: number): void {
    this.touchStart = {
      id: Date.now(),
      x,
      y,
      timestamp: Date.now(),
    };
    
    this.isTracking = true;
    this.isPanning = false;
    
    // Start press timer
    if (this.handlers.onPress) {
      this.pressTimer = setTimeout(() => {
        if (this.isTracking) {
          const data = this.createTouchEventData();
          if (data) {
            this.handlers.onPress!(data);
            if (this.config.hapticFeedback) {
              simulateHapticFeedback('medium');
            }
          }
        }
      }, this.config.pressTimeout);
    }
  }

  private updateTouch(x: number, y: number): void {
    if (!this.touchStart || !this.isTracking) return;
    
    const deltaX = x - this.touchStart.x;
    const deltaY = y - this.touchStart.y;
    const distance = calculateDistance(0, 0, deltaX, deltaY);
    
    // Update touch point
    this.touchStart = {
      ...this.touchStart,
      x: this.touchStart.x,
      y: this.touchStart.y,
    };
    
    // Check if we should start panning
    if (!this.isPanning && distance > this.config.tapMaxMovement) {
      this.isPanning = true;
      this.clearPressTimer();
      
      const data = this.createTouchEventData();
      if (data && this.handlers.onPanStart) {
        this.handlers.onPanStart(data);
      }
    }
    
    // Continue panning
    if (this.isPanning && this.handlers.onPanMove) {
      const data = this.createTouchEventData();
      if (data) {
        this.handlers.onPanMove(data);
      }
    }
  }

  private endTouch(): void {
    if (!this.isTracking) return;
    
    const data = this.createTouchEventData();
    this.clearPressTimer();
    
    if (data) {
      if (this.isPanning) {
        // End panning
        if (this.handlers.onPanEnd) {
          this.handlers.onPanEnd(data);
        }
        
        // Check for swipe
        if (data.velocity > this.config.velocityThreshold && 
            data.distance > this.config.swipeThreshold && 
            data.direction) {
          this.handlers.onSwipe?.(data.direction, data);
          
          if (this.config.hapticFeedback) {
            simulateHapticFeedback('light');
          }
        }
      } else {
        // Check for tap
        if (data.duration <= this.config.tapTimeout && 
            data.distance <= this.config.tapMaxMovement) {
          this.handlers.onTap?.(data);
          
          if (this.config.hapticFeedback) {
            simulateHapticFeedback('light');
          }
        }
      }
    }
    
    this.resetState();
  }

  private cancelTouch(): void {
    this.clearPressTimer();
    this.resetState();
  }

  private clearPressTimer(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  private resetState(): void {
    this.touchStart = null;
    this.isTracking = false;
    this.isPanning = false;
  }

  public destroy(): void {
    this.clearPressTimer();
    this.unbindEvents();
    this.resetState();
  }

  public updateConfig(config: Partial<TouchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public updateHandlers(handlers: Partial<GestureHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }
}

import React from 'react';

/**
 * React hook for gesture handling
 */
export function useGestures(
  ref: React.RefObject<HTMLElement>,
  handlers: GestureHandlers,
  config?: Partial<TouchConfig>
): {
  gestureRecognizer: GestureRecognizer | null;
  isSupported: boolean;
} {
  const gestureRecognizerRef = React.useRef<GestureRecognizer | null>(null);
  
  const isSupported = React.useMemo(() => {
    return typeof window !== 'undefined' && 
           ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  React.useEffect(() => {
    if (!ref.current) return;
    
    const recognizer = new GestureRecognizer(ref.current, handlers, config);
    gestureRecognizerRef.current = recognizer;
    
    return () => {
      recognizer.destroy();
      gestureRecognizerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers, config]); // ref is not included because mutable values like ref.current aren't valid dependencies

  React.useEffect(() => {
    if (gestureRecognizerRef.current) {
      gestureRecognizerRef.current.updateHandlers(handlers);
    }
  }, [handlers]);

  return {
    gestureRecognizer: gestureRecognizerRef.current,
    isSupported,
  };
}

// Navigation-specific gesture configurations
export const NAVIGATION_GESTURE_CONFIGS = {
  drawer: {
    swipeThreshold: 30,
    velocityThreshold: 0.3,
    hapticFeedback: true,
  },
  rail: {
    swipeThreshold: 50,
    tapTimeout: 200,
    hapticFeedback: false,
  },
  modal: {
    swipeThreshold: 40,
    velocityThreshold: 0.4,
    hapticFeedback: true,
  },
} as const;

const gestureUtils = {
  GestureRecognizer,
  useGestures,
  validateTouchTarget,
  optimizeTouchTarget,
  simulateHapticFeedback,
  NAVIGATION_GESTURE_CONFIGS,
  DEFAULT_TOUCH_CONFIG,
};

export default gestureUtils;