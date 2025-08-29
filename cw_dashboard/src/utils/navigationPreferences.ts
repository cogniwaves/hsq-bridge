/**
 * Navigation Preferences Storage
 * Manages user preferences for navigation behavior, themes, and settings
 * with localStorage persistence and preference synchronization
 */

'use client';

// Navigation preference types
export interface NavigationPreferences {
  // Layout preferences
  defaultMode: 'rail' | 'drawer' | 'modal';
  autoCollapse: boolean;
  expandedSections: string[];
  stickyNavigation: boolean;
  
  // Interaction preferences
  enableAnimations: boolean;
  animationDuration: 'fast' | 'normal' | 'slow';
  enableHapticFeedback: boolean;
  enableSounds: boolean;
  
  // Accessibility preferences
  highContrast: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  enableKeyboardShortcuts: boolean;
  announceChanges: boolean;
  
  // Tooltip preferences
  showTooltips: boolean;
  tooltipDelay: number;
  richTooltips: boolean;
  
  // Badge preferences
  showBadges: boolean;
  enableBadgeAnimations: boolean;
  maxBadgesPerItem: number;
  
  // Theme preferences
  theme: 'light' | 'dark' | 'auto';
  accentColor: string;
  
  // Behavior preferences
  autoHideOnMobile: boolean;
  rememberLastState: boolean;
  enableGestures: boolean;
  swipeSensitivity: 'low' | 'medium' | 'high';
  
  // Privacy preferences
  trackUsage: boolean;
  shareAnalytics: boolean;
  
  // Version and metadata
  version: string;
  lastUpdated: number;
  userId?: string;
}

// Default preferences
export const DEFAULT_PREFERENCES: NavigationPreferences = {
  defaultMode: 'drawer',
  autoCollapse: true,
  expandedSections: ['main', 'tools'],
  stickyNavigation: true,
  
  enableAnimations: true,
  animationDuration: 'normal',
  enableHapticFeedback: true,
  enableSounds: false,
  
  highContrast: false,
  reduceMotion: false,
  largeText: false,
  enableKeyboardShortcuts: true,
  announceChanges: true,
  
  showTooltips: true,
  tooltipDelay: 500,
  richTooltips: true,
  
  showBadges: true,
  enableBadgeAnimations: true,
  maxBadgesPerItem: 3,
  
  theme: 'auto',
  accentColor: '#FF6B35', // Orange from theme
  
  autoHideOnMobile: true,
  rememberLastState: true,
  enableGestures: true,
  swipeSensitivity: 'medium',
  
  trackUsage: false,
  shareAnalytics: false,
  
  version: '1.0.0',
  lastUpdated: Date.now(),
};

// Storage configuration
const STORAGE_KEY = 'hsq-bridge-nav-preferences';
const STORAGE_VERSION = '1.0.0';

// Preference validation schema
const PREFERENCE_VALIDATORS = {
  defaultMode: (value: any): value is NavigationPreferences['defaultMode'] =>
    ['rail', 'drawer', 'modal'].includes(value),
    
  animationDuration: (value: any): value is NavigationPreferences['animationDuration'] =>
    ['fast', 'normal', 'slow'].includes(value),
    
  theme: (value: any): value is NavigationPreferences['theme'] =>
    ['light', 'dark', 'auto'].includes(value),
    
  swipeSensitivity: (value: any): value is NavigationPreferences['swipeSensitivity'] =>
    ['low', 'medium', 'high'].includes(value),
    
  tooltipDelay: (value: any): boolean =>
    typeof value === 'number' && value >= 0 && value <= 2000,
    
  maxBadgesPerItem: (value: any): boolean =>
    typeof value === 'number' && value >= 1 && value <= 10,
    
  accentColor: (value: any): boolean =>
    typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value),
    
  expandedSections: (value: any): boolean =>
    Array.isArray(value) && value.every(item => typeof item === 'string'),
};

/**
 * Navigation preferences manager class
 */
export class NavigationPreferencesManager {
  private preferences: NavigationPreferences;
  private listeners: Set<(preferences: NavigationPreferences) => void> = new Set();
  private isInitialized = false;

