/**
 * Advanced Badge System Hook
 * Live updates, animations, and intelligent badge management
 * for navigation items with real-time data integration
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { NavigationBadge } from '../components/navigation/types';

// Badge types and states
export type BadgeType = 'count' | 'status' | 'new' | 'urgent' | 'success' | 'warning' | 'error';
export type BadgeAnimation = 'none' | 'pulse' | 'bounce' | 'fade' | 'scale';

// Enhanced badge interface
export interface EnhancedBadge extends NavigationBadge {
  /** Unique badge ID */
  id: string;
  /** Badge type for styling */
  type: BadgeType;
  /** Animation type */
  animation?: BadgeAnimation;
  /** Last updated timestamp */
  lastUpdated: number;
  /** Badge priority for display ordering */
  priority?: number;
  /** Auto-hide after specified duration (ms) */
  autoHide?: number;
  /** Custom aria-label for accessibility */
  ariaLabel?: string;
  /** Callback when badge is clicked */
  onClick?: () => void;
  /** Custom CSS class */
  className?: string;
}

// Badge configuration
export interface BadgeConfig {
  /** Maximum number of badges per item */
  maxBadgesPerItem?: number;
  /** Default animation duration */
  animationDuration?: number;
  /** Enable animations */
  enableAnimations?: boolean;
  /** Auto-refresh interval for live badges */
  refreshInterval?: number;
  /** Enable accessibility announcements */
  announceChanges?: boolean;
}

// Badge update data
export interface BadgeUpdate {
  itemId: string;
  badges: EnhancedBadge[];
}

// Hook options
export interface UseBadgesOptions extends BadgeConfig {
  /** Initial badge data */
  initialBadges?: Record<string, EnhancedBadge[]>;
  /** Data fetcher for live updates */
  dataFetcher?: () => Promise<BadgeUpdate[]>;
  /** Badge click handler */
  onBadgeClick?: (badge: EnhancedBadge, itemId: string) => void;
}

// Hook return interface
export interface UseBadgesReturn {
  /** Current badges for all items */
  badges: Record<string, EnhancedBadge[]>;
  /** Get badges for specific item */
  getBadges: (itemId: string) => EnhancedBadge[];
  /** Update badges for an item */
  updateItemBadges: (itemId: string, badges: EnhancedBadge[]) => void;
  /** Add single badge to an item */
  addBadge: (itemId: string, badge: EnhancedBadge) => void;
  /** Remove badge from an item */
  removeBadge: (itemId: string, badgeId: string) => void;
  /** Clear all badges for an item */
  clearItemBadges: (itemId: string) => void;
  /** Clear all badges */
  clearAllBadges: () => void;
  /** Trigger manual refresh */
  refresh: () => Promise<void>;
  /** Get badge component props */
  getBadgeProps: (badge: EnhancedBadge, itemId: string) => {
    key: string;
    className: string;
    style: React.CSSProperties;
    'aria-label': string;
    onClick?: () => void;
    'data-badge-type': BadgeType;
    'data-badge-animation': BadgeAnimation;
  };
  /** Check if item has badges */
  hasBadges: (itemId: string) => boolean;
  /** Get total badge count for item */
  getBadgeCount: (itemId: string) => number;
  /** Loading state */
  isLoading: boolean;
  /** Last refresh timestamp */
  lastRefresh: number | null;
}

// Default badge configuration
const DEFAULT_CONFIG: Required<BadgeConfig> = {
  maxBadgesPerItem: 3,
  animationDuration: 300,
  enableAnimations: true,
  refreshInterval: 30000, // 30 seconds
  announceChanges: true,
};

/**
 * Generate unique badge ID
 */
