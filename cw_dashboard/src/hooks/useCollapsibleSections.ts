/**
 * Collapsible Sections Hook
 * Advanced navigation feature for managing section expand/collapse state
 * with persistence, animations, and keyboard support
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavigationSection } from '../components/navigation/types';

// LocalStorage keys
const STORAGE_KEY = 'hsq-bridge-nav-sections';
const STORAGE_VERSION = '1.0';

// Section state interface
export interface CollapsibleSectionState {
  [sectionId: string]: {
    isExpanded: boolean;
    lastToggled: number;
    userPreference: boolean; // User explicitly set this state
  };
}

// Hook options
export interface UseCollapsibleSectionsOptions {
  /** Sections configuration */
  sections: NavigationSection[];
  /** Current navigation mode (affects auto-collapse behavior) */
  navigationMode?: 'rail' | 'drawer' | 'modal';
  /** Enable auto-collapse when switching to rail mode */
  autoCollapseInRail?: boolean;
  /** Enable state persistence in localStorage */
  persistState?: boolean;
  /** Animation duration in milliseconds */
  animationDuration?: number;
}

// Hook return interface
export interface UseCollapsibleSectionsReturn {
  /** Current expanded state of all sections */
  expandedSections: Set<string>;
  /** Raw section states with metadata */
  sectionStates: CollapsibleSectionState;
  /** Check if a section is expanded */
  isSectionExpanded: (sectionId: string) => boolean;
  /** Toggle a section's expanded state */
  toggleSection: (sectionId: string) => void;
  /** Expand a specific section */
  expandSection: (sectionId: string) => void;
  /** Collapse a specific section */
  collapseSection: (sectionId: string) => void;
  /** Expand all collapsible sections */
  expandAll: () => void;
  /** Collapse all collapsible sections */
  collapseAll: () => void;
  /** Reset to default states */
  resetToDefaults: () => void;
  /** Get section animation props */
  getSectionAnimationProps: (sectionId: string) => {
    'data-expanded': boolean;
    'data-animating': boolean;
    style: React.CSSProperties;
  };
}

/**
 * Load persisted section states from localStorage
 */
function loadPersistedStates(): CollapsibleSectionState {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    
    const parsed = JSON.parse(stored);
    if (parsed.version !== STORAGE_VERSION) {
      // Version mismatch, clear old data
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    
    return parsed.states || {};
  } catch (error) {
    console.warn('Failed to load navigation section states:', error);
    return {};
  }
}

/**
 * Save section states to localStorage
 */
