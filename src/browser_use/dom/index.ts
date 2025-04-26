/**
 * DOM module for browser-use-typescript
 * This module contains utilities for DOM manipulation and analysis
 */

import { DOMElement } from '../controller/types';
import { DOMElementNode, DOMTextNode, DOMTree } from './types';

// Export components
export * from './types';
export * from './service';
export * from './clickable_element_processor';
export * from './history_tree_processor';

/**
 * Simplified DOM tree for better processing
 */
export interface SimplifiedDOMTree {
  root: DOMElement;
  timestamp: number;
}

/**
 * Adapter function to convert DOMElement to DOMElementNode
 * This is a temporary solution to bridge the gap between the two interfaces
 */
function adaptDOMElement(element: DOMElement): DOMElementNode {
  return {
    tagName: element.tag,
    xpath: '',  // No direct mapping in DOMElement
    attributes: element.attributes || {},
    children: [],  // We'll need to process children recursively if needed
    isVisible: element.visible || false,
    parent: null,  // No parent reference in DOMElement
    // Additional properties can be set with default values
  };
}

/**
 * Utility function to find elements in the DOM tree
 * @param tree DOM tree to search
 * @param predicate Predicate function to test elements
 */
export function findElements(tree: SimplifiedDOMTree, predicate: (element: DOMElementNode) => boolean): DOMElementNode[] {
  const results: DOMElementNode[] = [];
  
  function traverse(element: DOMElementNode | DOMTextNode) {
    // Skip text nodes
    if ('type' in element && element.type === 'TEXT_NODE') {
      return;
    }
    
    // Check element
    if (predicate(element as DOMElementNode)) {
      results.push(element as DOMElementNode);
    }
    
    // Traverse children if any
    if ('children' in element && element.children) {
      for (const child of element.children) {
        traverse(child);
      }
    }
  }
  
  // Use the adapter to convert DOMElement to DOMElementNode
  const adaptedRoot = adaptDOMElement(tree.root);
  traverse(adaptedRoot);
  return results;
}

/**
 * Utility function to find elements by tag name
 * @param tree DOM tree to search
 * @param tagName Tag name to search for
 */
export function findElementsByTag(tree: SimplifiedDOMTree, tagName: string): DOMElementNode[] {
  return findElements(tree, (element) => element.tagName.toLowerCase() === tagName.toLowerCase());
}

/**
 * Utility function to find elements by ID
 * @param tree DOM tree to search
 * @param id ID to search for
 */
export function findElementById(tree: SimplifiedDOMTree, id: string): DOMElementNode | null {
  const elements = findElements(tree, (element) => element.attributes && element.attributes.id === id);
  return elements.length > 0 ? elements[0] : null;
}

/**
 * Utility function to find elements by class name
 * @param tree DOM tree to search
 * @param className Class name to search for
 */
export function findElementsByClass(tree: SimplifiedDOMTree, className: string): DOMElementNode[] {
  return findElements(tree, (element) => {
    if (!element.attributes || !element.attributes.class) return false;
    const classes = element.attributes.class.split(' ');
    return classes.includes(className);
  });
}

/**
 * Utility function to find elements by text content
 * @param tree DOM tree to search
 * @param text Text content to search for
 * @param exact Whether to match exactly or partially
 */
export function findElementsByText(tree: SimplifiedDOMTree, text: string, exact: boolean = false): DOMElementNode[] {
  // Helper to get all text of an element including children
  function getElementText(element: DOMElementNode | DOMTextNode): string {
    if ('type' in element && element.type === 'TEXT_NODE') {
      return element.text;
    }
    
    let textContent = '';
    
    // Process children
    if ('children' in element && element.children) {
      for (const child of element.children) {
        textContent += getElementText(child) + ' ';
      }
    }
    
    return textContent.trim();
  }
  
  return findElements(tree, (element) => {
    const elementText = getElementText(element);
    if (!elementText) return false;
    
    if (exact) {
      return elementText === text;
    } else {
      return elementText.includes(text);
    }
  });
}

/**
 * Utility function to format DOM elements as a string
 * @param element The DOM element to format
 * @param includeAttributes Attributes to include in the output
 */
