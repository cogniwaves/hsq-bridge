/**
 * Smart Navigation Behaviors Hook
 * Intelligent navigation features including auto-hide, breadcrumbs,
 * recent items, contextual navigation, and adaptive behaviors
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { NavigationItem, NavigationSection } from '../components/navigation/types';

// Breadcrumb item interface
export interface BreadcrumbItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode | string;
  isActive?: boolean;
}

// Recent item interface
export interface RecentItem {
  id: string;
  item: NavigationItem;
  lastAccessed: number;
  accessCount: number;
  href: string;
}

// Contextual suggestion interface
export interface ContextualSuggestion {
  id: string;
  item: NavigationItem;
  reason: string;
  priority: number;
  category: 'related' | 'frequent' | 'recommended' | 'workflow';
}

// Page context interface
export interface PageContext {
  path: string;
  title: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

// Auto-hide configuration
export interface AutoHideConfig {
  enabled: boolean;
  threshold: number; // Scroll threshold in pixels
  delay: number; // Delay before hiding in ms
  showOnMouseMove: boolean;
  showOnHover: boolean;
}

// Hook options
export interface UseSmartNavigationOptions {
  /** Navigation sections */
  sections: NavigationSection[];
  /** Current navigation mode */
  mode: 'rail' | 'drawer' | 'modal';
  /** Enable breadcrumb generation */
  enableBreadcrumbs?: boolean;
  /** Enable recent items tracking */
  enableRecentItems?: boolean;
  /** Maximum recent items to track */
  maxRecentItems?: number;
  /** Enable contextual suggestions */
  enableContextualSuggestions?: boolean;
  /** Auto-hide configuration */
  autoHideConfig?: AutoHideConfig;
  /** Enable scroll-based behaviors */
  enableScrollBehaviors?: boolean;
  /** Custom page context mapping */
  pageContextMap?: Record<string, PageContext>;
  /** Recent items storage key */
  recentItemsStorageKey?: string;
}

// Hook return interface
export interface UseSmartNavigationReturn {
  /** Current breadcrumb trail */
  breadcrumbs: BreadcrumbItem[];
  /** Recent navigation items */
  recentItems: RecentItem[];
  /** Contextual navigation suggestions */
  contextualSuggestions: ContextualSuggestion[];
  /** Auto-hide navigation state */
  isAutoHidden: boolean;
  /** Current page context */
  pageContext: PageContext | null;
  
  /** Update recent items when navigating */
  trackNavigation: (item: NavigationItem) => void;
  /** Clear recent items */
  clearRecentItems: () => void;
  /** Get related navigation items */
  getRelatedItems: (currentItem: NavigationItem) => NavigationItem[];
  /** Force show/hide navigation */
  setNavigationVisible: (visible: boolean) => void;
  /** Get navigation visibility */
  isNavigationVisible: () => boolean;
  
  // Scroll behavior controls
  /** Scroll event handler for auto-hide */
  handleScroll: (event: Event) => void;
  /** Mouse move handler for auto-show */
  handleMouseMove: (event: MouseEvent) => void;
  /** Mouse enter handler for navigation area */
  handleMouseEnter: () => void;
  /** Mouse leave handler for navigation area */
  handleMouseLeave: () => void;
  
  // UI helpers
  /** Get breadcrumb props for rendering */
  getBreadcrumbProps: () => {
    items: BreadcrumbItem[];
    separator?: React.ReactNode;
    maxItems?: number;
  };
  /** Get recent items props */
  getRecentItemsProps: () => {
    items: RecentItem[];
    onItemClick: (item: RecentItem) => void;
    emptyMessage: string;
  };
  /** Get contextual suggestions props */
  getContextualSuggestionsProps: () => {
    suggestions: ContextualSuggestion[];
    onSuggestionClick: (suggestion: ContextualSuggestion) => void;
    groupedByCategory: Record<string, ContextualSuggestion[]>;
  };
}

// Default auto-hide configuration
const DEFAULT_AUTO_HIDE_CONFIG: AutoHideConfig = {
  enabled: true,
  threshold: 100,
  delay: 2000,
  showOnMouseMove: true,
  showOnHover: true,
};

// Storage keys
const RECENT_ITEMS_KEY = 'hsq-bridge-recent-nav-items';
const PAGE_ANALYTICS_KEY = 'hsq-bridge-page-analytics';

/**
 * Generate breadcrumbs from current path
 */
