/**
 * Mobile Navigation Hook
 * Handles mobile-specific navigation behaviors and gestures
 */

import { useEffect, useState, useCallback, useRef } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export function useMobileNavigation() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  
  // Touch handling refs
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  // Check device type and orientation
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setViewportSize({ width, height });
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      setIsLandscape(width > height);
      
      // Auto-close navigation on desktop
      if (width >= 1024 && navOpen) {
        setNavOpen(false);
      }
    };

    // Initial check
    checkDevice();

    // Listen for resize
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, [navOpen]);

  // Toggle navigation
  const toggleNav = useCallback(() => {
    setNavOpen(prev => !prev);
  }, []);

  // Open navigation
  const openNav = useCallback(() => {
    setNavOpen(true);
  }, []);

  // Close navigation
  const closeNav = useCallback(() => {
    setNavOpen(false);
  }, []);

  // Handle swipe gestures
  const handleSwipe = useCallback((handlers: SwipeHandlers) => {
    const minSwipeDistance = 50; // Minimum distance for a swipe
    
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = touchEndY.current - touchStartY.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine if it's a horizontal or vertical swipe
    if (absX > absY && absX > minSwipeDistance) {
      // Horizontal swipe
      if (deltaX > 0) {
        // Swipe right
        handlers.onSwipeRight?.();
      } else {
        // Swipe left
        handlers.onSwipeLeft?.();
      }
    } else if (absY > absX && absY > minSwipeDistance) {
      // Vertical swipe
      if (deltaY > 0) {
        // Swipe down
        handlers.onSwipeDown?.();
      } else {
        // Swipe up
        handlers.onSwipeUp?.();
      }
    }
  }, []);

  // Set up swipe gesture handlers
  const setupSwipeHandlers = useCallback((element: HTMLElement | null, handlers: SwipeHandlers) => {
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Optionally prevent default to avoid scrolling during swipe
      // e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX.current = e.changedTouches[0].clientX;
      touchEndY.current = e.changedTouches[0].clientY;
      handleSwipe(handlers);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Return cleanup function
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleSwipe]);

  // Handle back button/gesture for mobile browsers
  useEffect(() => {
    if (!isMobile) return;

    const handlePopState = () => {
      if (navOpen) {
        closeNav();
        // Prevent default back navigation
        window.history.pushState(null, '', window.location.href);
      }
    };

    // Push a state when nav opens
    if (navOpen) {
      window.history.pushState({ navOpen: true }, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isMobile, navOpen, closeNav]);

  // Lock body scroll when navigation is open on mobile
  useEffect(() => {
    if (!isMobile || !navOpen) {
      document.body.style.overflow = '';
      return;
    }

    // Save current scroll position
    const scrollY = window.scrollY;
    
    // Lock body scroll
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      // Restore body scroll
      const savedScrollY = parseInt(document.body.style.top || '0', 10) * -1;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, savedScrollY);
    };
  }, [isMobile, navOpen]);

  // Detect if device supports hover (non-touch device)
  const [supportsHover, setSupportsHover] = useState(true);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    setSupportsHover(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setSupportsHover(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Get optimal navigation mode based on device
  const getOptimalNavMode = useCallback((): 'rail' | 'drawer' | 'modal' => {
    if (isMobile) return 'modal';
    if (isTablet) return isLandscape ? 'rail' : 'modal';
    return 'drawer'; // Desktop
  }, [isMobile, isTablet, isLandscape]);

  // Handle viewport changes for iOS Safari
  useEffect(() => {
    if (!isMobile) return;

    const handleViewportChange = () => {
      // Update viewport height for iOS Safari address bar
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isMobile]);

  return {
    // Device detection
    isMobile,
    isTablet,
    isLandscape,
    supportsHover,
    viewportSize,
    
    // Navigation state
    navOpen,
    toggleNav,
    openNav,
    closeNav,
    
    // Utilities
    getOptimalNavMode,
    setupSwipeHandlers,
    
    // Constants
    breakpoints: {
      mobile: 768,
      tablet: 1024,
      desktop: 1280,
    },
  };
}

export default useMobileNavigation;