export function formatDOMElementsToString(element: DOMElementNode, includeAttributes: string[] = []): string {
  const formattedText: string[] = [];
  
  function processNode(node: DOMElementNode | DOMTextNode, depth: number): void {
    const depthStr = '  '.repeat(depth);
    
    // Process element nodes with highlight index
    if (!('type' in node) && 'highlightIndex' in node && node.highlightIndex !== undefined) {
      // Format attributes
      let attributesStr = '';
      if (includeAttributes.length > 0 && node.attributes) {
        const attributesToInclude = Object.fromEntries(
          Object.entries(node.attributes).filter(([key]) => includeAttributes.includes(key))
        );
        
        // Build attributes string
        if (Object.keys(attributesToInclude).length > 0) {
          attributesStr = ' ' + Object.entries(attributesToInclude)
            .map(([key, value]) => `${key}='${value}'`)
            .join(' ');
        }
      }
      
      // Get element text
      const text = getAllTextTillNextClickable(node);
      
      // Build the element string
      const highlightIndicator = node.isNew ? `*[${node.highlightIndex}]*` : `[${node.highlightIndex}]`;
      
      let line = `${depthStr}${highlightIndicator}<${node.tagName}`;
      if (attributesStr) {
        line += attributesStr;
      }
      
      if (text) {
        line += `>${text}`;
      }
      
      line += ' />';
      formattedText.push(line);
    }
    
    // Process children
    if (!('type' in node) && node.children) {
      for (const child of node.children) {
        processNode(child, depth + 1);
      }
    } else if ('type' in node && node.type === 'TEXT_NODE') {
      // Add text nodes that don't have a highlighted parent
      if (!hasParentWithHighlightIndex(node) && node.isVisible && node.parent?.isTopElement) {
        formattedText.push(`${depthStr}${node.text}`);
      }
    }
  }
  
  processNode(element, 0);
  return formattedText.join('\n');
}

/**
 * Helper function to check if a node has a parent with a highlight index
 */
function hasParentWithHighlightIndex(node: DOMTextNode): boolean {
  let current = node.parent;
  while (current !== null) {
    if (current.highlightIndex !== undefined && current.highlightIndex !== null) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Helper function to get all text until the next clickable element
 */
function getAllTextTillNextClickable(element: DOMElementNode, maxDepth: number = -1): string {
  const textParts: string[] = [];
  
  function collectText(node: DOMElementNode | DOMTextNode, currentDepth: number): void {
    if (maxDepth !== -1 && currentDepth > maxDepth) {
      return;
    }
    
    // Skip this branch if we hit a highlighted element (except for the current node)
    if (!('type' in node) && node !== element && node.highlightIndex !== undefined && node.highlightIndex !== null) {
      return;
    }
    
    if ('type' in node && node.type === 'TEXT_NODE') {
      textParts.push(node.text);
    } else if (!('type' in node)) {
      for (const child of node.children) {
        collectText(child, currentDepth + 1);
      }
    }
  }
  
  collectText(element, 0);
  return textParts.join(' ').trim();
}

/**
 * Find a file upload element in the DOM tree
 * @param element Element to start searching from
 * @param checkSiblings Whether to check siblings
 */
export function findFileUploadElement(element: DOMElementNode, checkSiblings: boolean = true): DOMElementNode | null {
  // Check if current element is a file input
  if (element.tagName === 'input' && element.attributes && element.attributes.type === 'file') {
    return element;
  }
  
  // Check children
  for (const child of element.children) {
    if (!('type' in child)) {
      const result = findFileUploadElement(child, false);
      if (result) {
        return result;
      }
    }
  }
  
  // Check siblings if requested
  if (checkSiblings && element.parent) {
    for (const sibling of element.parent.children) {
      if (!('type' in sibling) && sibling !== element) {
        const result = findFileUploadElement(sibling, false);
        if (result) {
          return result;
        }
      }
    }
  }
  
  return null;
}

// Export the DOM script for browser execution
export const buildDomTreeScript = `
function buildDomTree() {
  function extractNode(node) {
    if (!node) return null;
    
    // Skip comment nodes and non-element nodes
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    
    // Get computed style for visibility check
    const style = window.getComputedStyle(node);
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    
    // Get bounding client rect
    const rect = node.getBoundingClientRect();
    
    // Extract attributes
    const attributes = {};
    for (const attr of node.attributes) {
      attributes[attr.name] = attr.value;
    }
    
    // Process children
    const children = [];
    for (const child of node.childNodes) {
      const childData = extractNode(child);
      if (childData) {
        children.push(childData);
      }
    }
    
    return {
      tag: node.tagName.toLowerCase(),
      id: node.id || undefined,
      classes: node.className ? node.className.split(' ').filter(c => c.length > 0) : [],
      text: node.textContent ? node.textContent.trim() : undefined,
      attributes,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      },
      visible: isVisible,
      enabled: !node.disabled,
      children: children.length > 0 ? children : undefined
    };
  }
  
  return {
    root: extractNode(document.body),
    timestamp: Date.now()
  };
}

buildDomTree();
`;

// Export type definitions
export * from './types'; 