function savePersistedStates(states: CollapsibleSectionState): void {
  if (typeof window === 'undefined') return;
  
  try {
    const toStore = {
      version: STORAGE_VERSION,
      states,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.warn('Failed to save navigation section states:', error);
  }
}

/**
 * Generate default section states from configuration
 */
function getDefaultSectionStates(sections: NavigationSection[]): CollapsibleSectionState {
  const states: CollapsibleSectionState = {};
  
  sections.forEach(section => {
    if (section.collapsible !== false) {
      states[section.id] = {
        isExpanded: section.defaultCollapsed !== true,
        lastToggled: 0,
        userPreference: false,
      };
    }
  });
  
  return states;
}

/**
 * Advanced collapsible sections management hook
 */
export function useCollapsibleSections({
  sections,
  navigationMode = 'drawer',
  autoCollapseInRail = true,
  persistState = true,
  animationDuration = 300,
}: UseCollapsibleSectionsOptions): UseCollapsibleSectionsReturn {
  // Initialize section states
  const [sectionStates, setSectionStates] = useState<CollapsibleSectionState>(() => {
    const defaultStates = getDefaultSectionStates(sections);
    
    if (!persistState) {
      return defaultStates;
    }
    
    const persistedStates = loadPersistedStates();
    
    // Merge persisted states with defaults (in case new sections were added)
    const mergedStates = { ...defaultStates };
    Object.keys(persistedStates).forEach(sectionId => {
      if (mergedStates[sectionId]) {
        mergedStates[sectionId] = {
          ...mergedStates[sectionId],
          ...persistedStates[sectionId],
        };
      }
    });
    
    return mergedStates;
  });

  // Track animating sections
  const [animatingSections, setAnimatingSections] = useState<Set<string>>(new Set());

  // Auto-collapse in rail mode
  useEffect(() => {
    if (autoCollapseInRail && navigationMode === 'rail') {
      setSectionStates(prevStates => {
        const newStates = { ...prevStates };
        let hasChanges = false;
        
        Object.keys(newStates).forEach(sectionId => {
          const section = sections.find(s => s.id === sectionId);
          if (section && section.collapsible !== false && newStates[sectionId].isExpanded) {
            newStates[sectionId] = {
              ...newStates[sectionId],
              isExpanded: false,
              lastToggled: Date.now(),
              // Don't mark as user preference since this is auto-collapse
            };
            hasChanges = true;
          }
        });
        
        if (hasChanges && persistState) {
          savePersistedStates(newStates);
        }
        
        return hasChanges ? newStates : prevStates;
      });
    }
  }, [navigationMode, autoCollapseInRail, sections, persistState]);

  // Persist states when they change
  useEffect(() => {
    if (persistState) {
      savePersistedStates(sectionStates);
    }
  }, [sectionStates, persistState]);

  // Compute expanded sections set
  const expandedSections = useMemo(() => {
    const expanded = new Set<string>();
    Object.entries(sectionStates).forEach(([sectionId, state]) => {
      if (state.isExpanded) {
        expanded.add(sectionId);
      }
    });
    return expanded;
  }, [sectionStates]);

  // Check if a section is expanded
  const isSectionExpanded = useCallback((sectionId: string): boolean => {
    return sectionStates[sectionId]?.isExpanded ?? false;
  }, [sectionStates]);

  // Toggle section with animation tracking
  const toggleSection = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section || section.collapsible === false) return;

    // Mark as animating
    setAnimatingSections(prev => new Set(prev).add(sectionId));
    
    // Clear animation state after duration
    setTimeout(() => {
      setAnimatingSections(prev => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
    }, animationDuration);

    setSectionStates(prevStates => ({
      ...prevStates,
      [sectionId]: {
        ...prevStates[sectionId],
        isExpanded: !prevStates[sectionId]?.isExpanded,
        lastToggled: Date.now(),
        userPreference: true,
      },
    }));
  }, [sections, animationDuration]);

  // Expand specific section
  const expandSection = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section || section.collapsible === false) return;

    if (!sectionStates[sectionId]?.isExpanded) {
      setAnimatingSections(prev => new Set(prev).add(sectionId));
      
      setTimeout(() => {
        setAnimatingSections(prev => {
          const next = new Set(prev);
          next.delete(sectionId);
          return next;
        });
      }, animationDuration);

      setSectionStates(prevStates => ({
        ...prevStates,
        [sectionId]: {
          ...prevStates[sectionId],
          isExpanded: true,
          lastToggled: Date.now(),
          userPreference: true,
        },
      }));
    }
  }, [sections, sectionStates, animationDuration]);

  // Collapse specific section
  const collapseSection = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section || section.collapsible === false) return;

    if (sectionStates[sectionId]?.isExpanded) {
      setAnimatingSections(prev => new Set(prev).add(sectionId));
      
      setTimeout(() => {
        setAnimatingSections(prev => {
          const next = new Set(prev);
          next.delete(sectionId);
          return next;
        });
      }, animationDuration);

      setSectionStates(prevStates => ({
        ...prevStates,
        [sectionId]: {
          ...prevStates[sectionId],
          isExpanded: false,
          lastToggled: Date.now(),
          userPreference: true,
        },
      }));
    }
  }, [sections, sectionStates, animationDuration]);

  // Expand all sections
  const expandAll = useCallback(() => {
    const collapsibleSections = sections.filter(s => s.collapsible !== false);
    if (collapsibleSections.length === 0) return;

    // Mark all as animating
    const sectionIds = new Set(collapsibleSections.map(s => s.id));
    setAnimatingSections(prev => new Set([...prev, ...sectionIds]));
    
    setTimeout(() => {
      setAnimatingSections(prev => {
        const next = new Set(prev);
        sectionIds.forEach(id => next.delete(id));
        return next;
      });
    }, animationDuration);

    setSectionStates(prevStates => {
      const newStates = { ...prevStates };
      collapsibleSections.forEach(section => {
        newStates[section.id] = {
          ...newStates[section.id],
          isExpanded: true,
          lastToggled: Date.now(),
          userPreference: true,
        };
      });
      return newStates;
    });
  }, [sections, animationDuration]);

  // Collapse all sections
  const collapseAll = useCallback(() => {
    const collapsibleSections = sections.filter(s => s.collapsible !== false);
    if (collapsibleSections.length === 0) return;

    // Mark all as animating
    const sectionIds = new Set(collapsibleSections.map(s => s.id));
    setAnimatingSections(prev => new Set([...prev, ...sectionIds]));
    
    setTimeout(() => {
      setAnimatingSections(prev => {
        const next = new Set(prev);
        sectionIds.forEach(id => next.delete(id));
        return next;
      });
    }, animationDuration);

    setSectionStates(prevStates => {
      const newStates = { ...prevStates };
      collapsibleSections.forEach(section => {
        newStates[section.id] = {
          ...newStates[section.id],
          isExpanded: false,
          lastToggled: Date.now(),
          userPreference: true,
        };
      });
      return newStates;
    });
  }, [sections, animationDuration]);

  // Reset to default states
  const resetToDefaults = useCallback(() => {
    const defaultStates = getDefaultSectionStates(sections);
    setSectionStates(defaultStates);
    
    if (persistState) {
      // Clear persisted states
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [sections, persistState]);

  // Get animation props for a section
  const getSectionAnimationProps = useCallback((sectionId: string) => {
    const isExpanded = isSectionExpanded(sectionId);
    const isAnimating = animatingSections.has(sectionId);
    
    return {
      'data-expanded': isExpanded,
      'data-animating': isAnimating,
      style: {
        '--section-animation-duration': `${animationDuration}ms`,
        '--section-animation-easing': 'cubic-bezier(0.4, 0.0, 0.2, 1)', // emphasized easing
      } as React.CSSProperties,
    };
  }, [isSectionExpanded, animatingSections, animationDuration]);

  return {
    expandedSections,
    sectionStates,
    isSectionExpanded,
    toggleSection,
    expandSection,
    collapseSection,
    expandAll,
    collapseAll,
    resetToDefaults,
    getSectionAnimationProps,
  };
}

export default useCollapsibleSections;