function generateBreadcrumbs(
  pathname: string,
  sections: NavigationSection[],
  pageContextMap?: Record<string, PageContext>
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [];
  
  // Add home breadcrumb
  breadcrumbs.push({
    id: 'home',
    label: 'Dashboard',
    href: '/',
    icon: 'HomeIcon',
  });
  
  // Find matching navigation item
  const findItemByPath = (items: NavigationItem[], targetPath: string): NavigationItem | null => {
    for (const item of items) {
      if (item.href === targetPath) return item;
      if (item.children) {
        const child = findItemByPath(item.children, targetPath);
        if (child) return child;
      }
    }
    return null;
  };
  
  let matchedItem: NavigationItem | null = null;
  let matchedSection: NavigationSection | null = null;
  
  for (const section of sections) {
    matchedItem = findItemByPath(section.items, pathname);
    if (matchedItem) {
      matchedSection = section;
      break;
    }
  }
  
  if (matchedSection && matchedItem) {
    // Add section breadcrumb if it has a title
    if (matchedSection.title) {
      breadcrumbs.push({
        id: matchedSection.id,
        label: matchedSection.title,
        href: undefined, // Section headers are not clickable
      });
    }
    
    // Add item breadcrumb
    breadcrumbs.push({
      id: matchedItem.id,
      label: matchedItem.label,
      href: matchedItem.href,
      icon: matchedItem.icon,
      isActive: true,
    });
  } else {
    // Use page context mapping
    const pageContext = pageContextMap?.[pathname];
    if (pageContext) {
      breadcrumbs.push({
        id: 'current',
        label: pageContext.title,
        href: pathname,
        isActive: true,
      });
    }
  }
  
  return breadcrumbs;
}

/**
 * Load recent items from storage
 */
function loadRecentItems(storageKey: string): RecentItem[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to load recent navigation items:', error);
    return [];
  }
}

/**
 * Save recent items to storage
 */
function saveRecentItems(items: RecentItem[], storageKey: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch (error) {
    console.warn('Failed to save recent navigation items:', error);
  }
}

/**
 * Generate contextual suggestions based on current page and usage patterns
 */
function generateContextualSuggestions(
  currentPath: string,
  sections: NavigationSection[],
  recentItems: RecentItem[],
  pageContext: PageContext | null
): ContextualSuggestion[] {
  const suggestions: ContextualSuggestion[] = [];
  
  // Get all navigable items
  const allItems: NavigationItem[] = [];
  sections.forEach(section => {
    const addItems = (items: NavigationItem[]) => {
      items.forEach(item => {
        if (item.href && item.visible !== false && !item.disabled) {
          allItems.push(item);
        }
        if (item.children) {
          addItems(item.children);
        }
      });
    };
    addItems(section.items);
  });
  
  // Related items based on current page category
  if (pageContext?.category) {
    const relatedItems = allItems.filter(item => {
      if (item.href === currentPath) return false;
      
      // Match by category or tags
      return pageContext.tags?.some(tag => 
        item.description?.toLowerCase().includes(tag.toLowerCase()) ||
        item.label.toLowerCase().includes(tag.toLowerCase())
      );
    });
    
    relatedItems.slice(0, 3).forEach(item => {
      suggestions.push({
        id: `related_${item.id}`,
        item,
        reason: `Related to ${pageContext.category}`,
        priority: 3,
        category: 'related',
      });
    });
  }
  
  // Frequently accessed items
  const frequentItems = [...recentItems]
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, 3)
    .filter(recentItem => recentItem.href !== currentPath);
  
  frequentItems.forEach(recentItem => {
    suggestions.push({
      id: `frequent_${recentItem.id}`,
      item: recentItem.item,
      reason: `Accessed ${recentItem.accessCount} times`,
      priority: 2,
      category: 'frequent',
    });
  });
  
  // Workflow suggestions based on common navigation patterns
  const workflowSuggestions = getWorkflowSuggestions(currentPath, allItems);
  workflowSuggestions.forEach(suggestion => {
    suggestions.push({
      ...suggestion,
      category: 'workflow',
    });
  });
  
  // Sort by priority and remove duplicates
  return suggestions
    .filter((suggestion, index, self) => 
      self.findIndex(s => s.item.id === suggestion.item.id) === index
    )
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8); // Limit to 8 suggestions
}

/**
 * Get workflow-based suggestions
 */
