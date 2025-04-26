/**
 * History tree processor service for browser-use-typescript
 * This module provides utilities for DOM history operations
 */

import { createHash } from 'crypto';
import { DOMElementNode } from '../types';
import { DOMHistoryElement, HashedDomElement } from './types';

/**
 * Operations on the DOM elements
 * @dev be careful - text nodes can change even if elements stay the same
 */
export class HistoryTreeProcessor {
  /**
   * Convert a DOM element to a history element
   * @param domElement The DOM element to convert
   * @returns A history element representation
   */
  static convertDomElementToHistoryElement(domElement: DOMElementNode): DOMHistoryElement {
    const parentBranchPath = this._getParentBranchPath(domElement);
    
    // Note: The original Python code called an external method to get CSS selector
    // Since we don't have direct access to BrowserContext, we'll skip this for now
    // Would need to be added when integrating with the BrowserContext module
    const cssSelector = undefined; 

    return {
      tagName: domElement.tagName,
      xpath: domElement.xpath,
      highlightIndex: domElement.highlightIndex ?? null,
      entireParentBranchPath: parentBranchPath,
      attributes: domElement.attributes,
      shadowRoot: domElement.shadowRoot ?? false,
      cssSelector: cssSelector,
      pageCoordinates: domElement.pageCoordinates,
      viewportCoordinates: domElement.viewportCoordinates,
      viewportInfo: domElement.viewportInfo
    };
  }

  /**
   * Find a history element in the DOM tree
   * @param domHistoryElement The history element to find
   * @param tree The DOM tree to search
   * @returns The matching DOM element, or undefined if not found
   */
  static findHistoryElementInTree(domHistoryElement: DOMHistoryElement, tree: DOMElementNode): DOMElementNode | undefined {
    const hashedDomHistoryElement = this._hashDomHistoryElement(domHistoryElement);

    function processNode(node: DOMElementNode): DOMElementNode | undefined {
      if (node.highlightIndex !== undefined && node.highlightIndex !== null) {
        const hashedNode = HistoryTreeProcessor._hashDomElement(node);
        if (
          hashedNode.branchPathHash === hashedDomHistoryElement.branchPathHash &&
          hashedNode.attributesHash === hashedDomHistoryElement.attributesHash &&
          hashedNode.xpathHash === hashedDomHistoryElement.xpathHash
        ) {
          return node;
        }
      }

      for (const child of node.children) {
        // Skip text nodes
        if ('type' in child && child.type === 'TEXT_NODE') {
          continue;
        }
        
        const result = processNode(child as DOMElementNode);
        if (result !== undefined) {
          return result;
        }
      }

      return undefined;
    }

    return processNode(tree);
  }

  /**
   * Compare a history element with a DOM element
   * @param domHistoryElement The history element
   * @param domElement The DOM element
   * @returns True if the elements match, false otherwise
   */
  static compareHistoryElementAndDomElement(domHistoryElement: DOMHistoryElement, domElement: DOMElementNode): boolean {
    const hashedDomHistoryElement = this._hashDomHistoryElement(domHistoryElement);
    const hashedDomElement = this._hashDomElement(domElement);

    return (
      hashedDomHistoryElement.branchPathHash === hashedDomElement.branchPathHash &&
      hashedDomHistoryElement.attributesHash === hashedDomElement.attributesHash &&
      hashedDomHistoryElement.xpathHash === hashedDomElement.xpathHash
    );
  }

  /**
   * Hash a DOM history element
   * @param domHistoryElement The DOM history element to hash
   * @returns A hashed representation of the element
   */
  private static _hashDomHistoryElement(domHistoryElement: DOMHistoryElement): HashedDomElement {
    const branchPathHash = this._parentBranchPathHash(domHistoryElement.entireParentBranchPath);
    const attributesHash = this._attributesHash(domHistoryElement.attributes);
    const xpathHash = this._xpathHash(domHistoryElement.xpath);

    return {
      branchPathHash,
      attributesHash,
      xpathHash
    };
  }

  /**
   * Hash a DOM element
   * @param domElement The DOM element to hash
   * @returns A hashed representation of the element
   */
  private static _hashDomElement(domElement: DOMElementNode): HashedDomElement {
    const parentBranchPath = this._getParentBranchPath(domElement);
    const branchPathHash = this._parentBranchPathHash(parentBranchPath);
    const attributesHash = this._attributesHash(domElement.attributes);
    const xpathHash = this._xpathHash(domElement.xpath);
    // Note: text hash is commented out in the original Python code
    // const textHash = this._textHash(domElement);

    return {
      branchPathHash,
      attributesHash,
      xpathHash
    };
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
    // This would need to be implemented based on the getAllTextTillNextClickable function
    // For now, we'll use a function from the parent/index file that does this
    // const textString = domElement.getAllTextTillNextClickable();
    
    // Since we don't have direct access to that function, we'll use a placeholder
    // This would need to be properly implemented later
    const textString = '';
    return this._hashString(textString);
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