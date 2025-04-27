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
 * DOM Element representation
 */
export interface DOMElement {
  tag: string;
  text: string;
  attributes: Record<string, string>;
  index: number;
}

/**
 * Browser state representation
 */
export interface BrowserState {
  url: string;
  title: string;
  tabs: Array<{ id: number; url: string; title: string; is_active: boolean }>;
  selector_map: Record<string, DOMElement>;
  screenshot?: string;
  selected_text?: string | null;
  last_navigation_error?: string;
}

/**
 * Extended BrowserState with clicked element
 */
export interface BrowserStateWithClickedElement extends BrowserState {
  last_clicked_element?: DOMElement | null;
}

/**
 * Result of an agent action
 */
export interface ActionResult {
  is_done?: boolean;
  success?: boolean;
  extracted_content?: string;
  error?: string;
  include_in_memory?: boolean;
  clicked_element?: DOMElement;
  last_clicked_element?: DOMElement;  // For backward compatibility
} 