function getWorkflowSuggestions(currentPath: string, allItems: NavigationItem[]): ContextualSuggestion[] {
  const workflows: Record<string, { next: string[]; reason: string; priority: number }> = {
    '/': {
      next: ['/invoices', '/payments', '/sync'],
      reason: 'Common next steps from dashboard',
      priority: 1,
    },
    '/invoices': {
      next: ['/payments', '/sync/hubspot', '/transfers'],
      reason: 'Related to invoice management',
      priority: 2,
    },
    '/payments': {
      next: ['/invoices', '/sync/stripe', '/transfers'],
      reason: 'Related to payment processing',
      priority: 2,
    },
    '/sync': {
      next: ['/invoices', '/payments', '/webhooks'],
      reason: 'Common sync-related tasks',
      priority: 1,
    },
    '/settings': {
      next: ['/admin/users', '/admin/api-keys', '/health'],
      reason: 'Configuration workflow',
      priority: 1,
    },
  };
  
  const workflow = workflows[currentPath];
  if (!workflow) return [];
  
  return workflow.next
    .map(nextPath => allItems.find(item => item.href === nextPath))
    .filter((item): item is NavigationItem => item !== undefined)
    .map(item => ({
      id: `workflow_${item.id}`,
      item,
      reason: workflow.reason,
      priority: workflow.priority,
      category: 'workflow' as const,
    }));
}

/**
 * Smart navigation behaviors hook
 */
