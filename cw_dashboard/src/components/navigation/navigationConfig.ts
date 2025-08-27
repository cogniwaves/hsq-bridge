/**
 * HSQ Bridge Navigation Configuration
 * Defines the navigation structure, items, and permissions
 */

import { 
  HomeIcon, 
  DocumentTextIcon, 
  CreditCardIcon, 
  ArrowPathIcon, 
  Cog6ToothIcon, 
  HeartIcon,
  UserGroupIcon,
  KeyIcon,
  ChartBarIcon,
  BellIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  ServerIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  BuildingOffice2Icon,
  UserIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { NavigationConfig, NavigationItem, NavigationSection } from './types';

// Main navigation items
const mainNavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: HomeIcon,
    href: '/',
    description: 'Overview and analytics',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: DocumentTextIcon,
    href: '/invoices',
    description: 'Manage invoices across platforms',
    badge: {
      count: 0, // Will be dynamically updated
      color: 'primary',
    },
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCardIcon,
    href: '/payments',
    description: 'Payment processing and reconciliation',
    badge: {
      count: 0, // Will be dynamically updated
      color: 'success',
    },
  },
];

// Integration tools navigation
const toolsNavigationItems: NavigationItem[] = [
  {
    id: 'sync-status',
    label: 'Sync Status',
    icon: ArrowPathIcon,
    href: '/sync',
    description: 'Monitor synchronization status',
    children: [
      {
        id: 'sync-hubspot',
        label: 'HubSpot',
        icon: BuildingOffice2Icon,
        href: '/sync/hubspot',
        description: 'HubSpot sync status',
      },
      {
        id: 'sync-stripe',
        label: 'Stripe',
        icon: CreditCardIcon,
        href: '/sync/stripe',
        description: 'Stripe sync status',
      },
      {
        id: 'sync-quickbooks',
        label: 'QuickBooks',
        icon: ChartBarIcon,
        href: '/sync/quickbooks',
        description: 'QuickBooks sync status',
      },
    ],
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: CloudArrowDownIcon,
    href: '/webhooks',
    description: 'Webhook event monitoring',
    badge: {
      count: 0, // Will be dynamically updated for pending/failed webhooks
      color: 'warning',
    },
  },
  {
    id: 'transfer-queue',
    label: 'Transfer Queue',
    icon: ArrowsRightLeftIcon,
    href: '/transfers',
    description: 'QuickBooks transfer approval queue',
    badge: {
      count: 0, // Will be dynamically updated for pending transfers
      color: 'info',
    },
  },
  {
    id: 'health',
    label: 'Health Checks',
    icon: HeartIcon,
    href: '/health',
    description: 'System health monitoring',
  },
];

// Settings and configuration
const settingsNavigationItems: NavigationItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: Cog6ToothIcon,
    href: '/settings',
    description: 'Application settings',
    children: [
      {
        id: 'settings-general',
        label: 'General',
        icon: Cog6ToothIcon,
        href: '/settings/general',
        description: 'General application settings',
      },
      {
        id: 'settings-integrations',
        label: 'Integrations',
        icon: CloudArrowUpIcon,
        href: '/settings/integrations',
        description: 'Configure integrations',
      },
      {
        id: 'settings-notifications',
        label: 'Notifications',
        icon: BellIcon,
        href: '/settings/notifications',
        description: 'Notification preferences',
      },
    ],
  },
];

// Admin navigation items (role-based)
const adminNavigationItems: NavigationItem[] = [
  {
    id: 'users',
    label: 'User Management',
    icon: UserGroupIcon,
    href: '/admin/users',
    description: 'Manage users and permissions',
    requiredPermissions: ['admin', 'user:manage'],
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: KeyIcon,
    href: '/admin/api-keys',
    description: 'Manage API access keys',
    requiredPermissions: ['admin', 'api:manage'],
    badge: {
      text: 'Admin',
      color: 'error',
    },
  },
  {
    id: 'system',
    label: 'System',
    icon: ServerIcon,
    href: '/admin/system',
    description: 'System configuration and logs',
    requiredPermissions: ['admin', 'system:manage'],
  },
];

