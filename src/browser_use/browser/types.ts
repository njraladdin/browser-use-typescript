/**
 * Type definitions for the browser module
 */

/**
 * Browser action types
 */
export enum BrowserActionType {
  NAVIGATE = 'navigate',
  CLICK = 'click',
  TYPE = 'type',
  WAIT = 'wait',
  SCREENSHOT = 'screenshot',
  SCROLL = 'scroll',
  HOVER = 'hover'
}

/**
 * Browser action interface
 */
export interface BrowserAction {
  type: BrowserActionType;
  params: Record<string, any>;
  timestamp: number;
}

/**
 * Result of a browser action
 */
export interface BrowserActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: Error;
}

/**
 * Element from DOM history
 */
export interface DOMHistoryElement {
  tag: string;
  id?: string;
  classes: string[];
  text?: string;
  attributes?: Record<string, string>;
  rect?: DOMRect;
  visible?: boolean;
  enabled?: boolean;
}

/**
 * Browser state history
 */
export interface BrowserStateHistory {
  url?: string;
  title?: string;
  tabs?: Array<{ url: string; title: string }>;
  interacted_element?: (DOMHistoryElement | null)[];
  screenshot?: string;
}

/**
 * Browser state representation
 */
export interface BrowserState {
  url?: string;
  title?: string;
  tabs?: Array<{ url: string; title: string }>;
  selector_map: Record<number, any>; // Maps selectors to DOM elements
  screenshot?: string;
} 