/**
 * Enhanced Tooltip System Hook
 * Intelligent positioning, timing, and accessibility for navigation tooltips
 * Optimized for rail mode navigation
 */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NavigationItem, NavigationBadge } from '../components/navigation/types';

// Tooltip positioning options
export type TooltipPosition = 'right' | 'left' | 'top' | 'bottom';

// Tooltip content types
export interface TooltipContent {
  title: string;
  description?: string;
  badge?: NavigationBadge;
  shortcut?: string;
}

// Tooltip state
export interface TooltipState {
  isVisible: boolean;
  content: TooltipContent | null;
  position: TooltipPosition;
  coordinates: { x: number; y: number };
  targetElement: HTMLElement | null;
}

// Hook options
export interface UseTooltipsOptions {
  /** Show delay in milliseconds */
  showDelay?: number;
  /** Hide delay in milliseconds */
  hideDelay?: number;
  /** Default tooltip position */
  defaultPosition?: TooltipPosition;
  /** Viewport margin for collision detection */
  viewportMargin?: number;
  /** Enable keyboard triggered tooltips */
  keyboardTriggered?: boolean;
  /** Enable rich tooltip content */
  richContent?: boolean;
}

// Hook return interface
export interface UseTooltipsReturn {
  /** Current tooltip state */
  tooltipState: TooltipState;
  /** Show tooltip for an element */
  showTooltip: (
    element: HTMLElement,
    content: TooltipContent,
    position?: TooltipPosition
  ) => void;
  /** Hide current tooltip */
  hideTooltip: () => void;
  /** Show tooltip for navigation item */
  showItemTooltip: (element: HTMLElement, item: NavigationItem) => void;
  /** Tooltip ref for portal rendering */
  tooltipRef: React.RefObject<HTMLDivElement>;
  /** Get tooltip portal props */
  getTooltipProps: () => {
    ref: React.RefObject<HTMLDivElement>;
    role: string;
    'aria-hidden': boolean;
    style: React.CSSProperties;
    className: string;
  };
  /** Check if tooltips are supported in current environment */
  isSupported: boolean;
}

// Viewport collision detection
interface CollisionDetection {
  right: boolean;
  left: boolean;
  top: boolean;
  bottom: boolean;
}

/**
 * Calculate optimal tooltip position based on element and viewport
 */
function calculateOptimalPosition(
  element: HTMLElement,
  preferredPosition: TooltipPosition,
  tooltipSize: { width: number; height: number },
  viewportMargin: number
): {
  position: TooltipPosition;
  coordinates: { x: number; y: number };
  collision: CollisionDetection;
} {
  const rect = element.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  // Calculate potential positions
  const positions = {
    right: {
      x: rect.right + 8,
      y: rect.top + rect.height / 2 - tooltipSize.height / 2,
    },
    left: {
      x: rect.left - tooltipSize.width - 8,
      y: rect.top + rect.height / 2 - tooltipSize.height / 2,
    },
    top: {
      x: rect.left + rect.width / 2 - tooltipSize.width / 2,
      y: rect.top - tooltipSize.height - 8,
    },
    bottom: {
      x: rect.left + rect.width / 2 - tooltipSize.width / 2,
      y: rect.bottom + 8,
    },
  };

  // Check collision for each position
  const checkCollision = (pos: { x: number; y: number }): CollisionDetection => ({
    right: pos.x + tooltipSize.width + viewportMargin > viewport.width,
    left: pos.x - viewportMargin < 0,
    top: pos.y - viewportMargin < 0,
    bottom: pos.y + tooltipSize.height + viewportMargin > viewport.height,
  });

  // Priority order for positions (fallback sequence)
  const positionPriority: TooltipPosition[] = [
    preferredPosition,
    preferredPosition === 'right' ? 'left' : 'right',
    'top',
    'bottom',
  ].filter((pos, index, arr) => arr.indexOf(pos) === index); // Remove duplicates

  // Find best position
  for (const position of positionPriority) {
    const coords = positions[position];
    const collision = checkCollision(coords);
    
    // Check if position fits without collision
    const hasCollision = collision.right || collision.left || collision.top || collision.bottom;
    
    if (!hasCollision) {
      return { position, coordinates: coords, collision };
    }
  }

  // If all positions have collisions, use preferred with clamping
  const fallbackCoords = positions[preferredPosition];
  const collision = checkCollision(fallbackCoords);

  // Clamp to viewport
  const clampedCoords = {
    x: Math.max(
      viewportMargin,
      Math.min(fallbackCoords.x, viewport.width - tooltipSize.width - viewportMargin)
    ),
    y: Math.max(
      viewportMargin,
      Math.min(fallbackCoords.y, viewport.height - tooltipSize.height - viewportMargin)
    ),
  };

  return {
    position: preferredPosition,
    coordinates: clampedCoords,
    collision,
  };
}

/**
 * Generate tooltip content from navigation item
 */
function getTooltipContentFromItem(item: NavigationItem): TooltipContent {
  return {
    title: item.label,
    description: item.description,
    badge: item.badge,
    shortcut: undefined, // Could be extracted from item metadata
  };
}

/**
 * Enhanced tooltips hook for navigation system
 */
