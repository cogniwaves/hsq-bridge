/**
 * Navigation System Type Definitions
 * Comprehensive TypeScript interfaces for navigation components
 */

import { ReactNode } from 'react';

// Navigation mode states
export type NavigationMode = 'rail' | 'drawer' | 'modal';
export type NavigationItemState = 'default' | 'hover' | 'active' | 'focused' | 'disabled';

// Navigation item structure
export interface NavigationItem {
  id: string;
  label: string;
  icon: ReactNode | string; // Can be a Heroicon component or icon name
  href?: string;
  onClick?: () => void;
  badge?: NavigationBadge;
  disabled?: boolean;
  visible?: boolean | ((user: any) => boolean); // Can be conditionally visible
  requiredPermissions?: string[]; // Required permissions to see this item
  children?: NavigationItem[]; // For nested navigation
  external?: boolean; // Opens in new tab
  description?: string; // For tooltips or screen readers
}

// Navigation badge/notification
export interface NavigationBadge {
  count?: number;
  text?: string;
  color?: 'primary' | 'error' | 'warning' | 'success' | 'info';
  pulse?: boolean; // Animated pulse effect
}

// Navigation section structure
export interface NavigationSection {
  id: string;
  title?: string; // Section header text
  items: NavigationItem[];
  divider?: boolean; // Show divider after section
  collapsible?: boolean; // Can be collapsed/expanded
  defaultCollapsed?: boolean;
  visible?: boolean | ((user: any) => boolean);
  requiredPermissions?: string[];
}

// Navigation configuration
export interface NavigationConfig {
  sections: NavigationSection[];
  footer?: NavigationSection; // Footer section (user profile, settings)
  branding?: {
    logo?: ReactNode | string;
    title?: string;
    subtitle?: string;
    href?: string;
  };
}

// Navigation state management
export interface NavigationState {
  mode: NavigationMode;
  isOpen: boolean; // For modal state
  isExpanded: boolean; // For rail/drawer toggle
  activeItemId: string | null;
  expandedSections: Set<string>; // Tracks expanded collapsible sections
  hoveredItemId: string | null;
  focusedItemId: string | null;
}

// Navigation actions for state management
export type NavigationAction =
  | { type: 'SET_MODE'; mode: NavigationMode }
  | { type: 'TOGGLE_OPEN' }
  | { type: 'SET_OPEN'; isOpen: boolean }
  | { type: 'TOGGLE_EXPANDED' }
  | { type: 'SET_EXPANDED'; isExpanded: boolean }
  | { type: 'SET_ACTIVE_ITEM'; itemId: string | null }
  | { type: 'SET_HOVERED_ITEM'; itemId: string | null }
  | { type: 'SET_FOCUSED_ITEM'; itemId: string | null }
  | { type: 'TOGGLE_SECTION'; sectionId: string }
  | { type: 'SET_SECTION_EXPANDED'; sectionId: string; expanded: boolean };

// Navigation context value
export interface NavigationContextValue {
  state: NavigationState;
  dispatch: (action: NavigationAction) => void;
  config: NavigationConfig;
  
  // Computed values
  currentMode: NavigationMode;
  isCollapsed: boolean;
  isMobile: boolean;
  
  // Actions
  toggleNavigation: () => void;
  openNavigation: () => void;
  closeNavigation: () => void;
  expandNavigation: () => void;
  collapseNavigation: () => void;
  setActiveItem: (itemId: string | null) => void;
  toggleSection: (sectionId: string) => void;
  
  // Navigation utilities
  isItemActive: (item: NavigationItem) => boolean;
  isItemVisible: (item: NavigationItem, user: any) => boolean;
  hasPermission: (requiredPermissions?: string[], user?: any) => boolean;
  getItemPath: (item: NavigationItem) => string | undefined;
}

// Component props interfaces
export interface SideNavigationProps {
  className?: string;
  children?: ReactNode;
  config?: NavigationConfig;
  defaultMode?: NavigationMode;
  defaultExpanded?: boolean;
  onModeChange?: (mode: NavigationMode) => void;
  onExpandedChange?: (expanded: boolean) => void;
  onItemClick?: (item: NavigationItem) => void;
  sticky?: boolean;
  a11yLabel?: string;
}

export interface NavigationRailProps {
  className?: string;
  config: NavigationConfig;
  activeItemId?: string | null;
  onItemClick?: (item: NavigationItem) => void;
  onExpandClick?: () => void;
  showExpandButton?: boolean;
  a11yLabel?: string;
}

export interface NavigationDrawerProps {
  className?: string;
  config: NavigationConfig;
  activeItemId?: string | null;
  onItemClick?: (item: NavigationItem) => void;
  onCollapseClick?: () => void;
  showCollapseButton?: boolean;
  a11yLabel?: string;
}

export interface NavigationModalProps {
  className?: string;
  config: NavigationConfig;
  isOpen: boolean;
  onClose: () => void;
  activeItemId?: string | null;
  onItemClick?: (item: NavigationItem) => void;
  a11yLabel?: string;
}

export interface NavigationItemProps {
  item: NavigationItem;
  mode: NavigationMode;
  isActive?: boolean;
  isHovered?: boolean;
  isFocused?: boolean;
  level?: number; // For nested items
  showLabel?: boolean;
  showTooltip?: boolean;
  onClick?: (item: NavigationItem) => void;
  onHover?: (item: NavigationItem | null) => void;
  onFocus?: (item: NavigationItem | null) => void;
  className?: string;
  a11yLabel?: string;
}

export interface NavigationProfileProps {
  mode: NavigationMode;
  user: any; // From Userfront auth
  className?: string;
  showAvatar?: boolean;
  showEmail?: boolean;
  showRole?: boolean;
  onSettingsClick?: () => void;
  onLogoutClick?: () => void;
  a11yLabel?: string;
}

// Animation and transition props
export interface NavigationTransition {
  duration?: number | string;
  easing?: string;
  delay?: number | string;
}

// Accessibility props
export interface NavigationA11y {
  label?: string;
  role?: string;
  describedBy?: string;
  announcements?: {
    opened?: string;
    closed?: string;
    expanded?: string;
    collapsed?: string;
    itemActivated?: (label: string) => string;
    sectionToggled?: (title: string, expanded: boolean) => string;
  };
}

// Theme integration
export interface NavigationThemeConfig {
  mode?: 'light' | 'dark';
  customTokens?: Partial<typeof import('../../design-system/tokens/navigation').navigationTokens>;
}

// Utility types
export type NavigationPermission = string;
export type NavigationVisibilityFunction = (user: any) => boolean;
export type NavigationItemClickHandler = (item: NavigationItem, event?: React.MouseEvent) => void;

// Export grouped types for easier imports
export type NavigationTypes = {
  Mode: NavigationMode;
  ItemState: NavigationItemState;
  Item: NavigationItem;
  Badge: NavigationBadge;
  Section: NavigationSection;
  Config: NavigationConfig;
  State: NavigationState;
  Action: NavigationAction;
  Context: NavigationContextValue;
};