function generateBadgeId(): string {
  return `badge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sort badges by priority (higher priority first)
 */
function sortBadgesByPriority(badges: EnhancedBadge[]): EnhancedBadge[] {
  return [...badges].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * Create accessibility announcement for badge changes
 */
function createBadgeAnnouncement(itemId: string, badges: EnhancedBadge[]): string {
  if (badges.length === 0) {
    return `${itemId} notifications cleared`;
  }
  
  const counts = badges.reduce((acc, badge) => {
    if (badge.type === 'count' && badge.count) {
      acc.count += badge.count;
    } else {
      acc.other += 1;
    }
    return acc;
  }, { count: 0, other: 0 });
  
  let announcement = '';
  if (counts.count > 0) {
    announcement += `${counts.count} notifications`;
  }
  if (counts.other > 0) {
    if (announcement) announcement += ' and ';
    announcement += `${counts.other} status updates`;
  }
  
  return `${itemId} has ${announcement}`;
}

/**
 * Announce badge changes to screen readers
 */
function announceBadgeChange(announcement: string): void {
  const ariaLive = document.createElement('div');
  ariaLive.setAttribute('aria-live', 'polite');
  ariaLive.setAttribute('aria-atomic', 'true');
  ariaLive.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden';
  ariaLive.textContent = announcement;
  document.body.appendChild(ariaLive);
  setTimeout(() => {
    if (document.body.contains(ariaLive)) {
      document.body.removeChild(ariaLive);
    }
  }, 1000);
}

/**
 * Advanced badge management hook
 */
export function useBadges({
  initialBadges = {},
  dataFetcher,
  onBadgeClick,
  maxBadgesPerItem = DEFAULT_CONFIG.maxBadgesPerItem,
  animationDuration = DEFAULT_CONFIG.animationDuration,
  enableAnimations = DEFAULT_CONFIG.enableAnimations,
  refreshInterval = DEFAULT_CONFIG.refreshInterval,
  announceChanges = DEFAULT_CONFIG.announceChanges,
}: UseBadgesOptions = {}): UseBadgesReturn {
  const [badges, setBadges] = useState<Record<string, EnhancedBadge[]>>(initialBadges);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoHideTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Note: Auto-refresh effect moved after refresh function definition

  // Cleanup auto-hide timeouts
  useEffect(() => {
    return () => {
      autoHideTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      autoHideTimeoutsRef.current.clear();
    };
  }, []);

  // Remove badge from an item (defined early for setupAutoHide)
  const removeBadge = useCallback((itemId: string, badgeId: string) => {
    setBadges(prev => {
      const currentBadges = prev[itemId] || [];
      const updatedBadges = currentBadges.filter(badge => badge.id !== badgeId);
      
      // Clear auto-hide timeout
      const timeoutKey = `${itemId}_${badgeId}`;
      const timeout = autoHideTimeoutsRef.current.get(timeoutKey);
      if (timeout) {
        clearTimeout(timeout);
        autoHideTimeoutsRef.current.delete(timeoutKey);
      }

      // Announce change
      if (announceChanges) {
        const announcement = createBadgeAnnouncement(itemId, updatedBadges);
        announceBadgeChange(announcement);
      }

      if (updatedBadges.length === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [itemId]: updatedBadges };
    });
  }, [announceChanges]);

  // Handle auto-hide badges
  const setupAutoHide = useCallback((itemId: string, badge: EnhancedBadge) => {
    if (!badge.autoHide) return;

    const timeoutKey = `${itemId}_${badge.id}`;
    
    // Clear existing timeout for this badge
    const existingTimeout = autoHideTimeoutsRef.current.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      removeBadge(itemId, badge.id);
      autoHideTimeoutsRef.current.delete(timeoutKey);
    }, badge.autoHide);

    autoHideTimeoutsRef.current.set(timeoutKey, timeout);
  }, [removeBadge]);

  // Get badges for specific item
  const getBadges = useCallback((itemId: string): EnhancedBadge[] => {
    const itemBadges = badges[itemId] || [];
    const sortedBadges = sortBadgesByPriority(itemBadges);
    return sortedBadges.slice(0, maxBadgesPerItem);
  }, [badges, maxBadgesPerItem]);

  // Update badges for an item
  const updateItemBadges = useCallback((itemId: string, newBadges: EnhancedBadge[]) => {
    const enhancedBadges = newBadges.map(badge => ({
      ...badge,
      id: badge.id || generateBadgeId(),
      lastUpdated: badge.lastUpdated || Date.now(),
    }));

    setBadges(prev => {
      const updated = { ...prev, [itemId]: enhancedBadges };
      
      // Setup auto-hide for new badges
      enhancedBadges.forEach(badge => {
        if (badge.autoHide) {
          setupAutoHide(itemId, badge);
        }
      });

      // Announce changes
      if (announceChanges) {
        const announcement = createBadgeAnnouncement(itemId, enhancedBadges);
        announceBadgeChange(announcement);
      }

      return updated;
    });
  }, [setupAutoHide, announceChanges]);

  // Add single badge to an item
  const addBadge = useCallback((itemId: string, badge: EnhancedBadge) => {
    const enhancedBadge = {
      ...badge,
      id: badge.id || generateBadgeId(),
      lastUpdated: badge.lastUpdated || Date.now(),
    };

    setBadges(prev => {
      const currentBadges = prev[itemId] || [];
      const updatedBadges = [...currentBadges, enhancedBadge];
      
      // Setup auto-hide
      if (enhancedBadge.autoHide) {
        setupAutoHide(itemId, enhancedBadge);
      }

      // Announce change
      if (announceChanges) {
        const announcement = createBadgeAnnouncement(itemId, updatedBadges);
        announceBadgeChange(announcement);
      }

      return { ...prev, [itemId]: updatedBadges };
    });
  }, [setupAutoHide, announceChanges]);


  // Clear all badges for an item
  const clearItemBadges = useCallback((itemId: string) => {
    setBadges(prev => {
      // Clear auto-hide timeouts for this item
      const itemBadges = prev[itemId] || [];
      itemBadges.forEach(badge => {
        const timeoutKey = `${itemId}_${badge.id}`;
        const timeout = autoHideTimeoutsRef.current.get(timeoutKey);
        if (timeout) {
          clearTimeout(timeout);
          autoHideTimeoutsRef.current.delete(timeoutKey);
        }
      });

      // Announce change
      if (announceChanges) {
        const announcement = createBadgeAnnouncement(itemId, []);
        announceBadgeChange(announcement);
      }

      const { [itemId]: _, ...rest } = prev;
      return rest;
    });
  }, [announceChanges]);

  // Clear all badges
  const clearAllBadges = useCallback(() => {
    // Clear all timeouts
    autoHideTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    autoHideTimeoutsRef.current.clear();

    setBadges({});

    if (announceChanges) {
      announceBadgeChange('All notifications cleared');
    }
  }, [announceChanges]);

  // Trigger manual refresh
  const refresh = useCallback(async () => {
    if (!dataFetcher) return;

    setIsLoading(true);
    try {
      const updates = await dataFetcher();
      
      // Process updates
      const newBadges: Record<string, EnhancedBadge[]> = {};
      updates.forEach(update => {
        newBadges[update.itemId] = update.badges.map(badge => ({
          ...badge,
          id: badge.id || generateBadgeId(),
          lastUpdated: badge.lastUpdated || Date.now(),
        }));
      });

      setBadges(newBadges);
      setLastRefresh(Date.now());

      // Setup auto-hide for all new badges
      Object.entries(newBadges).forEach(([itemId, itemBadges]) => {
        itemBadges.forEach(badge => {
          if (badge.autoHide) {
            setupAutoHide(itemId, badge);
          }
        });
      });

    } catch (error) {
      console.error('Failed to refresh badges:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dataFetcher, setupAutoHide]);

  // Setup auto-refresh
  useEffect(() => {
    if (!dataFetcher || refreshInterval <= 0) return;

    const startAutoRefresh = () => {
      refreshIntervalRef.current = setInterval(async () => {
        try {
          await refresh();
        } catch (error) {
          console.warn('Badge auto-refresh failed:', error);
        }
      }, refreshInterval);
    };

    startAutoRefresh();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [dataFetcher, refreshInterval, refresh]);

  // Get badge component props
  const getBadgeProps = useCallback((badge: EnhancedBadge, itemId: string) => {
    const handleClick = () => {
      if (badge.onClick) {
        badge.onClick();
      }
      if (onBadgeClick) {
        onBadgeClick(badge, itemId);
      }
    };

    return {
      key: badge.id,
      className: `nav-badge nav-badge--${badge.type} ${badge.className || ''} ${
        badge.pulse ? 'nav-badge--pulse' : ''
      }`.trim(),
      style: {
        '--badge-animation-duration': `${animationDuration}ms`,
        animationName: enableAnimations && badge.animation !== 'none' 
          ? `nav-badge-${badge.animation || 'fade'}` 
          : undefined,
        cursor: (badge.onClick || onBadgeClick) ? 'pointer' : undefined,
      } as React.CSSProperties,
      'aria-label': badge.ariaLabel || `${badge.text || badge.count} notification${badge.count !== 1 ? 's' : ''}`,
      onClick: (badge.onClick || onBadgeClick) ? handleClick : undefined,
      'data-badge-type': badge.type,
      'data-badge-animation': badge.animation || 'none',
    };
  }, [animationDuration, enableAnimations, onBadgeClick]);

  // Check if item has badges
  const hasBadges = useCallback((itemId: string): boolean => {
    const itemBadges = badges[itemId];
    return Array.isArray(itemBadges) && itemBadges.length > 0;
  }, [badges]);

  // Get total badge count for item
  const getBadgeCount = useCallback((itemId: string): number => {
    const itemBadges = badges[itemId] || [];
    return itemBadges.reduce((total, badge) => {
      if (badge.type === 'count' && typeof badge.count === 'number') {
        return total + badge.count;
      }
      return total + 1;
    }, 0);
  }, [badges]);

  return {
    badges,
    getBadges,
    updateItemBadges,
    addBadge,
    removeBadge,
    clearItemBadges,
    clearAllBadges,
    refresh,
    getBadgeProps,
    hasBadges,
    getBadgeCount,
    isLoading,
    lastRefresh,
  };
}

export default useBadges;