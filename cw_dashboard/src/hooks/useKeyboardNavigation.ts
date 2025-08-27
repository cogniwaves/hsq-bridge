/**
 * Enhanced Keyboard Navigation Hook
 * Advanced keyboard navigation with global shortcuts, type-ahead search,
 * focus management, and accessibility improvements
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { NavigationItem, NavigationSection } from '../components/navigation/types';

// Keyboard shortcut configuration
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: boolean;
}

// Navigation state for keyboard
export interface KeyboardNavigationState {
  focusedItemId: string | null;
  searchQuery: string;
  isSearching: boolean;
  searchResults: NavigationItem[];
  searchIndex: number;
  lastFocusTime: number;
}

// Hook options
export interface UseKeyboardNavigationOptions {
  /** Navigation sections to search through */
  sections: NavigationSection[];
  /** Enable global keyboard shortcuts */
  enableShortcuts?: boolean;
  /** Enable type-ahead search */
  enableTypeAhead?: boolean;
  /** Type-ahead timeout in milliseconds */
  typeAheadTimeout?: number;
  /** Custom keyboard shortcuts */
  customShortcuts?: KeyboardShortcut[];
  /** Skip navigation callback */
  onSkipNavigation?: () => void;
  /** Navigation toggle callback */
  onToggleNavigation?: () => void;
  /** Profile menu callback */
  onOpenProfile?: () => void;
  /** Search callback */
  onSearch?: (query: string) => void;
  /** Item activation callback */
  onItemActivate?: (item: NavigationItem) => void;
  /** Focus change callback */
  onFocusChange?: (itemId: string | null) => void;
  /** Accessibility announcer */
  announcer?: (message: string) => void;
}

// Hook return interface
export interface UseKeyboardNavigationReturn {
  /** Current keyboard navigation state */
  state: KeyboardNavigationState;
  /** Focus specific item */
  focusItem: (itemId: string) => void;
  /** Move focus to next item */
  focusNext: () => void;
  /** Move focus to previous item */
  focusPrevious: () => void;
  /** Focus first item */
  focusFirst: () => void;
  /** Focus last item */
  focusLast: () => void;
  /** Activate currently focused item */
  activateFocusedItem: () => void;
  /** Clear search */
  clearSearch: () => void;
  /** Get focusable items in order */
  getFocusableItems: () => NavigationItem[];
  /** Check if item is focusable */
  isItemFocusable: (item: NavigationItem) => boolean;
  /** Register keyboard shortcuts */
  registerShortcuts: (shortcuts: KeyboardShortcut[]) => void;
  /** Unregister keyboard shortcuts */
  unregisterShortcuts: (keys: string[]) => void;
  /** Get keyboard shortcut help */
  getShortcutHelp: () => string[];
}

// Default keyboard shortcuts
const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'Alt+M',
    altKey: true,
    description: 'Toggle navigation menu',
    action: () => {}, // Will be replaced by hook
    preventDefault: true,
  },
  {
    key: 'Alt+P',
    altKey: true,
    description: 'Open profile menu',
    action: () => {}, // Will be replaced by hook
    preventDefault: true,
  },
  {
    key: 'Ctrl+K',
    ctrlKey: true,
    description: 'Search navigation',
    action: () => {}, // Will be replaced by hook
    preventDefault: true,
  },
  {
    key: '/',
    description: 'Quick search (focus and type)',
    action: () => {}, // Will be replaced by hook
    preventDefault: true,
  },
  {
    key: 'Escape',
    description: 'Clear search or close menus',
    action: () => {}, // Will be replaced by hook
    preventDefault: true,
  },
];

/**
 * Get all focusable items from navigation sections
 */
function getFocusableItemsFromSections(
  sections: NavigationSection[],
  expandedSections: Set<string> = new Set()
): NavigationItem[] {
  const items: NavigationItem[] = [];
  
  function addItemsRecursively(
    sectionItems: NavigationItem[],
    isInExpandedSection = true
  ) {
    sectionItems.forEach(item => {
      if (item.visible !== false && !item.disabled) {
        items.push(item);
        
        // Add children if parent is expanded or section is expanded
        if (item.children && (isInExpandedSection || expandedSections.has(item.id))) {
          addItemsRecursively(item.children, true);
        }
      }
    });
  }
  
  sections.forEach(section => {
    if (section.visible !== false) {
      const isSectionExpanded = !section.collapsible || expandedSections.has(section.id);
      if (isSectionExpanded) {
        addItemsRecursively(section.items, true);
      }
    }
  });
  
  return items;
}

/**
 * Search navigation items
 */
