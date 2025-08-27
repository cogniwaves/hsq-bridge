# Navigation Component Integration Guide

## Overview

The HSQ Bridge navigation system provides a production-ready, fully accessible, and responsive navigation architecture that integrates seamlessly with the existing Userfront authentication system and Material Design 3 tokens.

## Features

### Core Capabilities
- **Responsive Modes**: Rail (80px), Drawer (280px), and Modal (mobile) states
- **Authentication Integration**: Full Userfront user context and permissions
- **Material Design 3**: Complete token integration with theme support
- **Accessibility**: WCAG 2.1 AA compliant with full keyboard navigation
- **TypeScript**: Comprehensive type safety throughout
- **Performance**: Optimized re-renders with memoization

### Navigation States
1. **Rail Mode** (Collapsed - 80px)
   - Icon-only navigation
   - Tooltip support on hover
   - Compact user avatar
   - Expand button

2. **Drawer Mode** (Expanded - 280px)
   - Full navigation with labels
   - Collapsible sections
   - Complete user profile
   - Nested navigation support

3. **Modal Mode** (Mobile overlay)
   - Full-screen mobile navigation
   - Touch gestures (swipe to close)
   - 48px touch targets
   - Focus trapping

## Quick Start

### Basic Implementation

```tsx
import SideNavigation from '@/components/navigation';

function DashboardLayout({ children }) {
  return (
    <SideNavigation>
      {children}
    </SideNavigation>
  );
}
```

### With Custom Configuration

```tsx
import SideNavigation, { NavigationConfig } from '@/components/navigation';

const customConfig: NavigationConfig = {
  sections: [
    {
      id: 'main',
      items: [
        {
          id: 'home',
          label: 'Home',
          icon: HomeIcon,
          href: '/',
        },
        // Add more items
      ],
    },
  ],
  branding: {
    title: 'My App',
    logo: '🚀',
  },
};

function App() {
  return (
    <SideNavigation config={customConfig}>
      <YourContent />
    </SideNavigation>
  );
}
```

## Advanced Usage

### Dynamic Badge Updates

```tsx
import { updateNavigationBadges } from '@/components/navigation';
import { useEffect } from 'react';

function DashboardWithNotifications() {
  useEffect(() => {
    // Fetch notification counts
    fetchNotificationCounts().then(counts => {
      updateNavigationBadges({
        'invoices': counts.pendingInvoices,
        'payments': counts.newPayments,
        'notifications': counts.unreadNotifications,
      });
    });
  }, []);

  return <SideNavigation />;
}
```

### Permission-Based Navigation

```tsx
// In navigationConfig.ts
const adminSection: NavigationSection = {
  id: 'admin',
  title: 'Administration',
  items: [
    {
      id: 'users',
      label: 'User Management',
      icon: UserGroupIcon,
      href: '/admin/users',
      requiredPermissions: ['admin', 'user:manage'],
    },
  ],
  visible: (user) => user?.role === 'admin',
};
```

### Programmatic Navigation Control

```tsx
import { useNavigationContext } from '@/components/navigation';

function NavigationControls() {
  const {
    toggleNavigation,
    expandNavigation,
    collapseNavigation,
    setActiveItem,
  } = useNavigationContext();

  return (
    <div>
      <button onClick={toggleNavigation}>Toggle Nav</button>
      <button onClick={expandNavigation}>Expand</button>
      <button onClick={collapseNavigation}>Collapse</button>
    </div>
  );
}
```

### Custom Navigation Items

```tsx
const navigationItem: NavigationItem = {
  id: 'custom-action',
  label: 'Custom Action',
  icon: SparklesIcon,
  onClick: () => {
    // Custom action handler
    openCustomModal();
  },
  badge: {
    text: 'NEW',
    color: 'success',
    pulse: true,
  },
  visible: (user) => user?.features?.includes('beta'),
};
```

## Authentication Integration

The navigation system automatically integrates with Userfront authentication:

```tsx
// Navigation items automatically receive user context
{
  id: 'profile',
  label: 'Profile',
  icon: UserIcon,
  href: '/profile',
  visible: (user) => user?.isAuthenticated,
}

// User profile section displays:
// - User name/email
// - Avatar with initials
// - Role information
// - Logout functionality
```

## Theme Integration

The navigation uses the `useNavigationTheme()` hook for complete theme integration:

```tsx
// Automatic theme switching
// Navigation adapts to light/dark mode automatically
// All colors, spacing, and typography from design tokens

// Custom theme overrides
<SideNavigation 
  className="custom-nav"
  style={{
    '--nav-primary-color': '#custom-color',
  }}
/>
```

## Accessibility Features

### Keyboard Navigation
- `Tab` - Navigate through items
- `Enter/Space` - Activate items
- `Escape` - Close modal navigation
- `Alt+M` - Toggle navigation (customizable)

### Screen Reader Support
- Proper ARIA labels and roles
- Navigation landmarks
- State announcements
- Skip navigation link