  constructor(userId?: string) {
    this.preferences = { ...DEFAULT_PREFERENCES };
    if (userId) {
      this.preferences.userId = userId;
    }
    this.loadPreferences();
  }

  /**
   * Initialize preferences from localStorage
   */
  private loadPreferences(): void {
    if (typeof window === 'undefined') {
      this.isInitialized = true;
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        this.detectSystemPreferences();
        this.savePreferences();
        this.isInitialized = true;
        return;
      }

      const parsed = JSON.parse(stored);
      
      // Check version compatibility
      if (parsed.version !== STORAGE_VERSION) {
        console.warn('Navigation preferences version mismatch, resetting to defaults');
        this.resetToDefaults();
        this.isInitialized = true;
        return;
      }

      // Validate and merge preferences
      const validatedPreferences = this.validatePreferences(parsed.preferences);
      this.preferences = {
        ...DEFAULT_PREFERENCES,
        ...validatedPreferences,
        version: STORAGE_VERSION,
        lastUpdated: Date.now(),
      };

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to load navigation preferences:', error);
      this.resetToDefaults();
      this.isInitialized = true;
    }
  }

  /**
   * Detect system preferences for defaults
   */
  private detectSystemPreferences(): void {
    if (typeof window === 'undefined') return;

    // Detect color scheme preference
    if (window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.preferences.theme = darkModeQuery.matches ? 'dark' : 'light';

      // Detect reduced motion preference
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.preferences.reduceMotion = reducedMotionQuery.matches;
      this.preferences.enableAnimations = !reducedMotionQuery.matches;

      // Detect high contrast preference
      const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
      this.preferences.highContrast = highContrastQuery.matches;
    }

    // Detect mobile device
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    
    if (isMobile) {
      this.preferences.defaultMode = 'modal';
      this.preferences.enableGestures = true;
      this.preferences.autoHideOnMobile = true;
    }

    // Detect touch support
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.preferences.enableHapticFeedback = hasTouch;
  }

  /**
   * Validate preferences object
   */
  private validatePreferences(preferences: any): Partial<NavigationPreferences> {
    const validated: Partial<NavigationPreferences> = {};

    Object.entries(preferences).forEach(([key, value]) => {
      const validator = PREFERENCE_VALIDATORS[key as keyof typeof PREFERENCE_VALIDATORS];
      
      if (validator && validator(value)) {
        (validated as any)[key] = value;
      } else if (key in DEFAULT_PREFERENCES && typeof value === typeof DEFAULT_PREFERENCES[key as keyof NavigationPreferences]) {
        // Basic type check for non-validated fields
        (validated as any)[key] = value;
      }
    });

    return validated;
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    if (typeof window === 'undefined') return;

    try {
      const toStore = {
        version: STORAGE_VERSION,
        preferences: this.preferences,
        savedAt: Date.now(),
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to save navigation preferences:', error);
    }
  }

  /**
   * Get all preferences
   */
  getPreferences(): NavigationPreferences {
    return { ...this.preferences };
  }

  /**
   * Get specific preference value
   */
  getPreference<K extends keyof NavigationPreferences>(key: K): NavigationPreferences[K] {
    return this.preferences[key];
  }

  /**
   * Update single preference
   */
  setPreference<K extends keyof NavigationPreferences>(
    key: K,
    value: NavigationPreferences[K]
  ): void {
    if (!this.isInitialized) {
      console.warn('Preferences not initialized, skipping update');
      return;
    }

    const validator = PREFERENCE_VALIDATORS[key as keyof typeof PREFERENCE_VALIDATORS];
    if (validator && !validator(value)) {
      console.error(`Invalid value for preference ${key}:`, value);
      return;
    }

    this.preferences[key] = value;
    this.preferences.lastUpdated = Date.now();
    
    this.savePreferences();
    this.notifyListeners();
  }

  /**
   * Update multiple preferences
   */
  setPreferences(updates: Partial<NavigationPreferences>): void {
    if (!this.isInitialized) {
      console.warn('Preferences not initialized, skipping update');
      return;
    }

    const validatedUpdates = this.validatePreferences(updates);
    
    this.preferences = {
      ...this.preferences,
      ...validatedUpdates,
      lastUpdated: Date.now(),
    };
    
    this.savePreferences();
    this.notifyListeners();
  }

  /**
   * Reset to default preferences
   */
  resetToDefaults(): void {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.detectSystemPreferences();
    this.savePreferences();
    this.notifyListeners();
  }

  /**
   * Clear all stored preferences
   */
  clearStorage(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.resetToDefaults();
  }

  /**
   * Export preferences as JSON
   */
  exportPreferences(): string {
    return JSON.stringify(this.preferences, null, 2);
  }

  /**
   * Import preferences from JSON
   */
  importPreferences(json: string): boolean {
    try {
      const imported = JSON.parse(json);
      const validated = this.validatePreferences(imported);
      
      this.setPreferences(validated);
      return true;
    } catch (error) {
      console.error('Failed to import preferences:', error);
      return false;
    }
  }

  /**
   * Add preference change listener
   */
  addListener(listener: (preferences: NavigationPreferences) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of preference changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getPreferences());
      } catch (error) {
        console.error('Error in preference listener:', error);
      }
    });
  }

  /**
   * Get computed values based on preferences
   */
  getComputedValues() {
    return {
      animationDuration: {
        fast: 150,
        normal: 300,
        slow: 500,
      }[this.preferences.animationDuration],
      
      swipeThreshold: {
        low: 70,
        medium: 50,
        high: 30,
      }[this.preferences.swipeSensitivity],
      
      shouldUseAnimations: this.preferences.enableAnimations && !this.preferences.reduceMotion,
      
      shouldShowTooltips: this.preferences.showTooltips,
      
      effectiveTheme: this.preferences.theme === 'auto'
        ? (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : this.preferences.theme,
    };
  }

  /**
   * Check if preferences are loaded
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Global instance for the application
let globalPreferencesManager: NavigationPreferencesManager | null = null;

/**
 * Get or create global preferences manager
 */
export function getPreferencesManager(userId?: string): NavigationPreferencesManager {
  if (!globalPreferencesManager) {
    globalPreferencesManager = new NavigationPreferencesManager(userId);
  } else if (userId && globalPreferencesManager.getPreference('userId') !== userId) {
    // User changed, create new instance
    globalPreferencesManager = new NavigationPreferencesManager(userId);
  }
  
  return globalPreferencesManager;
}

import React from 'react';

/**
 * React hook for navigation preferences
 */
export function useNavigationPreferences(userId?: string) {
  const [preferences, setPreferences] = React.useState<NavigationPreferences>(() => 
    getPreferencesManager(userId).getPreferences()
  );
  
  const manager = React.useMemo(() => getPreferencesManager(userId), [userId]);
  
  React.useEffect(() => {
    const unsubscribe = manager.addListener(setPreferences);
    
    // Sync current state
    setPreferences(manager.getPreferences());
    
    return unsubscribe;
  }, [manager]);

  const updatePreference = React.useCallback(<K extends keyof NavigationPreferences>(
    key: K,
    value: NavigationPreferences[K]
  ) => {
    manager.setPreference(key, value);
  }, [manager]);

  const updatePreferences = React.useCallback((updates: Partial<NavigationPreferences>) => {
    manager.setPreferences(updates);
  }, [manager]);

  const resetPreferences = React.useCallback(() => {
    manager.resetToDefaults();
  }, [manager]);

  const computedValues = React.useMemo(() => 
    manager.getComputedValues(), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preferences] // Using preferences instead of manager to avoid re-computing on manager reference changes
  );

  return {
    preferences,
    updatePreference,
    updatePreferences,
    resetPreferences,
    computedValues,
    manager,
    isReady: manager.isReady(),
  };
}

const navigationPreferencesUtils = {
  NavigationPreferencesManager,
  getPreferencesManager,
  useNavigationPreferences,
  DEFAULT_PREFERENCES,
  STORAGE_KEY,
  STORAGE_VERSION,
};

export default navigationPreferencesUtils;