function searchNavigationItems(
  items: NavigationItem[],
  query: string
): NavigationItem[] {
  if (!query.trim()) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  
  return items.filter(item => {
    const labelMatch = item.label.toLowerCase().includes(normalizedQuery);
    const descriptionMatch = item.description?.toLowerCase().includes(normalizedQuery);
    
    return labelMatch || descriptionMatch;
  }).sort((a, b) => {
    // Prioritize label matches over description matches
    const aLabelMatch = a.label.toLowerCase().startsWith(normalizedQuery);
    const bLabelMatch = b.label.toLowerCase().startsWith(normalizedQuery);
    
    if (aLabelMatch && !bLabelMatch) return -1;
    if (!aLabelMatch && bLabelMatch) return 1;
    
    return a.label.localeCompare(b.label);
  });
}

/**
 * Parse keyboard shortcut string
 */
function parseShortcutString(shortcut: string): {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
} {
  const parts = shortcut.split('+').map(part => part.trim());
  const key = parts[parts.length - 1];
  
  return {
    key,
    ctrlKey: parts.includes('Ctrl'),
    altKey: parts.includes('Alt'),
    shiftKey: parts.includes('Shift'),
    metaKey: parts.includes('Meta') || parts.includes('Cmd'),
  };
}

/**
 * Check if keyboard event matches shortcut
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const eventKey = event.key;
  const shortcutKey = shortcut.key.includes('+') ? parseShortcutString(shortcut.key) : { key: shortcut.key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
  
  return (
    event.key === shortcutKey.key &&
    !!event.ctrlKey === !!shortcutKey.ctrlKey &&
    !!event.altKey === !!shortcutKey.altKey &&
    !!event.shiftKey === !!shortcutKey.shiftKey &&
    !!event.metaKey === !!shortcutKey.metaKey
  );
}

/**
 * Announce message to screen readers
 */
function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    if (document.body.contains(announcement)) {
      document.body.removeChild(announcement);
    }
  }, 1000);
}

/**
 * Enhanced keyboard navigation hook
 */
