/**
 * Navigation Modal Component
 * Mobile navigation overlay with touch-friendly targets
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigationTheme } from '../../design-system/themes/themeProvider';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { NavigationModalProps, NavigationSection } from './types';
import NavigationItem from './NavigationItem';
import NavigationProfile from './NavigationProfile';
import { XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

export function NavigationModal({
  className = '',
  config,
  isOpen,
  onClose,
  activeItemId,
  onItemClick,
  a11yLabel = 'Main navigation',
}: NavigationModalProps) {
  const { user } = useUserfrontAuth();
  const { surfaces, elevation, layout, spacing, typography, zIndex, motion, a11y, mode: themeMode } = useNavigationTheme();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Track expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    config.sections.forEach(section => {
      if (section.collapsible && !section.defaultCollapsed) {
        initial.add(section.id);
      }
    });
    return initial;
  });

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Mount portal container
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle focus management
  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Focus first focusable element in modal
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        firstFocusable?.focus();
      }, 100);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Restore focus
      previousFocusRef.current?.focus();
      
      // Restore body scroll
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle swipe gestures for mobile
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      isDragging = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      const diff = currentX - startX;
      
      // Only allow swiping left (to close)
      if (diff < 0 && modalRef.current) {
        modalRef.current.style.transform = `translateX(${Math.max(diff, -100)}px)`;
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging || !modalRef.current) return;
      
      const diff = currentX - startX;
      
      // If swiped more than 50px left, close the modal
      if (diff < -50) {
        onClose();
      } else {
        // Reset position
        modalRef.current.style.transform = 'translateX(0)';
      }
      
      isDragging = false;
    };

    const modal = modalRef.current;
    modal.addEventListener('touchstart', handleTouchStart);
    modal.addEventListener('touchmove', handleTouchMove);
    modal.addEventListener('touchend', handleTouchEnd);

    return () => {
      modal.removeEventListener('touchstart', handleTouchStart);
      modal.removeEventListener('touchmove', handleTouchMove);
      modal.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onClose]);

  // Filter visible sections
  const visibleSections = config.sections.filter(section => {
    if (typeof section.visible === 'function') {
      return section.visible(user);
    }
    return section.visible !== false;
  });

  // Check if item is visible
  const isItemVisible = (item: any) => {
    if (typeof item.visible === 'function') {
      return item.visible(user);
    }
    if (item.visible === false) return false;
    if (item.requiredPermissions?.length > 0) {
      const userPermissions = user?.permissions || [];
      const isAdmin = user?.role === 'admin';
      return isAdmin || item.requiredPermissions.some((p: string) => userPermissions.includes(p));
    }
    return true;
  };

  // Handle item click - close modal after navigation
  const handleItemClick = (item: any) => {
    if (onItemClick) {
      onItemClick(item);
    }
    // Close modal after clicking a navigation item (unless it has children)
    if (!item.children && item.href) {
      onClose();
    }
  };

  // Render section header
  const renderSectionHeader = (section: NavigationSection) => {
    if (!section.title) return null;

    const isExpanded = expandedSections.has(section.id);

    if (section.collapsible) {
      return (
        <button
          className="nav-modal-section-header"
          onClick={() => toggleSection(section.id)}
          aria-expanded={isExpanded}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: `${spacing.section.headerMarginBottom} ${spacing.section.headerPaddingHorizontal}`,
            marginTop: spacing.section.headerMarginTop,
            marginBottom: spacing.section.headerMarginBottom,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: surfaces[themeMode].modal.border,
            ...typography.sectionHeader,
            minHeight: '48px', // Touch-friendly size
          }}
        >
          <span>{section.title}</span>
          <ChevronDownIcon
            className="w-4 h-4"
            style={{
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 200ms ease',
            }}
          />
        </button>
      );
    }

    return (
      <div
        className="nav-modal-section-header"
        style={{
          padding: `${spacing.section.headerMarginBottom} ${spacing.section.headerPaddingHorizontal}`,
          marginTop: spacing.section.headerMarginTop,
          marginBottom: spacing.section.headerMarginBottom,
          color: surfaces[themeMode].modal.border,
          ...typography.sectionHeader,
        }}
      >
        {section.title}
      </div>
    );
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="nav-modal-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: surfaces[themeMode].modal.backdrop,
          zIndex: zIndex.modalBackdrop,
          opacity: isOpen ? 1 : 0,
          transition: `opacity ${motion.modalTransition.enter.duration} ${motion.modalTransition.enter.easing}`,
        }}
      />

      {/* Modal drawer */}
      <div
        ref={modalRef}
        className={`nav-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={a11yLabel}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: layout.modal.width,
          maxWidth: layout.modal.maxWidth,
          backgroundColor: surfaces[themeMode].modal.background,
          boxShadow: elevation[themeMode].modal.boxShadow,
          display: 'flex',
          flexDirection: 'column',
          zIndex: zIndex.modal,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: `transform ${motion.modalTransition.enter.duration} ${motion.modalTransition.enter.easing}`,
        }}
      >
        {/* Header */}
        <div
          className="nav-modal-header"
          style={{
            height: layout.modal.headerHeight,
            padding: spacing.container.modal.padding,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${surfaces[themeMode].modal.border}`,
          }}
        >
          {/* Branding */}
          {config.branding && (
            <div className="nav-modal-branding" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {config.branding.logo && (
                <div style={{ width: '32px', height: '32px' }}>
                  {typeof config.branding.logo === 'string' ? (
                    <span style={{ fontSize: '24px' }}>{config.branding.logo}</span>
                  ) : (
                    config.branding.logo
                  )}
                </div>
              )}
              <div>
                {config.branding.title && (
                  <div style={{ fontWeight: 600, fontSize: '16px' }}>
                    {config.branding.title}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="nav-modal-close"
            aria-label={a11y.srOnly.closeModal}
            style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              color: surfaces[themeMode].modal.border,
            }}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation items */}
        <div
          className="nav-modal-items"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: spacing.container.modal.padding,
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          }}
        >
          {visibleSections.map((section, sectionIndex) => (
            <div key={section.id} className="nav-modal-section">
              {renderSectionHeader(section)}

              {(!section.collapsible || expandedSections.has(section.id)) && (
                <div className="nav-modal-section-items">
                  {section.items
                    .filter(isItemVisible)
                    .map((item) => (
                      <div key={item.id}>
                        <NavigationItem
                          item={item}
                          mode="modal"
                          isActive={activeItemId === item.id}
                          showLabel={true}
                          onClick={handleItemClick}
                        />
                        
                        {item.children && activeItemId === item.id && (
                          <div style={{ marginLeft: spacing.item.horizontalPadding }}>
                            {item.children
                              .filter(isItemVisible)
                              .map((child) => (
                                <NavigationItem
                                  key={child.id}
                                  item={child}
                                  mode="modal"
                                  isActive={activeItemId === child.id}
                                  level={1}
                                  showLabel={true}
                                  onClick={handleItemClick}
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {section.divider && sectionIndex < visibleSections.length - 1 && (
                <div
                  style={{
                    height: '1px',
                    backgroundColor: surfaces[themeMode].modal.border,
                    margin: `${spacing.section.dividerMargin} 0`,
                    opacity: 0.2,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer items */}
        {config.footer && (
          <div
            className="nav-modal-footer"
            style={{
              padding: spacing.container.modal.padding,
              paddingTop: 0,
            }}
          >
            {config.footer.items
              .filter(isItemVisible)
              .map((item) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  mode="modal"
                  isActive={activeItemId === item.id}
                  showLabel={true}
                  onClick={handleItemClick}
                />
              ))}
          </div>
        )}

        {/* User profile */}
        <NavigationProfile
          mode="modal"
          showAvatar={true}
          showEmail={true}
          showRole={false}
        />
      </div>
    </>
  );

  // Use React Portal to render modal at document root
  return createPortal(modalContent, document.body);
}

export default NavigationModal;