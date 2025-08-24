/**
 * Material Design 3 Theme Provider
 * React context for theme management with TypeScript support
 */

'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { lightTheme } from './light';
import { darkTheme } from './dark';

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';
type Theme = typeof lightTheme | typeof darkTheme;

// Theme context interface
interface ThemeContextType {
  // Current theme mode
  mode: ThemeMode;
  
  // Resolved theme (light or dark, never system)
  resolvedMode: 'light' | 'dark';
  
  // Current theme object
  theme: Theme;
  
  // Theme switching functions
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  
  // System preference detection
  systemPreference: 'light' | 'dark';
  
  // Loading state for hydration
  isLoading: boolean;
}

// Create theme context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider props
interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
  storageKey?: string;
  enableSystem?: boolean;
  enableTransitions?: boolean;
}

// Local storage key
const DEFAULT_STORAGE_KEY = 'hs-bridge-theme';

// System preference detection hook
function useSystemPreference(): 'light' | 'dark' {
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial value
    setSystemPreference(mediaQuery.matches ? 'dark' : 'light');

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return systemPreference;
}

// Theme provider component
export function ThemeProvider({
  children,
  defaultMode = 'system',
  storageKey = DEFAULT_STORAGE_KEY,
  enableSystem = true,
  enableTransitions = true,
}: ThemeProviderProps) {
  const systemPreference = useSystemPreference();
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve the actual theme mode (never 'system')
  const resolvedMode: 'light' | 'dark' = mode === 'system' ? systemPreference : mode;
  
  // Get the current theme object
  const theme = resolvedMode === 'dark' ? darkTheme : lightTheme;

  // Load saved theme from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedMode = localStorage.getItem(storageKey) as ThemeMode;
      if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
        setModeState(savedMode);
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  // Save theme to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined' || isLoading) return;

    try {
      localStorage.setItem(storageKey, mode);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }, [mode, storageKey, isLoading]);

  // Apply CSS variables to document root
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('theme-light', 'theme-dark');
    
    // Add current theme class
    root.classList.add(`theme-${resolvedMode}`);
    
    // Apply CSS custom properties
    Object.entries(theme.cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Add transition class for smooth theme switching
    if (enableTransitions && !isLoading) {
      root.classList.add('theme-transition');
      
      // Remove transition class after animation completes
      const timeoutId = setTimeout(() => {
        root.classList.remove('theme-transition');
      }, parseInt(theme.motion.duration.medium3));
      
      return () => clearTimeout(timeoutId);
    }
  }, [resolvedMode, theme, enableTransitions, isLoading]);

  // Theme mode setter with validation
  const setMode = (newMode: ThemeMode) => {
    if (!enableSystem && newMode === 'system') {
      console.warn('System theme is disabled');
      return;
    }
    setModeState(newMode);
  };

  // Toggle between light and dark (skips system)
  const toggleMode = () => {
    const currentResolved = mode === 'system' ? systemPreference : mode;
    setMode(currentResolved === 'light' ? 'dark' : 'light');
  };

  // Context value
  const contextValue: ThemeContextType = {
    mode,
    resolvedMode,
    theme,
    setMode,
    toggleMode,
    systemPreference,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Theme hook
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

// CSS helper hook for styled components
export function useThemeStyles() {
  const { theme, resolvedMode } = useTheme();
  
  return {
    theme,
    mode: resolvedMode,
    colors: theme.colors,
    spacing: theme.spacing,
    typography: theme.typography,
    elevation: theme.elevation,
    motion: theme.motion,
    breakpoints: theme.breakpoints,
    components: theme.components,
  };
}

// CSS-in-JS helper for creating theme-aware styles
export function createThemeStyles(styleFunction: (theme: Theme) => Record<string, any>) {
  return function useStyles() {
    const { theme } = useTheme();
    return styleFunction(theme);
  };
}

// Utility function to apply theme variables globally
export function applyThemeVariables(theme: Theme, element?: HTMLElement) {
  const target = element || (typeof document !== 'undefined' ? document.documentElement : null);
  
  if (!target) return;

  Object.entries(theme.cssVariables).forEach(([property, value]) => {
    target.style.setProperty(property, value);
  });
}

// Export types
export type { ThemeContextType };
export type AppTheme = Theme;

// Export theme objects for direct access
export { lightTheme, darkTheme };