export function useKeyboardNavigation({
  sections,
  enableShortcuts = true,
  enableTypeAhead = true,
  typeAheadTimeout = 1000,
  customShortcuts = [],
  onSkipNavigation,
  onToggleNavigation,
  onOpenProfile,
  onSearch,
  onItemActivate,
  onFocusChange,
  announcer = announceToScreenReader,
}: UseKeyboardNavigationOptions): UseKeyboardNavigationReturn {
  
  // State management
  const [state, setState] = useState<KeyboardNavigationState>({
    focusedItemId: null,
    searchQuery: '',
    isSearching: false,
    searchResults: [],
    searchIndex: -1,
    lastFocusTime: 0,
  });

  const shortcutsRef = useRef<Map<string, KeyboardShortcut>>(new Map());
  const typeAheadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const expandedSectionsRef = useRef<Set<string>>(new Set());

  // Get focusable items
  const focusableItems = useMemo(() => 
    getFocusableItemsFromSections(sections, expandedSectionsRef.current),
    [sections]
  );

  // Search functionality
  const performSearch = useCallback((query: string) => {
    if (!enableTypeAhead) return;
    
    const results = searchNavigationItems(focusableItems, query);
    
    setState(prev => ({
      ...prev,
      searchQuery: query,
      isSearching: query.length > 0,
      searchResults: results,
      searchIndex: results.length > 0 ? 0 : -1,
    }));

    if (results.length > 0) {
      announcer(`Found ${results.length} results for "${query}"`);
    } else if (query.length > 0) {
      announcer(`No results found for "${query}"`);
    }

    onSearch?.(query);
  }, [focusableItems, enableTypeAhead, announcer, onSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      searchQuery: '',
      isSearching: false,
      searchResults: [],
      searchIndex: -1,
    }));
    
    if (typeAheadTimeoutRef.current) {
      clearTimeout(typeAheadTimeoutRef.current);
      typeAheadTimeoutRef.current = null;
    }
  }, []);

  // Focus management
  const focusItem = useCallback((itemId: string) => {
    const item = focusableItems.find(item => item.id === itemId);
    if (!item) return;

    setState(prev => ({
      ...prev,
      focusedItemId: itemId,
      lastFocusTime: Date.now(),
    }));

    onFocusChange?.(itemId);
    announcer(`Focused: ${item.label}${item.description ? `, ${item.description}` : ''}`);
  }, [focusableItems, onFocusChange, announcer]);

  const focusNext = useCallback(() => {
    const currentItems = state.isSearching ? state.searchResults : focusableItems;
    const currentIndex = state.focusedItemId 
      ? currentItems.findIndex(item => item.id === state.focusedItemId)
      : -1;
    
    const nextIndex = currentIndex < currentItems.length - 1 ? currentIndex + 1 : 0;
    const nextItem = currentItems[nextIndex];
    
    if (nextItem) {
      focusItem(nextItem.id);
    }
  }, [state.isSearching, state.searchResults, state.focusedItemId, focusableItems, focusItem]);

  const focusPrevious = useCallback(() => {
    const currentItems = state.isSearching ? state.searchResults : focusableItems;
    const currentIndex = state.focusedItemId 
      ? currentItems.findIndex(item => item.id === state.focusedItemId)
      : -1;
    
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : currentItems.length - 1;
    const prevItem = currentItems[prevIndex];
    
    if (prevItem) {
      focusItem(prevItem.id);
    }
  }, [state.isSearching, state.searchResults, state.focusedItemId, focusableItems, focusItem]);

  const focusFirst = useCallback(() => {
    const currentItems = state.isSearching ? state.searchResults : focusableItems;
    const firstItem = currentItems[0];
    
    if (firstItem) {
      focusItem(firstItem.id);
    }
  }, [state.isSearching, state.searchResults, focusableItems, focusItem]);

  const focusLast = useCallback(() => {
    const currentItems = state.isSearching ? state.searchResults : focusableItems;
    const lastItem = currentItems[currentItems.length - 1];
    
    if (lastItem) {
      focusItem(lastItem.id);
    }
  }, [state.isSearching, state.searchResults, focusableItems, focusItem]);

  const activateFocusedItem = useCallback(() => {
    if (!state.focusedItemId) return;
    
    const item = focusableItems.find(item => item.id === state.focusedItemId);
    if (item) {
      onItemActivate?.(item);
      announcer(`Activated: ${item.label}`);
    }
  }, [state.focusedItemId, focusableItems, onItemActivate, announcer]);

  // Keyboard shortcuts management
  const registerShortcuts = useCallback((shortcuts: KeyboardShortcut[]) => {
    shortcuts.forEach(shortcut => {
      shortcutsRef.current.set(shortcut.key, shortcut);
    });
  }, []);

  const unregisterShortcuts = useCallback((keys: string[]) => {
    keys.forEach(key => {
      shortcutsRef.current.delete(key);
    });
  }, []);

  const getShortcutHelp = useCallback((): string[] => {
    return Array.from(shortcutsRef.current.values())
      .filter(shortcut => shortcut.enabled !== false)
      .map(shortcut => `${shortcut.key}: ${shortcut.description}`);
  }, []);

  // Initialize default shortcuts
  useEffect(() => {
    const shortcuts = [
      ...DEFAULT_SHORTCUTS.map(shortcut => ({
        ...shortcut,
        action: () => {
          switch (shortcut.key) {
            case 'Alt+M':
              onToggleNavigation?.();
              break;
            case 'Alt+P':
              onOpenProfile?.();
              break;
            case 'Ctrl+K':
            case '/':
              // Focus search or start type-ahead
              setState(prev => ({ ...prev, isSearching: true }));
              break;
            case 'Escape':
              if (state.isSearching) {
                clearSearch();
              }
              break;
          }
        },
      })),
      ...customShortcuts,
    ];

    registerShortcuts(shortcuts);
  }, [customShortcuts, onToggleNavigation, onOpenProfile, state.isSearching, clearSearch, registerShortcuts]);

  // Keyboard event handler
  useEffect(() => {
    if (!enableShortcuts && !enableTypeAhead) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with form inputs
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          (event.target as HTMLElement).contentEditable === 'true') {
        return;
      }

      // Handle keyboard shortcuts
      if (enableShortcuts) {
        for (const shortcut of shortcutsRef.current.values()) {
          if (shortcut.enabled !== false && matchesShortcut(event, shortcut)) {
            if (shortcut.preventDefault) event.preventDefault();
            if (shortcut.stopPropagation) event.stopPropagation();
            shortcut.action();
            return;
          }
        }
      }

      // Handle navigation keys
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusNext();
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusPrevious();
          break;
        case 'Home':
          event.preventDefault();
          focusFirst();
          break;
        case 'End':
          event.preventDefault();
          focusLast();
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          activateFocusedItem();
          break;
        case 'Escape':
          if (state.isSearching) {
            event.preventDefault();
            clearSearch();
          }
          break;
        default:
          // Type-ahead search
          if (enableTypeAhead && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            event.preventDefault();
            
            const newQuery = state.searchQuery + event.key;
            performSearch(newQuery);
            
            // Reset timeout
            if (typeAheadTimeoutRef.current) {
              clearTimeout(typeAheadTimeoutRef.current);
            }
            
            typeAheadTimeoutRef.current = setTimeout(() => {
              clearSearch();
            }, typeAheadTimeout);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    enableShortcuts,
    enableTypeAhead,
    state.searchQuery,
    state.isSearching,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    activateFocusedItem,
    clearSearch,
    performSearch,
    typeAheadTimeout,
  ]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
      }
    };
  }, []);

  // Utility functions
  const isItemFocusable = useCallback((item: NavigationItem): boolean => {
    return !item.disabled && item.visible !== false;
  }, []);

  const getFocusableItems = useCallback((): NavigationItem[] => {
    return focusableItems;
  }, [focusableItems]);

  return {
    state,
    focusItem,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    activateFocusedItem,
    clearSearch,
    getFocusableItems,
    isItemFocusable,
    registerShortcuts,
    unregisterShortcuts,
    getShortcutHelp,
  };
}

export default useKeyboardNavigation;