export function useTooltips({
  showDelay = 500,
  hideDelay = 100,
  defaultPosition = 'right',
  viewportMargin = 16,
  keyboardTriggered = true,
  richContent = true,
}: UseTooltipsOptions = {}): UseTooltipsReturn {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const measureElementRef = useRef<HTMLDivElement | null>(null);

  // Tooltip state
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    isVisible: false,
    content: null,
    position: defaultPosition,
    coordinates: { x: 0, y: 0 },
    targetElement: null,
  });

  // Check if tooltips are supported
  const isSupported = useMemo(() => {
    return typeof window !== 'undefined' && 'IntersectionObserver' in window;
  }, []);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Hide tooltip when clicking outside or scrolling
  useEffect(() => {
    if (!tooltipState.isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!tooltipRef.current?.contains(target) && !tooltipState.targetElement?.contains(target)) {
        hideTooltip();
      }
    };

    const handleScroll = () => {
      hideTooltip();
    };

    const handleResize = () => {
      hideTooltip();
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [tooltipState.isVisible, tooltipState.targetElement]);

  // Keyboard support
  useEffect(() => {
    if (!keyboardTriggered || !tooltipState.isVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideTooltip();
        // Return focus to target element
        if (tooltipState.targetElement) {
          tooltipState.targetElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboardTriggered, tooltipState.isVisible, tooltipState.targetElement]);

  // Measure tooltip size for positioning
  const measureTooltipSize = useCallback((content: TooltipContent): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      if (!measureElementRef.current) {
        // Create temporary measure element
        const measureEl = document.createElement('div');
        measureEl.style.cssText = `
          position: absolute;
          visibility: hidden;
          pointer-events: none;
          top: -9999px;
          left: -9999px;
        `;
        measureEl.className = 'nav-tooltip';
        document.body.appendChild(measureEl);
        measureElementRef.current = measureEl;
      }

      const measureEl = measureElementRef.current;
      
      // Set content for measurement
      measureEl.innerHTML = `
        <div class="nav-tooltip-content">
          <div class="nav-tooltip-title">${content.title}</div>
          ${content.description ? `<div class="nav-tooltip-description">${content.description}</div>` : ''}
          ${content.badge ? `<div class="nav-tooltip-badge">${content.badge.text || content.badge.count}</div>` : ''}
        </div>
      `;

      // Wait for next frame to ensure styles are applied
      requestAnimationFrame(() => {
        const rect = measureEl.getBoundingClientRect();
        resolve({
          width: Math.max(rect.width, 200), // Minimum width
          height: rect.height,
        });
      });
    });
  }, []);

  // Show tooltip
  const showTooltip = useCallback(
    async (
      element: HTMLElement,
      content: TooltipContent,
      position: TooltipPosition = defaultPosition
    ) => {
      if (!isSupported) return;

      // Clear any existing timeouts
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }

      showTimeoutRef.current = setTimeout(async () => {
        try {
          // Measure tooltip size
          const tooltipSize = await measureTooltipSize(content);
          
          // Calculate optimal position
          const { position: finalPosition, coordinates } = calculateOptimalPosition(
            element,
            position,
            tooltipSize,
            viewportMargin
          );

          setTooltipState({
            isVisible: true,
            content,
            position: finalPosition,
            coordinates,
            targetElement: element,
          });

          // Announce to screen readers (if enabled)
          if (keyboardTriggered && document.activeElement === element) {
            const announcement = `${content.title}${content.description ? `, ${content.description}` : ''}`;
            const ariaLive = document.createElement('div');
            ariaLive.setAttribute('aria-live', 'polite');
            ariaLive.setAttribute('aria-atomic', 'true');
            ariaLive.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden';
            ariaLive.textContent = announcement;
            document.body.appendChild(ariaLive);
            setTimeout(() => document.body.removeChild(ariaLive), 1000);
          }
        } catch (error) {
          console.warn('Failed to show tooltip:', error);
        }
      }, showDelay);
    },
    [isSupported, defaultPosition, measureTooltipSize, viewportMargin, showDelay, keyboardTriggered]
  );

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    hideTimeoutRef.current = setTimeout(() => {
      setTooltipState(prev => ({
        ...prev,
        isVisible: false,
        content: null,
        targetElement: null,
      }));
    }, hideDelay);
  }, [hideDelay]);

  // Show tooltip for navigation item
  const showItemTooltip = useCallback(
    (element: HTMLElement, item: NavigationItem) => {
      const content = getTooltipContentFromItem(item);
      showTooltip(element, content);
    },
    [showTooltip]
  );

  // Get tooltip props for portal rendering
  const getTooltipProps = useCallback(() => {
    const baseProps = {
      ref: tooltipRef,
      role: 'tooltip',
      'aria-hidden': !tooltipState.isVisible,
      className: `nav-tooltip nav-tooltip--${tooltipState.position} ${
        tooltipState.isVisible ? 'nav-tooltip--visible' : ''
      } ${richContent ? 'nav-tooltip--rich' : ''}`,
      style: {
        position: 'fixed' as const,
        left: tooltipState.coordinates.x,
        top: tooltipState.coordinates.y,
        zIndex: 700, // From navigation tokens
        opacity: tooltipState.isVisible ? 1 : 0,
        transform: tooltipState.isVisible ? 'scale(1)' : 'scale(0.95)',
        transition: 'opacity 150ms ease, transform 150ms ease',
        pointerEvents: 'none' as const,
      } as React.CSSProperties,
    };

    return baseProps;
  }, [tooltipState, richContent]);

  // Cleanup measure element on unmount
  useEffect(() => {
    return () => {
      if (measureElementRef.current) {
        document.body.removeChild(measureElementRef.current);
        measureElementRef.current = null;
      }
    };
  }, []);

  return {
    tooltipState,
    showTooltip,
    hideTooltip,
    showItemTooltip,
    tooltipRef,
    getTooltipProps,
    isSupported,
  };
}

export default useTooltips;