/**
 * Clickable Element Processor service for browser-use-typescript
 * This module provides utilities for processing clickable elements in the DOM
 */

import { createHash } from 'crypto';
import { DOMElementNode } from '../types';

/**
 * Processor for handling clickable elements in the DOM tree
 */
export class ClickableElementProcessor {
  /**
   * Get hashes of all clickable elements in the DOM tree
   * @param domElement The root DOM element
   * @returns A set of hashes for all clickable elements
   */
  static getClickableElementsHashes(domElement: DOMElementNode): Set<string> {
    const clickableElements = this.getClickableElements(domElement);
    return new Set(clickableElements.map(element => this.hashDomElement(element)));
  }
  
  /**
   * Get all clickable elements in the DOM tree
   * @param domElement The root DOM element
   * @returns A list of all clickable elements
   */
  static getClickableElements(domElement: DOMElementNode): DOMElementNode[] {
    const clickableElements: DOMElementNode[] = [];
    
    for (const child of domElement.children) {
      // Skip text nodes
      if ('type' in child && child.type === 'TEXT_NODE') {
        continue;
      }
      
      const elementNode = child as DOMElementNode;
      
      // Add element if it has a highlight index
      if (elementNode.highlightIndex !== undefined && elementNode.highlightIndex !== null) {
        clickableElements.push(elementNode);
      }
      
      // Recursively add clickable elements from children
      clickableElements.push(...this.getClickableElements(elementNode));
    }
    
    return clickableElements;
  }
  
  /**
   * Generate a hash for a DOM element
   * @param domElement The DOM element to hash
   * @returns A hash string representing the element
   */
  static hashDomElement(domElement: DOMElementNode): string {
    const parentBranchPath = this._getParentBranchPath(domElement);
    const branchPathHash = this._parentBranchPathHash(parentBranchPath);
    const attributesHash = this._attributesHash(domElement.attributes);
    const xpathHash = this._xpathHash(domElement.xpath);
    
    return this._hashString(`${branchPathHash}-${attributesHash}-${xpathHash}`);
  }
  
  /**
   * Get the path of parent element tag names
   * @param domElement The DOM element
   * @returns An array of parent tag names
   */
  private static _getParentBranchPath(domElement: DOMElementNode): string[] {
    const parents: DOMElementNode[] = [];
    let currentElement: DOMElementNode | null = domElement;
    
    while (currentElement?.parent !== null && currentElement?.parent !== undefined) {
      parents.push(currentElement);
      currentElement = currentElement.parent;
    }
    
    // Reverse to get the path from top to bottom
    parents.reverse();
    
    return parents.map(parent => parent.tagName);
  }
  
  /**
   * Generate a hash for a parent branch path
   * @param parentBranchPath Array of parent tag names
   * @returns Hash of the parent branch path
   */
  private static _parentBranchPathHash(parentBranchPath: string[]): string {
    const parentBranchPathString = parentBranchPath.join('/');
    return this._hashString(parentBranchPathString);
  }
  
  /**
   * Generate a hash for element attributes
   * @param attributes Element attributes
   * @returns Hash of the attributes
   */
  private static _attributesHash(attributes: Record<string, string>): string {
    const attributesString = Object.entries(attributes)
      .map(([key, value]) => `${key}=${value}`)
      .join('');
    
    return this._hashString(attributesString);
  }
  
  /**
   * Generate a hash for an XPath
   * @param xpath Element XPath
   * @returns Hash of the XPath
   */
  private static _xpathHash(xpath: string): string {
    return this._hashString(xpath);
  }
  
  /**
   * Generate a hash for element text
   * @param domElement The DOM element
   * @returns Hash of the element text
   */
  private static _textHash(domElement: DOMElementNode): string {
    // Implementation may vary based on how you port getAllTextTillNextClickable
    // For compatibility with the existing getAllTextTillNextClickable function:
    const textString = this._getAllTextTillNextClickable(domElement);
    return this._hashString(textString);
  }
  
  /**
   * Get all text until the next clickable element
   * This is a simplified version of the one in ../index.ts
   * @param element The DOM element
   * @param maxDepth Maximum depth to traverse
   * @returns Concatenated text content
   */
  private static _getAllTextTillNextClickable(element: DOMElementNode, maxDepth: number = -1): string {
    const textParts: string[] = [];
    
    function collectText(node: DOMElementNode | any, currentDepth: number): void {
      if (maxDepth !== -1 && currentDepth > maxDepth) {
        return;
      }
      
      // Skip this branch if we hit a highlighted element (except for the current node)
      if (node !== element && 
          !('type' in node) && 
          node.highlightIndex !== undefined && 
          node.highlightIndex !== null) {
        return;
      }
      
      if ('type' in node && node.type === 'TEXT_NODE') {
        textParts.push(node.text);
      } else if (!('type' in node) && node.children) {
        for (const child of node.children) {
          collectText(child, currentDepth + 1);
        }
      }
    }
    
    collectText(element, 0);
    return textParts.join(' ').trim();
  }
  
  /**
   * Generate a hash for a string
   * @param str String to hash
   * @returns SHA-256 hash of the string
   */
  private static _hashString(str: string): string {
    return createHash('sha256').update(str || '').digest('hex');
  }
} 