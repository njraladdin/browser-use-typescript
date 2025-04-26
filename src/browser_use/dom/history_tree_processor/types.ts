/**
 * Type definitions for the history tree processor module
 */

import { CoordinateSet, ViewportInfo } from '../types';

/**
 * Hashed DOM element to be used as a unique identifier
 */
export interface HashedDomElement {
  branchPathHash: string;
  attributesHash: string;
  xpathHash: string;
}

/**
 * DOM History Element representing a DOM element in history
 */
export interface DOMHistoryElement {
  tagName: string;
  xpath: string;
  highlightIndex: number | null;
  entireParentBranchPath: string[];
  attributes: Record<string, string>;
  shadowRoot: boolean;
  cssSelector?: string;
  pageCoordinates?: CoordinateSet;
  viewportCoordinates?: CoordinateSet;
  viewportInfo?: ViewportInfo;
} 