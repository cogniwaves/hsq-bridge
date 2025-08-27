/**
 * Navigation Theme Integration Tests
 * Verifies type safety and integration completeness
 */

import { navigationTokens } from '../tokens/navigation';
import { lightTheme } from '../themes/light';
import { darkTheme } from '../themes/dark';

describe('Navigation Theme Integration', () => {
  describe('Token Structure', () => {
    test('should have all required navigation token categories', () => {
      expect(navigationTokens).toHaveProperty('layout');
      expect(navigationTokens).toHaveProperty('surfaces');
      expect(navigationTokens).toHaveProperty('elevation');
      expect(navigationTokens).toHaveProperty('spacing');
      expect(navigationTokens).toHaveProperty('typography');
      expect(navigationTokens).toHaveProperty('itemStates');
      expect(navigationTokens).toHaveProperty('motion');
      expect(navigationTokens).toHaveProperty('breakpoints');
      expect(navigationTokens).toHaveProperty('zIndex');
      expect(navigationTokens).toHaveProperty('a11y');
      expect(navigationTokens).toHaveProperty('examples');
    });

    test('should have navigation modes in layout', () => {
      expect(navigationTokens.layout).toHaveProperty('rail');
      expect(navigationTokens.layout).toHaveProperty('drawer');
      expect(navigationTokens.layout).toHaveProperty('modal');
    });

    test('should have light and dark variants for surfaces', () => {
      expect(navigationTokens.surfaces).toHaveProperty('light');
      expect(navigationTokens.surfaces).toHaveProperty('dark');
      
      ['rail', 'drawer', 'modal'].forEach(mode => {
        expect(navigationTokens.surfaces.light).toHaveProperty(mode);
        expect(navigationTokens.surfaces.dark).toHaveProperty(mode);
      });
    });

    test('should have light and dark variants for item states', () => {
      expect(navigationTokens.itemStates).toHaveProperty('light');
      expect(navigationTokens.itemStates).toHaveProperty('dark');
      
      ['default', 'hover', 'active', 'focused', 'disabled'].forEach(state => {
        expect(navigationTokens.itemStates.light).toHaveProperty(state);
        expect(navigationTokens.itemStates.dark).toHaveProperty(state);
      });
    });
  });

  describe('Theme Integration', () => {
    test('light theme should include navigation CSS variables', () => {
      const lightCssVars = lightTheme.cssVariables;
      
      // Check navigation layout variables
      expect(lightCssVars).toHaveProperty('--nav-width-rail');
      expect(lightCssVars).toHaveProperty('--nav-width-drawer');
      expect(lightCssVars).toHaveProperty('--nav-width-modal');
      
      // Check navigation surface variables
      expect(lightCssVars).toHaveProperty('--nav-rail-bg');
      expect(lightCssVars).toHaveProperty('--nav-drawer-bg');
      expect(lightCssVars).toHaveProperty('--nav-modal-bg');
      
      // Check navigation item state variables
      expect(lightCssVars).toHaveProperty('--nav-item-default-bg');
      expect(lightCssVars).toHaveProperty('--nav-item-hover-bg');
      expect(lightCssVars).toHaveProperty('--nav-item-active-bg');
      
      // Check navigation motion variables
      expect(lightCssVars).toHaveProperty('--nav-transition-duration');
      expect(lightCssVars).toHaveProperty('--nav-transition-easing');
      
      // Check navigation z-index variables
      expect(lightCssVars).toHaveProperty('--nav-rail-z');
      expect(lightCssVars).toHaveProperty('--nav-drawer-z');
      expect(lightCssVars).toHaveProperty('--nav-modal-z');
    });

    test('dark theme should include navigation CSS variables', () => {
      const darkCssVars = darkTheme.cssVariables;
      
      // Same checks as light theme - should have identical structure
      expect(darkCssVars).toHaveProperty('--nav-width-rail');
      expect(darkCssVars).toHaveProperty('--nav-width-drawer');
      expect(darkCssVars).toHaveProperty('--nav-width-modal');
      expect(darkCssVars).toHaveProperty('--nav-rail-bg');
      expect(darkCssVars).toHaveProperty('--nav-drawer-bg');
      expect(darkCssVars).toHaveProperty('--nav-modal-bg');
    });

    test('light and dark themes should have different navigation surface colors', () => {
      const lightNavRailBg = lightTheme.cssVariables['--nav-rail-bg'];
      const darkNavRailBg = darkTheme.cssVariables['--nav-rail-bg'];
      
      expect(lightNavRailBg).toBeDefined();
      expect(darkNavRailBg).toBeDefined();
      expect(lightNavRailBg).not.toBe(darkNavRailBg);
    });

    test('navigation components should be enhanced with design tokens', () => {
      // Light theme navigation component
      expect(lightTheme.components.navigation).toHaveProperty('backgroundColor');
      expect(lightTheme.components.navigation).toHaveProperty('rail');
      expect(lightTheme.components.navigation).toHaveProperty('modal');
      expect(lightTheme.components.navigation.rail).toHaveProperty('width');
      expect(lightTheme.components.navigation.modal).toHaveProperty('backdropColor');
      
      // Dark theme navigation component
      expect(darkTheme.components.navigation).toHaveProperty('backgroundColor');
      expect(darkTheme.components.navigation).toHaveProperty('rail');
      expect(darkTheme.components.navigation).toHaveProperty('modal');
      expect(darkTheme.components.navigation.rail).toHaveProperty('width');
      expect(darkTheme.components.navigation.modal).toHaveProperty('backdropColor');
    });
  });

  describe('Type Safety', () => {
    test('navigation token types should be correctly inferred', () => {
      // These should compile without TypeScript errors
      const railWidth: string = navigationTokens.layout.rail.width;
      const drawerWidth: string = navigationTokens.layout.drawer.width;
      const modalWidth: string = navigationTokens.layout.modal.width;
      
      expect(railWidth).toBe('80px');
      expect(drawerWidth).toBe('280px');
      expect(modalWidth).toBe('320px');
    });

    test('navigation surfaces should have correct theme variants', () => {
      // Light theme surfaces
      const lightRailBg: string = navigationTokens.surfaces.light.rail.background;
      const lightDrawerBg: string = navigationTokens.surfaces.light.drawer.background;
      
      // Dark theme surfaces
      const darkRailBg: string = navigationTokens.surfaces.dark.rail.background;
      const darkDrawerBg: string = navigationTokens.surfaces.dark.drawer.background;
      
      expect(typeof lightRailBg).toBe('string');
      expect(typeof lightDrawerBg).toBe('string');
      expect(typeof darkRailBg).toBe('string');
      expect(typeof darkDrawerBg).toBe('string');
    });

    test('navigation item states should have correct color properties', () => {
      const lightDefaultState = navigationTokens.itemStates.light.default;
      const darkHoverState = navigationTokens.itemStates.dark.hover;
      
      expect(lightDefaultState).toHaveProperty('background');
      expect(lightDefaultState).toHaveProperty('color');
      expect(lightDefaultState).toHaveProperty('icon');
      
      expect(darkHoverState).toHaveProperty('background');
      expect(darkHoverState).toHaveProperty('color');
      expect(darkHoverState).toHaveProperty('icon');
    });
  });

  describe('Consistency Checks', () => {
    test('navigation widths should be consistent across tokens', () => {
      // Layout tokens
      const layoutRailWidth = navigationTokens.layout.rail.width;
      const layoutDrawerWidth = navigationTokens.layout.drawer.width;
      const layoutModalWidth = navigationTokens.layout.modal.width;
      
      // CSS variables in themes
      const lightThemeRailWidth = lightTheme.cssVariables['--nav-width-rail'];
      const lightThemeDrawerWidth = lightTheme.cssVariables['--nav-width-drawer'];
      const lightThemeModalWidth = lightTheme.cssVariables['--nav-width-modal'];
      
      expect(layoutRailWidth).toBe(lightThemeRailWidth);
      expect(layoutDrawerWidth).toBe(lightThemeDrawerWidth);
      expect(layoutModalWidth).toBe(lightThemeModalWidth);
    });

    test('navigation z-index values should be properly ordered', () => {
      const railZ = parseInt(navigationTokens.zIndex.rail.toString());
      const drawerZ = parseInt(navigationTokens.zIndex.drawer.toString());
      const modalBackdropZ = parseInt(navigationTokens.zIndex.modalBackdrop.toString());
      const modalZ = parseInt(navigationTokens.zIndex.modal.toString());
      const tooltipZ = parseInt(navigationTokens.zIndex.tooltip.toString());
      
      // Modal should be above backdrop, tooltip should be highest
      expect(modalZ).toBeGreaterThan(modalBackdropZ);
      expect(tooltipZ).toBeGreaterThan(modalZ);
      
      // Rail and drawer should have same z-index (not overlapping)
      expect(railZ).toBe(drawerZ);
    });

    test('motion durations should be valid CSS time values', () => {
      const stateTransitionDuration = navigationTokens.motion.stateTransition.duration;
      const modalEnterDuration = navigationTokens.motion.modalTransition.enter.duration;
      const itemHoverDuration = navigationTokens.motion.item.hover.duration;
      
      // Should end with 'ms'
      expect(stateTransitionDuration).toMatch(/^\d+ms$/);
      expect(modalEnterDuration).toMatch(/^\d+ms$/);
      expect(itemHoverDuration).toMatch(/^\d+ms$/);
    });
  });

  describe('Example Integration', () => {
    test('CSS variables should be properly formatted', () => {
      const cssVars = navigationTokens.examples.cssVariables;
      
      Object.keys(cssVars).forEach(key => {
        expect(key).toMatch(/^--nav-/);
      });
      
      expect(cssVars['--nav-width-rail']).toBe(navigationTokens.layout.rail.width);
      expect(cssVars['--nav-width-drawer']).toBe(navigationTokens.layout.drawer.width);
    });

    test('Tailwind classes should follow naming conventions', () => {
      const tailwindClasses = navigationTokens.examples.tailwindClasses;
      
      expect(tailwindClasses.railContainer).toContain('w-20');
      expect(tailwindClasses.drawerContainer).toContain('w-70');
      expect(tailwindClasses.modalContainer).toContain('w-80');
      
      expect(tailwindClasses.navigationItem).toContain('h-14');
      expect(tailwindClasses.activeItem).toContain('bg-primary-container');
    });
  });
});

// Type-only tests (these will fail compilation if types are wrong)
type NavigationModeTest = typeof navigationTokens.layout.rail.width; // Should be string
type NavigationSurfaceTest = typeof navigationTokens.surfaces.light.drawer; // Should have background, border, overlay
type NavigationItemStateTest = typeof navigationTokens.itemStates.dark.active; // Should have background, color, icon

// Export types for other tests if needed
export type {
  NavigationModeTest,
  NavigationSurfaceTest, 
  NavigationItemStateTest
};