### Focus Management
- Focus trapping in modal
- Focus restoration on close
- Visual focus indicators
- Logical tab order

## Responsive Behavior

```tsx
// Automatic responsive behavior
// < 768px: Modal navigation
// 768px - 1024px: Rail with toggle option
// ≥ 1024px: Drawer with collapse option

// Override default breakpoints
const customBreakpoints = {
  mobile: 640,
  tablet: 1024,
  desktop: 1440,
};
```

## Component API Reference

### SideNavigation Props

```tsx
interface SideNavigationProps {
  config?: NavigationConfig;
  defaultMode?: NavigationMode;
  defaultExpanded?: boolean;
  onModeChange?: (mode: NavigationMode) => void;
  onExpandedChange?: (expanded: boolean) => void;
  onItemClick?: (item: NavigationItem) => void;
  sticky?: boolean;
  className?: string;
  a11yLabel?: string;
  children?: ReactNode;
}
```

### NavigationItem Interface

```tsx
interface NavigationItem {
  id: string;
  label: string;
  icon: ReactNode | string;
  href?: string;
  onClick?: () => void;
  badge?: NavigationBadge;
  disabled?: boolean;
  visible?: boolean | ((user: any) => boolean);
  requiredPermissions?: string[];
  children?: NavigationItem[];
  external?: boolean;
  description?: string;
}
```

### NavigationConfig Interface

```tsx
interface NavigationConfig {
  sections: NavigationSection[];
  footer?: NavigationSection;
  branding?: {
    logo?: ReactNode | string;
    title?: string;
    subtitle?: string;
    href?: string;
  };
}
```

## CSS Customization

### Using CSS Classes

```css
/* Custom navigation styles */
.nav-rail {
  /* Rail mode customization */
}

.nav-drawer {
  /* Drawer mode customization */
}

.nav-modal {
  /* Modal mode customization */
}

.nav-item.active {
  /* Active item styling */
}

.nav-profile {
  /* Profile section styling */
}
```

### Using CSS Variables

```css
:root {
  --nav-width-rail: 80px;
  --nav-width-drawer: 280px;
  --nav-transition-duration: 300ms;
  --nav-item-height: 56px;
}
```

## Performance Optimization

### Memoization
- Navigation items are memoized to prevent unnecessary re-renders
- State updates are batched for performance
- Icons are lazy-loaded when possible

### Code Splitting
```tsx
// Lazy load navigation for better initial load
const SideNavigation = lazy(() => import('@/components/navigation'));

function App() {
  return (
    <Suspense fallback={<NavigationSkeleton />}>
      <SideNavigation />
    </Suspense>
  );
}
```

## Testing

### Unit Testing Example

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import SideNavigation from '@/components/navigation';

describe('SideNavigation', () => {
  it('renders navigation items', () => {
    render(<SideNavigation />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('handles item clicks', () => {
    const handleClick = jest.fn();
    render(<SideNavigation onItemClick={handleClick} />);
    
    fireEvent.click(screen.getByText('Invoices'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('toggles between rail and drawer', () => {
    render(<SideNavigation />);
    
    const expandButton = screen.getByLabelText('Toggle navigation menu');
    fireEvent.click(expandButton);
    
    // Check for expanded state
    expect(screen.getByText('Tools & Integration')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

1. **Navigation not responding to auth changes**
   - Ensure `UserfrontAuthProvider` wraps the navigation
   - Check that user context is properly initialized

2. **Mobile navigation not opening**
   - Verify z-index values don't conflict with other elements
   - Check that portal container is mounted

3. **Tooltips not showing in rail mode**
   - Ensure tooltip delay is configured (default 500ms)
   - Check z-index layering

4. **Theme not applying**
   - Verify `ThemeProvider` wraps the navigation
   - Check that CSS variables are properly set

## Migration from Existing Navigation

```tsx
// Old navigation component
<OldSidebar items={menuItems} />

// New navigation system
import { navigationConfig } from './navigationConfig';

// Transform old items to new format
const transformedConfig = {
  sections: [{
    id: 'main',
    items: menuItems.map(item => ({
      id: item.key,
      label: item.title,
      icon: item.icon,
      href: item.path,
    })),
  }],
};

<SideNavigation config={transformedConfig} />
```

## Best Practices

1. **Keep navigation config centralized** in `navigationConfig.ts`
2. **Use permission functions** for dynamic visibility
3. **Implement proper loading states** for badge counts
4. **Test on mobile devices** for touch interactions
5. **Monitor performance** with React DevTools
6. **Provide keyboard shortcuts** for power users
7. **Use semantic HTML** for better accessibility
8. **Keep navigation depth shallow** (max 2 levels)

## Support

For issues or questions about the navigation system:
1. Check this documentation
2. Review the TypeScript interfaces for API details
3. Inspect the component source code
4. Contact the development team

The navigation system is designed to be extensible and maintainable while providing a superior user experience across all devices and accessibility needs.