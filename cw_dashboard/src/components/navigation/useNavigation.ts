/**
 * Navigation State Management Hook
 * Manages navigation mode, state, and interactions
 */

'use client';

import { useReducer, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { 
  NavigationState, 
  NavigationAction, 
  NavigationMode,
  NavigationConfig,
  NavigationItem,
  NavigationContextValue 
} from './types';
import { hasNavigationPermission, findNavigationItem } from './navigationConfig';

// Initial navigation state
const initialState: NavigationState = {
  mode: 'drawer', // Will be updated based on viewport
  isOpen: false,
  isExpanded: true,
  activeItemId: null,
  expandedSections: new Set<string>(),
  hoveredItemId: null,
  focusedItemId: null,
};

// Navigation state reducer
function navigationReducer(
  state: NavigationState,
  action: NavigationAction
): NavigationState {
  switch (action.type) {
    case 'SET_MODE':
      return { 
        ...state, 
        mode: action.mode,
        // Reset open state when changing modes
        isOpen: action.mode === 'modal' ? state.isOpen : false,
      };
      
    case 'TOGGLE_OPEN':
      return { ...state, isOpen: !state.isOpen };
      
    case 'SET_OPEN':
      return { ...state, isOpen: action.isOpen };
      
    case 'TOGGLE_EXPANDED':
      return { ...state, isExpanded: !state.isExpanded };
      
    case 'SET_EXPANDED':
      return { ...state, isExpanded: action.isExpanded };
      
    case 'SET_ACTIVE_ITEM':
      return { ...state, activeItemId: action.itemId };
      
    case 'SET_HOVERED_ITEM':
      return { ...state, hoveredItemId: action.itemId };
      
    case 'SET_FOCUSED_ITEM':
      return { ...state, focusedItemId: action.itemId };
      
    case 'TOGGLE_SECTION': {
      const newExpandedSections = new Set(state.expandedSections);
      if (newExpandedSections.has(action.sectionId)) {
        newExpandedSections.delete(action.sectionId);
      } else {
        newExpandedSections.add(action.sectionId);
      }
      return { ...state, expandedSections: newExpandedSections };
    }
    
    case 'SET_SECTION_EXPANDED': {
      const newExpandedSections = new Set(state.expandedSections);
      if (action.expanded) {
        newExpandedSections.add(action.sectionId);
      } else {
        newExpandedSections.delete(action.sectionId);
      }
      return { ...state, expandedSections: newExpandedSections };
    }
    
    default:
      return state;
  }
}

// Custom hook for navigation state management
export function useNavigation(config: NavigationConfig) {
  const pathname = usePathname();
  const { user } = useUserfrontAuth();
  
  // Media queries for responsive behavior
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isMedium = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isLarge = useMediaQuery('(min-width: 1024px)');
  
  // Initialize state with reducer
  const [state, dispatch] = useReducer(navigationReducer, initialState);
  
  // Update navigation mode based on viewport size
  useEffect(() => {
    let newMode: NavigationMode = 'drawer';
    
    if (isMobile) {
      newMode = 'modal';
    } else if (isMedium) {
      newMode = state.isExpanded ? 'drawer' : 'rail';
    } else if (isLarge) {
      newMode = state.isExpanded ? 'drawer' : 'rail';
    }
    
    if (newMode !== state.mode) {
      dispatch({ type: 'SET_MODE', mode: newMode });
    }
  }, [isMobile, isMedium, isLarge, state.isExpanded, state.mode]);
  
  // Update active item based on current pathname
  useEffect(() => {
    const activeItem = findActiveItemByPath(config, pathname);
    if (activeItem) {
      dispatch({ type: 'SET_ACTIVE_ITEM', itemId: activeItem.id });
    }
  }, [pathname, config]);
  
  // Initialize expanded sections from config
  useEffect(() => {
    const defaultExpanded = new Set<string>();
    config.sections.forEach(section => {
      if (section.collapsible && !section.defaultCollapsed) {
        defaultExpanded.add(section.id);
      }
    });
    
    // Only set if there are sections to expand
    if (defaultExpanded.size > 0) {
      defaultExpanded.forEach(sectionId => {
        dispatch({ type: 'SET_SECTION_EXPANDED', sectionId, expanded: true });
      });
    }
  }, [config]);
  
  // Close modal when clicking outside or pressing Escape
  useEffect(() => {
    if (state.mode !== 'modal' || !state.isOpen) return;
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dispatch({ type: 'SET_OPEN', isOpen: false });
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [state.mode, state.isOpen]);
  
  // Computed values
  const currentMode = state.mode;
  const isCollapsed = state.mode === 'rail';
  
  // Action handlers
  const toggleNavigation = useCallback(() => {
    if (state.mode === 'modal') {
      dispatch({ type: 'TOGGLE_OPEN' });
    } else {
      dispatch({ type: 'TOGGLE_EXPANDED' });
    }
  }, [state.mode]);
  
  const openNavigation = useCallback(() => {
    if (state.mode === 'modal') {
      dispatch({ type: 'SET_OPEN', isOpen: true });
    } else {
      dispatch({ type: 'SET_EXPANDED', isExpanded: true });
    }
  }, [state.mode]);
  
  const closeNavigation = useCallback(() => {
    if (state.mode === 'modal') {
      dispatch({ type: 'SET_OPEN', isOpen: false });
    } else {
      dispatch({ type: 'SET_EXPANDED', isExpanded: false });
    }
  }, [state.mode]);
  
  const expandNavigation = useCallback(() => {
    dispatch({ type: 'SET_EXPANDED', isExpanded: true });
  }, []);
  
  const collapseNavigation = useCallback(() => {
    dispatch({ type: 'SET_EXPANDED', isExpanded: false });
  }, []);
  
  const setActiveItem = useCallback((itemId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_ITEM', itemId });
  }, []);
  
  const toggleSection = useCallback((sectionId: string) => {
    dispatch({ type: 'TOGGLE_SECTION', sectionId });
  }, []);
  
  // Utility functions
  const isItemActive = useCallback((item: NavigationItem): boolean => {
    if (state.activeItemId === item.id) return true;
    
    // Check if current path matches item href
    if (item.href && pathname === item.href) return true;
    
    // Check if any child is active
    if (item.children) {
      return item.children.some(child => isItemActive(child));
    }
    
    return false;
  }, [state.activeItemId, pathname]);
  
  const isItemVisible = useCallback((item: NavigationItem, currentUser: any): boolean => {
    // Check item visibility function
    if (typeof item.visible === 'function') {
      if (!item.visible(currentUser)) return false;
    } else if (item.visible === false) {
      return false;
    }
    
    // Check permissions
    if (item.requiredPermissions && item.requiredPermissions.length > 0) {
      return hasNavigationPermission(item.requiredPermissions, currentUser);
    }
    
    return true;
  }, []);
  
  const hasPermission = useCallback((
    requiredPermissions?: string[],
    currentUser?: any
  ): boolean => {
    return hasNavigationPermission(requiredPermissions, currentUser || user);
  }, [user]);
  
  const getItemPath = useCallback((item: NavigationItem): string | undefined => {
    return item.href;
  }, []);
  
  // Create context value
  const contextValue: NavigationContextValue = useMemo(() => ({
    state,
    dispatch,
    config,
    currentMode,
    isCollapsed,
    isMobile,
    toggleNavigation,
    openNavigation,
    closeNavigation,
    expandNavigation,
    collapseNavigation,
    setActiveItem,
    toggleSection,
    isItemActive,
    isItemVisible,
    hasPermission,
    getItemPath,
  }), [
    state,
    config,
    currentMode,
    isCollapsed,
    isMobile,
    toggleNavigation,
    openNavigation,
    closeNavigation,
    expandNavigation,
    collapseNavigation,
    setActiveItem,
    toggleSection,
    isItemActive,
    isItemVisible,
    hasPermission,
    getItemPath,
  ]);
  
  return contextValue;
}

// Helper function to find active item by path
function findActiveItemByPath(
  config: NavigationConfig,
  pathname: string
): NavigationItem | undefined {
  for (const section of config.sections) {
    for (const item of section.items) {
      if (item.href === pathname) return item;
      
      if (item.children) {
        const child = item.children.find(c => c.href === pathname);
        if (child) return child;
      }
    }
  }
  
  // Check footer section
  if (config.footer) {
    for (const item of config.footer.items) {
      if (item.href === pathname) return item;
    }
  }
  
  return undefined;
}

// Export for external use
export default useNavigation;