export function useSmartNavigation({
  sections,
  mode,
  enableBreadcrumbs = true,
  enableRecentItems = true,
  maxRecentItems = 10,
  enableContextualSuggestions = true,
  autoHideConfig = DEFAULT_AUTO_HIDE_CONFIG,
  enableScrollBehaviors = true,
  pageContextMap = {},
  recentItemsStorageKey = RECENT_ITEMS_KEY,
}: UseSmartNavigationOptions): UseSmartNavigationReturn {
  
  const router = useRouter();
  const pathname = usePathname();
  
  // State management
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isAutoHidden, setIsAutoHidden] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [forceVisible, setForceVisible] = useState(false);
  
  // Refs for scroll handling
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Load recent items on mount
  useEffect(() => {
    if (enableRecentItems) {
      const items = loadRecentItems(recentItemsStorageKey);
      setRecentItems(items);
    }
  }, [enableRecentItems, recentItemsStorageKey]);
  
  // Update page context when pathname changes
  useEffect(() => {
    if (!pathname) return;
    
    const context = pageContextMap[pathname];
    setPageContext(context || {
      path: pathname,
      title: pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Page',
    });
  }, [pathname, pageContextMap]);
  
  // Generate breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!enableBreadcrumbs || !pathname) return [];
    return generateBreadcrumbs(pathname, sections, pageContextMap);
  }, [enableBreadcrumbs, pathname, sections, pageContextMap]);
  
  // Generate contextual suggestions
  const contextualSuggestions = useMemo(() => {
    if (!enableContextualSuggestions || !pathname) return [];
    return generateContextualSuggestions(pathname, sections, recentItems, pageContext);
  }, [enableContextualSuggestions, pathname, sections, recentItems, pageContext]);
  
  // Track navigation
  const trackNavigation = useCallback((item: NavigationItem) => {
    if (!enableRecentItems || !item.href) return;
    
    setRecentItems(prev => {
      // Find existing item
      const existingIndex = prev.findIndex(recent => recent.item.id === item.id);
      
      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          lastAccessed: Date.now(),
          accessCount: updated[existingIndex].accessCount + 1,
        };
        
        // Move to front
        const [updatedItem] = updated.splice(existingIndex, 1);
        updated.unshift(updatedItem);
        
        return updated;
      } else {
        // Add new item
        const newItem: RecentItem = {
          id: item.id,
          item,
          lastAccessed: Date.now(),
          accessCount: 1,
          href: item.href,
        };
        
        return [newItem, ...prev].slice(0, maxRecentItems);
      }
    });
  }, [enableRecentItems, maxRecentItems]);
  
  // Save recent items when they change
  useEffect(() => {
    if (enableRecentItems) {
      saveRecentItems(recentItems, recentItemsStorageKey);
    }
  }, [recentItems, enableRecentItems, recentItemsStorageKey]);
  
  // Clear recent items
  const clearRecentItems = useCallback(() => {
    setRecentItems([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(recentItemsStorageKey);
    }
  }, [recentItemsStorageKey]);
  
  // Get related items
  const getRelatedItems = useCallback((currentItem: NavigationItem): NavigationItem[] => {
    const allItems: NavigationItem[] = [];
    sections.forEach(section => {
      const addItems = (items: NavigationItem[]) => {
        items.forEach(item => {
          if (item.href && item.visible !== false && !item.disabled && item.id !== currentItem.id) {
            allItems.push(item);
          }
          if (item.children) {
            addItems(item.children);
          }
        });
      };
      addItems(section.items);
    });
    
    // Simple related items based on label similarity and description
    return allItems.filter(item => {
      const currentLabel = currentItem.label.toLowerCase();
      const currentDesc = currentItem.description?.toLowerCase() || '';
      const itemLabel = item.label.toLowerCase();
      const itemDesc = item.description?.toLowerCase() || '';
      
      // Check for common words
      const currentWords = [...currentLabel.split(' '), ...currentDesc.split(' ')];
      const itemWords = [...itemLabel.split(' '), ...itemDesc.split(' ')];
      
      return currentWords.some(word => word.length > 3 && itemWords.includes(word));
    }).slice(0, 5);
  }, [sections]);
  
  // Auto-hide scroll handler
  const handleScroll = useCallback((event: Event) => {
    if (!enableScrollBehaviors || !autoHideConfig.enabled || mode !== 'drawer') return;
    
    const currentScrollY = window.pageYOffset;
    const isScrollingDown = currentScrollY > lastScrollY.current;
    const hasScrolledEnough = Math.abs(currentScrollY - lastScrollY.current) > autoHideConfig.threshold;
    
    if (hasScrolledEnough && !forceVisible) {
      if (isScrollingDown && currentScrollY > autoHideConfig.threshold) {
        // Scrolling down, hide navigation
        setIsAutoHidden(true);
        
        if (hideTimeout.current) {
          clearTimeout(hideTimeout.current);
        }
      } else if (!isScrollingDown) {
        // Scrolling up, show navigation
        setIsAutoHidden(false);
        
        if (hideTimeout.current) {
          clearTimeout(hideTimeout.current);
        }
      }
    }
    
    lastScrollY.current = currentScrollY;
    
    // Clear timeout for continuous scrolling
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    // Set timeout to show navigation after scrolling stops
    scrollTimeout.current = setTimeout(() => {
      if (!forceVisible) {
        setIsAutoHidden(false);
      }
    }, autoHideConfig.delay);
  }, [enableScrollBehaviors, autoHideConfig, mode, forceVisible]);
  
  // Mouse move handler
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!autoHideConfig.showOnMouseMove || !isAutoHidden) return;
    
    // Show navigation when mouse moves near the edge
    if (event.clientX <= 50) {
      setIsAutoHidden(false);
    }
  }, [autoHideConfig.showOnMouseMove, isAutoHidden]);
  
  // Mouse enter/leave handlers
  const handleMouseEnter = useCallback(() => {
    if (autoHideConfig.showOnHover) {
      setIsAutoHidden(false);
    }
  }, [autoHideConfig.showOnHover]);
  
  const handleMouseLeave = useCallback(() => {
    if (autoHideConfig.showOnHover && !forceVisible) {
      hideTimeout.current = setTimeout(() => {
        setIsAutoHidden(true);
      }, autoHideConfig.delay);
    }
  }, [autoHideConfig.showOnHover, autoHideConfig.delay, forceVisible]);
  
  // Force show/hide navigation
  const setNavigationVisible = useCallback((visible: boolean) => {
    setForceVisible(visible);
    setIsAutoHidden(!visible);
    
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
    }
  }, []);
  
  const isNavigationVisible = useCallback(() => {
    return !isAutoHidden || forceVisible;
  }, [isAutoHidden, forceVisible]);
  
  // UI helper functions
  const getBreadcrumbProps = useCallback(() => ({
    items: breadcrumbs,
    separator: '/',
    maxItems: 5,
  }), [breadcrumbs]);
  
  const getRecentItemsProps = useCallback(() => ({
    items: recentItems,
    onItemClick: (item: RecentItem) => {
      trackNavigation(item.item);
      if (item.href) {
        router.push(item.href);
      }
    },
    emptyMessage: 'No recent items',
  }), [recentItems, trackNavigation, router]);
  
  const getContextualSuggestionsProps = useCallback(() => {
    const groupedByCategory = contextualSuggestions.reduce((groups, suggestion) => {
      if (!groups[suggestion.category]) {
        groups[suggestion.category] = [];
      }
      groups[suggestion.category].push(suggestion);
      return groups;
    }, {} as Record<string, ContextualSuggestion[]>);
    
    return {
      suggestions: contextualSuggestions,
      onSuggestionClick: (suggestion: ContextualSuggestion) => {
        trackNavigation(suggestion.item);
        if (suggestion.item.href) {
          router.push(suggestion.item.href);
        }
      },
      groupedByCategory,
    };
  }, [contextualSuggestions, trackNavigation, router]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
    };
  }, []);
  
  return {
    breadcrumbs,
    recentItems,
    contextualSuggestions,
    isAutoHidden,
    pageContext,
    trackNavigation,
    clearRecentItems,
    getRelatedItems,
    setNavigationVisible,
    isNavigationVisible,
    handleScroll,
    handleMouseMove,
    handleMouseEnter,
    handleMouseLeave,
    getBreadcrumbProps,
    getRecentItemsProps,
    getContextualSuggestionsProps,
  };
}

export default useSmartNavigation;