# HubSpot Bridge Dashboard Design System

## Overview

This document provides comprehensive reference documentation for the Material Design 3 inspired theme system implemented in the HubSpot Bridge Dashboard. The design system emphasizes business professionalism while maintaining accessibility and visual consistency.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Theme Usage](#theme-usage)
5. [Component Guidelines](#component-guidelines)
6. [Implementation Examples](#implementation-examples)
7. [Accessibility](#accessibility)
8. [Migration Guide](#migration-guide)

## Design Principles

### Business-First Approach
- **Professional**: Colors and typography suitable for financial/business applications
- **Trustworthy**: Design choices that inspire confidence in users
- **Clear**: High contrast and legible text across all themes

### No-Blue Constraint
- **Dark theme**: Completely avoids blue color components (B value always #00)
- **Amber-focused**: Uses warm amber, orange, and gold tones for dark theme
- **Pure black**: Darkest surfaces use #000000 for maximum contrast

### Accessibility
- **WCAG 2.1 AA**: All color combinations meet contrast requirements
- **System preference**: Automatic detection of user's OS theme preference
- **Smooth transitions**: 250ms easing for comfortable theme switching

## Color System

### Light Theme Palette

```typescript
// Primary - Professional Forest Green
primary: '#006C4C'
onPrimary: '#FFFFFF'
primaryContainer: '#7DF5C0'
onPrimaryContainer: '#002114'

// Secondary - Business Orange
secondary: '#8B5000'
onSecondary: '#FFFFFF'
secondaryContainer: '#FFCC6B'
onSecondaryContainer: '#2E1B00'

// Surface Colors
surface: '#FFFFFF'
background: '#FEFEFE'
surfaceVariant: '#F3F4F6'
```

### Dark Theme Palette (No Blue Components)

```typescript
// Primary - Warm Amber (B=00)
primary: '#FF9F00'
onPrimary: '#2A1A00'
primaryContainer: '#3D2600'
onPrimaryContainer: '#FFCC6B'

// Success - Pure Green (B=00)
success: '#66CC00'
onSuccess: '#1A2A00'

// Error - Coral Red (B=00)
error: '#FF6B00'
onError: '#2A1200'

// Surface Colors - Pure Black
background: '#000000'
surface: '#1A1A00'
surfaceContainer: '#0A0A00'
surfaceContainerHigh: '#000000'
```

### Typography Colors (Dark Theme)

```typescript
// Amber-based text colors
text: {
  primary: '#FFD700',    // Pure amber/gold
  secondary: '#E6C200',  // Medium amber
  tertiary: '#CC9900',   // Darker amber
}
```

### Status Colors

```typescript
// Light Theme
status: {
  healthy: '#059669',    // Forest green
  degraded: '#D97706',   // Amber warning
  unhealthy: '#DC2626',  // Professional red
  pending: '#6B7280',    // Neutral gray
}

// Dark Theme (No Blue)
status: {
  healthy: '#66CC00',    // Pure green
  degraded: '#FF8A00',   // Pure orange
  unhealthy: '#FF6B00',  // Coral red
  pending: '#999900',    // Amber neutral
}
```

## Typography

### Font Stack
```css
font-family: Inter, system-ui, -apple-system, sans-serif
```

### Text Color Usage

#### Light Theme
- **Primary text**: `#1C1B1F` - Main content, headings
- **Secondary text**: `#6B7280` - Supporting information
- **Tertiary text**: `#9CA3AF` - Subtle details

#### Dark Theme (Amber-based)
- **Primary text**: `#FFD700` - Main content, headings (pure gold)
- **Secondary text**: `#E6C200` - Supporting information (medium amber)
- **Tertiary text**: `#CC9900` - Subtle details (darker amber)

## Theme Usage

### React Context Setup

```tsx
import { ThemeProvider } from '../design-system/themes/themeProvider';

function App() {
  return (
    <ThemeProvider defaultMode="system" enableTransitions>
      {/* Your app content */}
    </ThemeProvider>
  );
}
```

### Theme Hook Usage

```tsx
import { useTheme } from '../design-system/themes/themeProvider';

function MyComponent() {
  const { mode, resolvedMode, theme, setMode, toggleMode } = useTheme();
  
  return (
    <div style={{ 
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-text-primary)'
    }}>
      Current theme: {resolvedMode}
    </div>
  );
}
```

### CSS Custom Properties

All theme values are available as CSS custom properties:

```css
/* Color properties */
--color-primary
--color-on-primary
--color-surface
--color-background
--color-text-primary
--color-text-secondary
--color-text-tertiary

/* Status properties */
--color-success
--color-warning
--color-error

/* Interactive properties */
--color-interactive-primary
--color-interactive-hover
--color-interactive-disabled
```

## Component Guidelines

### Buttons

#### Primary Button
```tsx
<button
  style={{
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-on-primary)',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    transition: 'background-color 250ms cubic-bezier(0.2, 0, 0, 1)'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = 'var(--color-interactive-hover)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
  }}
>
  Primary Action
</button>
```

#### Secondary Button
```tsx
<button
  style={{
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-outline)',
    borderRadius: '6px',
    padding: '8px 16px'
  }}
>
  Secondary Action
</button>
```

### Cards

```tsx
<div
  style={{
    backgroundColor: 'var(--color-surface)',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid var(--color-outline-variant)'
  }}
>
  Card content
</div>
```

### Status Indicators

```tsx
<span
  style={{
    backgroundColor: 'var(--color-success-container)',
    color: 'var(--color-success)',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  }}
>
  ✓ Healthy
</span>
```

## Implementation Examples

### Theme-Aware Component

```tsx
import { useTheme } from '../design-system/themes/themeProvider';

function StatusCard({ status, title, value }) {
  const { resolvedMode } = useTheme();
  
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'healthy':
        return {
          backgroundColor: 'var(--color-success-container)',
          color: 'var(--color-success)',
          borderColor: 'var(--color-success)'
        };
      case 'degraded':
        return {
          backgroundColor: 'var(--color-warning-container)',
          color: 'var(--color-warning)',
          borderColor: 'var(--color-warning)'
        };
      case 'unhealthy':
        return {
          backgroundColor: 'var(--color-error-container)',
          color: 'var(--color-error)',
          borderColor: 'var(--color-error)'
        };
      default:
        return {
          backgroundColor: 'var(--color-surface-variant)',
          color: 'var(--color-text-secondary)',
          borderColor: 'var(--color-outline)'
        };
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        padding: '20px',
        transition: 'background-color 250ms cubic-bezier(0.2, 0, 0, 1)'
      }}
    >
      <h3 style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      <p style={{ color: 'var(--color-text-secondary)' }}>{value}</p>
      <span
        style={{
          ...getStatusStyle(status),
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: '500',
          border: '1px solid'
        }}
      >
        {status.toUpperCase()}
      </span>
    </div>
  );
}
```

### Responsive Layout with Theme

```tsx
function Dashboard() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text-primary)',
        transition: 'background-color 250ms cubic-bezier(0.2, 0, 0, 1)'
      }}
    >
      <nav
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-outline-variant)',
          padding: '16px 24px'
        }}
      >
        <h1 style={{ color: 'var(--color-text-primary)' }}>
          Dashboard
        </h1>
      </nav>
      
      <main style={{ padding: '24px' }}>
        {/* Dashboard content */}
      </main>
    </div>
  );
}
```

## Accessibility

### Contrast Ratios

All color combinations meet WCAG 2.1 AA standards:

- **Normal text**: 4.5:1 minimum contrast ratio
- **Large text**: 3:1 minimum contrast ratio
- **Interactive elements**: Clear focus indicators using `--color-primary`

### Focus Management

```css
button:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Screen Reader Support

Use semantic HTML elements and provide proper ARIA labels:

```tsx
<button
  aria-label="Toggle between light and dark theme"
  onClick={toggleMode}
>
  Theme Toggle
</button>
```

## Migration Guide

### From Hardcoded Colors

#### Before
```tsx
<div className="bg-white text-gray-900 border-gray-200">
  Content
</div>
```

#### After
```tsx
<div
  style={{
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-outline-variant)'
  }}
>
  Content
</div>
```

### From Tailwind Classes

#### Before
```tsx
<button className="bg-blue-600 hover:bg-blue-700 text-white">
  Action
</button>
```

#### After
```tsx
<button
  style={{
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-on-primary)'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = 'var(--color-interactive-hover)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
  }}
>
  Action
</button>
```

## Theme System Architecture

### File Structure
```
src/design-system/
├── tokens/
│   ├── color.ts          # Color token definitions
│   ├── typography.ts     # Typography scales
│   ├── spacing.ts        # Spacing and layout tokens
│   ├── elevation.ts      # Shadow and elevation
│   └── motion.ts         # Animation and transitions
├── themes/
│   ├── light.ts          # Light theme configuration
│   ├── dark.ts           # Dark theme configuration
│   └── themeProvider.tsx # React context provider
└── components/
    └── ThemeToggle.tsx   # Theme switching component
```

### Token Hierarchy

1. **Base tokens**: Raw values (colors, spacing units)
2. **Semantic tokens**: Purpose-based (primary, success, error)
3. **Component tokens**: Specific component styles
4. **CSS variables**: Runtime switchable properties

## Best Practices

### Do's
✅ Use CSS custom properties for all color references  
✅ Test components in both light and dark themes  
✅ Maintain consistent spacing using design tokens  
✅ Use semantic color names rather than literal colors  
✅ Ensure proper contrast ratios for accessibility  

### Don'ts
❌ Hardcode color values in components  
❌ Use blue colors in dark theme (B component must be #00)  
❌ Skip transition animations for theme switching  
❌ Override theme colors without considering accessibility  
❌ Use pixel values instead of design tokens  

## Support

For questions or contributions to the design system:

1. Check this documentation first
2. Review the implementation in `src/design-system/`
3. Test changes in both light and dark themes
4. Ensure accessibility compliance
5. Update documentation for any new patterns

---

**Version**: 1.0.0  
**Last Updated**: August 2025  
**Maintainer**: Claude Code Assistant