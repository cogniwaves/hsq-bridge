/**
 * Jest Global Type Declarations
 * Type definitions for global test utilities and mock factories
 */

import type { NavigationConfig } from '../../components/navigation/types';

// Define Touch interface for environments where it might not exist
interface Touch {
  identifier: number;
  target: EventTarget;
  screenX: number;
  screenY: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  radiusX: number;
  radiusY: number;
  rotationAngle: number;
  force: number;
}

// Define TouchEvent for environments where it might not exist
interface TouchEventInit extends EventInit {
  touches?: Touch[];
  targetTouches?: Touch[];
  changedTouches?: Touch[];
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}

// Define PointerEvent for environments where it might not exist
interface PointerEventInit extends MouseEventInit {
  pointerId?: number;
  width?: number;
  height?: number;
  pressure?: number;
  tangentialPressure?: number;
  tiltX?: number;
  tiltY?: number;
  twist?: number;
  pointerType?: string;
  isPrimary?: boolean;
}

// Define mock factories type
interface MockFactories {
  createMockResponse: (data?: any) => Response;
  createMockTouchEvent: (type: string, touches?: Partial<Touch>[]) => TouchEvent;
  createMockPointerEvent: (type: string, options?: PointerEventInit) => PointerEvent;
  createMockIntersectionObserverEntry: (options?: Partial<IntersectionObserverEntry>) => IntersectionObserverEntry;
  createMockResizeObserverEntry: (options?: Partial<ResizeObserverEntry>) => ResizeObserverEntry;
}

// Define test utilities
interface TestUtils {
  createMockUser: (overrides?: Partial<{
    userId: string;
    email: string;
    name: string;
    accessToken: string;
    isEmailConfirmed: boolean;
    hasPassword: boolean;
    mode: string;
    tenantId: string;
    roles?: string[];
    permissions?: string[];
  }>) => {
    userId: string;
    email: string;
    name: string;
    accessToken: string;
    isEmailConfirmed: boolean;
    hasPassword: boolean;
    mode: string;
    tenantId: string;
    roles?: string[];
    permissions?: string[];
  };
  
  createMockNavigationConfig: (overrides?: Partial<NavigationConfig>) => NavigationConfig;
  
  mockViewport: (width: number, height: number) => void;
  
  waitForAnimation: () => Promise<void>;
  
  triggerCustomEvent: (element: Element, eventType: string, detail?: any) => void;
}

// Extend CSSStyleDeclaration for IE-specific properties
interface CSSStyleDeclaration {
  // IE-specific transform properties
  msTransform?: string;
  webkitTransform?: string;
  mozTransform?: string;
  oTransform?: string;
  
  // IE-specific filter properties
  msFilter?: string;
  filter?: string;
  
  // IE-specific flexbox properties
  msFlexDirection?: string;
  msFlexWrap?: string;
  msFlexFlow?: string;
  msFlexAlign?: string;
  msFlexItemAlign?: string;
  msFlexLinePack?: string;
  msFlexOrder?: string;
  msFlexPositive?: string;
  msFlexNegative?: string;
  msFlexPreferredSize?: string;
  
  // IE-specific grid properties
  msGridColumns?: string;
  msGridRows?: string;
  msGridColumn?: string;
  msGridRow?: string;
  msGridColumnAlign?: string;
  msGridRowAlign?: string;
  msGridColumnSpan?: string;
  msGridRowSpan?: string;
  
  // Other vendor prefixes
  webkitAppearance?: string;
  mozAppearance?: string;
  webkitUserSelect?: string;
  mozUserSelect?: string;
  msUserSelect?: string;
}

// Global declarations
declare global {
  var testUtils: TestUtils;
  var mockFactories: MockFactories;
  
  // Touch event classes for environments where they might not exist
  var TouchEvent: {
    new(type: string, eventInit?: TouchEventInit): TouchEvent;
    prototype: TouchEvent;
  };
  
  interface TouchEvent extends UIEvent {
    readonly touches: TouchList;
    readonly targetTouches: TouchList;
    readonly changedTouches: TouchList;
    readonly altKey: boolean;
    readonly metaKey: boolean;
    readonly ctrlKey: boolean;
    readonly shiftKey: boolean;
  }
  
  interface TouchList {
    readonly length: number;
    item(index: number): Touch | null;
    [index: number]: Touch;
  }
  
  // Pointer event class
  var PointerEvent: {
    new(type: string, eventInit?: PointerEventInit): PointerEvent;
    prototype: PointerEvent;
  };
  
  interface PointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly width: number;
    readonly height: number;
    readonly pressure: number;
    readonly tangentialPressure: number;
    readonly tiltX: number;
    readonly tiltY: number;
    readonly twist: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
  }
  
  // ResizeObserver for environments where it might not exist
  interface ResizeObserverEntry {
    readonly target: Element;
    readonly contentRect: DOMRectReadOnly;
    readonly borderBoxSize: ReadonlyArray<ResizeObserverSize>;
    readonly contentBoxSize: ReadonlyArray<ResizeObserverSize>;
    readonly devicePixelContentBoxSize?: ReadonlyArray<ResizeObserverSize>;
  }
  
  interface ResizeObserverSize {
    readonly inlineSize: number;
    readonly blockSize: number;
  }
  
  // IntersectionObserver enhancements
  interface IntersectionObserverEntry {
    readonly boundingClientRect: DOMRectReadOnly;
    readonly intersectionRatio: number;
    readonly intersectionRect: DOMRectReadOnly;
    readonly isIntersecting: boolean;
    readonly rootBounds: DOMRectReadOnly | null;
    readonly target: Element;
    readonly time: DOMHighResTimeStamp;
  }
  
  // Window enhancements for test environment
  interface Window {
    CSS: {
      supports: (property: string, value?: string) => boolean;
    };
    matchMedia: (query: string) => MediaQueryList;
  }
  
  // Navigator enhancements
  interface Navigator {
    clipboard: {
      writeText: (text: string) => Promise<void>;
      readText: () => Promise<string>;
    };
  }
  
  // Element enhancements
  interface Element {
    scrollIntoView: (options?: ScrollIntoViewOptions | boolean) => void;
    scrollTo: (options?: ScrollToOptions) => void;
  }
  
  interface HTMLElement {
    focus: (options?: FocusOptions) => void;
    blur: () => void;
  }
  
  // Performance API types
  interface PerformanceEntry {
    name: string;
    entryType: string;
    startTime: DOMHighResTimeStamp;
    duration: DOMHighResTimeStamp;
  }
  
  interface PerformanceObserverEntryList {
    getEntries(): PerformanceEntry[];
    getEntriesByType(type: string): PerformanceEntry[];
    getEntriesByName(name: string, type?: string): PerformanceEntry[];
  }
  
  interface PerformanceObserver {
    observe(options: PerformanceObserverInit): void;
    disconnect(): void;
    takeRecords(): PerformanceEntry[];
  }
  
  interface PerformanceObserverInit {
    entryTypes?: string[];
    type?: string;
    buffered?: boolean;
  }
  
  var PerformanceObserver: {
    new(callback: (entries: PerformanceObserverEntryList, observer: PerformanceObserver) => void): PerformanceObserver;
    prototype: PerformanceObserver;
    supportedEntryTypes: readonly string[];
  };
}

// Export types for use in test files
export type MockUser = ReturnType<TestUtils['createMockUser']>;
export type MockNavigationConfig = ReturnType<TestUtils['createMockNavigationConfig']>;

export {};