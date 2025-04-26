/**
 * Type definitions for the DOM module
 */

import { DOMElement } from '../controller/types';

/**
 * Element finder function
 */
export type ElementFinder = (element: DOMElement) => boolean;

/**
 * DOM selector strategies
 */
export enum DOMSelectorStrategy {
  CSS = 'css',
  XPATH = 'xpath',
  TEXT = 'text',
  ID = 'id',
  CLASS = 'class'
}

/**
 * DOM selector
 */
export interface DOMSelector {
  strategy: DOMSelectorStrategy;
  value: string;
  index?: number;
}

/**
 * DOM tree root element with timestamp
 */
export interface DOMTree {
  root: DOMElementNode;
  timestamp: number;
}

/**
 * Base class for DOM nodes
 */
export interface DOMBaseNode {
  isVisible: boolean;
  parent: DOMElementNode | null;
}

/**
 * Text node in the DOM
 */
export interface DOMTextNode extends DOMBaseNode {
  type: 'TEXT_NODE';
  text: string;
}

/**
 * ViewportInfo for storing size information
 */
export interface ViewportInfo {
  width: number;
  height: number;
}

/**
 * Coordinate set for element position
 */
export interface CoordinateSet {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

/**
 * Element node in the DOM
 */
export interface DOMElementNode extends DOMBaseNode {
  tagName: string;
  xpath: string;
  attributes: Record<string, string>;
  children: (DOMElementNode | DOMTextNode)[];
  isInteractive?: boolean;
  isTopElement?: boolean;
  isInViewport?: boolean;
  shadowRoot?: boolean;
  highlightIndex?: number;
  viewportCoordinates?: CoordinateSet;
  pageCoordinates?: CoordinateSet;
  viewportInfo?: ViewportInfo;
  isNew?: boolean;
}

/**
 * Map of selectors to DOM elements
 */
export type SelectorMap = Record<number, DOMElementNode>;

/**
 * DOM state containing the element tree and selector map
 */
export interface DOMState {
  elementTree: DOMElementNode;
  selectorMap: SelectorMap;
}

/**
 * Options for building the DOM tree
 */
export interface BuildDOMTreeOptions {
  highlightElements?: boolean;
  focusElement?: number;
  viewportExpansion?: number;
  debugMode?: boolean;
}

/**
 * Performance metrics object for DOM tree building
 */
export interface PerfMetrics {
  buildDomTreeCalls: number;
  timings: Record<string, number>;
  cacheMetrics: {
    boundingRectCacheHits: number;
    boundingRectCacheMisses: number;
    computedStyleCacheHits: number;
    computedStyleCacheMisses: number;
    getBoundingClientRectTime: number;
    getComputedStyleTime: number;
    boundingRectHitRate: number;
    computedStyleHitRate: number;
    overallHitRate: number;
  };
  nodeMetrics: {
    totalNodes: number;
    processedNodes: number;
    skippedNodes: number;
  };
  buildDomTreeBreakdown: {
    totalTime: number;
    totalSelfTime: number;
    buildDomTreeCalls: number;
    domOperations: Record<string, number>;
    domOperationCounts: Record<string, number>;
  };
} 