// Help and support items
const helpNavigationItems: NavigationItem[] = [
  {
    id: 'documentation',
    label: 'Documentation',
    icon: QuestionMarkCircleIcon,
    href: 'https://docs.hsq-bridge.com',
    external: true,
    description: 'View documentation',
  },
  {
    id: 'support',
    label: 'Support',
    icon: ExclamationTriangleIcon,
    onClick: () => {
      // Open support modal or navigate to support
      console.log('Open support');
    },
    description: 'Get help and support',
  },
];

// Navigation sections configuration
const navigationSections: NavigationSection[] = [
  {
    id: 'main',
    items: mainNavigationItems,
  },
  {
    id: 'tools',
    title: 'Tools & Integration',
    items: toolsNavigationItems,
    divider: true,
    collapsible: true,
    defaultCollapsed: false,
  },
  {
    id: 'settings',
    title: 'Configuration',
    items: settingsNavigationItems,
    divider: true,
    collapsible: true,
    defaultCollapsed: true,
  },
  {
    id: 'admin',
    title: 'Administration',
    items: adminNavigationItems,
    divider: true,
    collapsible: true,
    defaultCollapsed: true,
    visible: (user: any) => {
      // Only show admin section for users with admin role or specific permissions
      return user?.role === 'admin' || user?.permissions?.includes('admin');
    },
  },
  {
    id: 'help',
    title: 'Help & Support',
    items: helpNavigationItems,
    divider: false,
  },
];

// Footer/profile section configuration
const footerSection: NavigationSection = {
  id: 'profile',
  items: [
    {
      id: 'profile',
      label: 'Profile',
      icon: UserIcon,
      href: '/profile',
      description: 'View and edit profile',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: BellIcon,
      onClick: () => {
        // Open notifications panel
        console.log('Open notifications');
      },
      description: 'View notifications',
      badge: {
        count: 0, // Will be dynamically updated
        color: 'error',
        pulse: true,
      },
    },
  ],
};

// Complete navigation configuration
export const navigationConfig: NavigationConfig = {
  sections: navigationSections,
  footer: footerSection,
  branding: {
    title: 'HSQ Bridge',
    subtitle: 'Integration Platform',
    href: '/',
  },
};

// Helper function to update navigation badges dynamically
export function updateNavigationBadges(updates: Record<string, number | undefined>) {
  // This function would be called from your data fetching logic
  // to update badge counts dynamically
  
  // Example usage:
  // updateNavigationBadges({
  //   'invoices': 5,
  //   'payments': 3,
  //   'webhooks': 1,
  //   'transfer-queue': 10,
  //   'notifications': 2,
  // });
  
  Object.entries(updates).forEach(([itemId, count]) => {
    const item = findNavigationItem(itemId);
    if (item && item.badge) {
      item.badge.count = count;
    }
  });
}

// Helper function to find a navigation item by ID
export function findNavigationItem(itemId: string): NavigationItem | undefined {
  for (const section of navigationSections) {
    for (const item of section.items) {
      if (item.id === itemId) return item;
      if (item.children) {
        const child = item.children.find(c => c.id === itemId);
        if (child) return child;
      }
    }
  }
  
  // Check footer section
  for (const item of footerSection.items) {
    if (item.id === itemId) return item;
  }
  
  return undefined;
}

// Helper function to get visible navigation sections for a user
export function getVisibleSections(user: any): NavigationSection[] {
  return navigationSections.filter(section => {
    if (typeof section.visible === 'function') {
      return section.visible(user);
    }
    return section.visible !== false;
  });
}

// Helper function to check if user has required permissions
export function hasNavigationPermission(
  requiredPermissions: string[] | undefined,
  user: any
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true; // No permissions required
  }
  
  if (!user || !user.permissions) {
    return false; // User has no permissions
  }
  
  // Check if user has any of the required permissions
  return requiredPermissions.some(permission => 
    user.permissions.includes(permission) || user.role === 'admin'
  );
}

// Export for external use
export default navigationConfig;