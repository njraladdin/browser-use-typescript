/**
 * Type definitions for the controller module
 */

/**
 * DOM Element representation
 */
export interface DOMElement {
  tag: string;
  id?: string;
  classes: string[];
  text?: string;
  children?: DOMElement[];
  attributes?: Record<string, string>;
  rect?: DOMRect;
  visible?: boolean;
  enabled?: boolean;
}

/**
 * DOM Rectangle representation
 */
export interface DOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * DOM action types
 */
export enum DOMActionType {
  CLICK = 'click',
  TYPE = 'type',
  SELECT = 'select',
  HOVER = 'hover',
  EXTRACT = 'extract'
}

/**
 * DOM action
 */
export interface DOMAction {
  type: DOMActionType;
  selector: string;
  value?: string;
  timeout?: number;
} 