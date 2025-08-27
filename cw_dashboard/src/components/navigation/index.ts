/**
 * Navigation Components Export
 * Central export point for all navigation components and utilities
 */

// Main navigation component
export { SideNavigation as default, SideNavigation } from './SideNavigation';

// Individual navigation components
export { NavigationRail } from './NavigationRail';
export { NavigationDrawer } from './NavigationDrawer';
export { NavigationModal } from './NavigationModal';
export { NavigationItem } from './NavigationItem';
export { NavigationProfile } from './NavigationProfile';

// Navigation hooks and utilities
export { useNavigation } from './useNavigation';
export { useNavigationContext } from './SideNavigation';

// Navigation configuration
export {
  navigationConfig,
  updateNavigationBadges,
  findNavigationItem,
  getVisibleSections,
  hasNavigationPermission,
} from './navigationConfig';

// Type exports
export type {
  // Navigation modes and states
  NavigationMode,
  NavigationItemState,
  
  // Core types
  NavigationItem,
  NavigationBadge,
  NavigationSection,
  NavigationConfig,
  NavigationState,
  NavigationAction,
  NavigationContextValue,
  
  // Component props
  SideNavigationProps,
  NavigationRailProps,
  NavigationDrawerProps,
  NavigationModalProps,
  NavigationItemProps,
  NavigationProfileProps,
  
  // Utility types
  NavigationPermission,
  NavigationVisibilityFunction,
  NavigationItemClickHandler,
  NavigationTransition,
  NavigationA11y,
  NavigationThemeConfig,
} from './types';