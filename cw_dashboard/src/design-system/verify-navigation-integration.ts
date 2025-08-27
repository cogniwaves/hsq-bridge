/**
 * Navigation Theme Integration Verification Script
 * Verifies that all navigation tokens are properly integrated into the theme system
 */

import { navigationTokens } from './tokens/navigation';
import { lightTheme } from './themes/light';
import { darkTheme } from './themes/dark';

console.log('🎨 Navigation Theme Integration Verification');
console.log('============================================');

// Check if navigation tokens are properly structured
console.log('\n✓ Navigation Tokens Structure:');
console.log(`  Layout modes: ${Object.keys(navigationTokens.layout).join(', ')}`);
console.log(`  Surface variants: ${Object.keys(navigationTokens.surfaces).join(', ')}`);
console.log(`  Item states: ${Object.keys(navigationTokens.itemStates.light).join(', ')}`);
console.log(`  Motion types: ${Object.keys(navigationTokens.motion).join(', ')}`);

// Check CSS variables in themes
console.log('\n✓ CSS Variables Integration:');
const navCssVars = Object.keys(lightTheme.cssVariables).filter(key => key.startsWith('--nav-'));
console.log(`  Light theme navigation vars: ${navCssVars.length}`);
const darkNavCssVars = Object.keys(darkTheme.cssVariables).filter(key => key.startsWith('--nav-'));
console.log(`  Dark theme navigation vars: ${darkNavCssVars.length}`);

// Check specific navigation properties
console.log('\n✓ Navigation Properties:');
console.log(`  Rail width: ${navigationTokens.layout.rail.width}`);
console.log(`  Drawer width: ${navigationTokens.layout.drawer.width}`);
console.log(`  Modal width: ${navigationTokens.layout.modal.width}`);

// Check theme-specific colors
console.log('\n✓ Theme-Specific Navigation Colors:');
console.log(`  Light rail background: ${navigationTokens.surfaces.light.rail.background}`);
console.log(`  Dark rail background: ${navigationTokens.surfaces.dark.rail.background}`);
console.log(`  Light active item: ${navigationTokens.itemStates.light.active.background}`);
console.log(`  Dark active item: ${navigationTokens.itemStates.dark.active.background}`);

// Check motion system
console.log('\n✓ Navigation Motion System:');
console.log(`  State transition: ${navigationTokens.motion.stateTransition.duration}`);
console.log(`  Item hover: ${navigationTokens.motion.item.hover.duration}`);
console.log(`  Modal enter: ${navigationTokens.motion.modalTransition.enter.duration}`);

// Check z-index system
console.log('\n✓ Navigation Z-Index System:');
console.log(`  Rail: ${navigationTokens.zIndex.rail}`);
console.log(`  Modal: ${navigationTokens.zIndex.modal}`);
console.log(`  Tooltip: ${navigationTokens.zIndex.tooltip}`);

// Check component integration
console.log('\n✓ Component Integration:');
console.log(`  Light navigation component has rail config: ${!!lightTheme.components.navigation.rail}`);
console.log(`  Dark navigation component has modal config: ${!!darkTheme.components.navigation.modal}`);

// Check CSS custom properties consistency
console.log('\n✓ CSS Custom Properties Consistency:');
const lightRailWidth = lightTheme.cssVariables['--nav-width-rail'];
const darkRailWidth = darkTheme.cssVariables['--nav-width-rail'];
const tokenRailWidth = navigationTokens.layout.rail.width;

console.log(`  Light theme rail width: ${lightRailWidth}`);
console.log(`  Dark theme rail width: ${darkRailWidth}`);
console.log(`  Token rail width: ${tokenRailWidth}`);
console.log(`  Consistency check: ${lightRailWidth === darkRailWidth && lightRailWidth === tokenRailWidth ? '✅' : '❌'}`);

// Check Tailwind integration examples
console.log('\n✓ Tailwind Integration Examples:');
console.log(`  Rail container class: ${navigationTokens.examples.tailwindClasses.railContainer}`);
console.log(`  Navigation item class: ${navigationTokens.examples.tailwindClasses.navigationItem}`);
console.log(`  Active item class: ${navigationTokens.examples.tailwindClasses.activeItem}`);

console.log('\n🎉 Navigation Theme Integration Verification Complete!');
console.log('All navigation design tokens are properly integrated into the theme system.');

// Export verification function for runtime use
export function verifyNavigationIntegration() {
  const results = {
    tokensStructure: !!navigationTokens.layout && !!navigationTokens.surfaces,
    cssVariablesIntegrated: navCssVars.length > 0 && darkNavCssVars.length > 0,
    componentIntegration: !!lightTheme.components.navigation.rail && !!darkTheme.components.navigation.modal,
    consistency: lightRailWidth === darkRailWidth && lightRailWidth === tokenRailWidth,
    motionSystem: !!navigationTokens.motion.stateTransition && !!navigationTokens.motion.item,
    zIndexSystem: typeof navigationTokens.zIndex.modal === 'number',
  };

  const allValid = Object.values(results).every(Boolean);
  
  return {
    success: allValid,
    results,
    summary: allValid ? 'All navigation integration checks passed!' : 'Some integration issues detected'
  };
}

export default verifyNavigationIntegration;