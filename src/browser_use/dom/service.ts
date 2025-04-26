/**
 * DOM service for browser-use-typescript
 * This module contains the DOMService class responsible for DOM operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { Page } from 'puppeteer';
import {
  BuildDOMTreeOptions,
  DOMBaseNode,
  DOMElementNode,
  DOMState,
  DOMTextNode,
  SelectorMap,
  ViewportInfo
} from './types';

export class DOMService {
  private page: Page;
  private xpathCache: Record<string, any> = {};
  private jsCode: string;

  /**
   * Create a new DOMService
   * @param page Puppeteer page object
   */
  constructor(page: Page) {
    this.page = page;
    
    // Load buildDomTree.js
    try {
      const scriptPath = path.resolve(__dirname, './buildDomTree.js');
      this.jsCode = fs.readFileSync(scriptPath, 'utf8');
    } catch (error) {
      console.error('Error loading buildDomTree.js:', error);
      // Provide a minimal fallback
      this.jsCode = 'args => ({ rootId: null, map: {} })';
    }
  }

  /**
   * Get all clickable elements from the page
   * @param options Options for building the DOM tree
   */
  async getClickableElements(options: BuildDOMTreeOptions = {}): Promise<DOMState> {
    const [elementTree, selectorMap] = await this.buildDOMTree(
      options.highlightElements ?? true,
      options.focusElement ?? -1,
      options.viewportExpansion ?? 0,
      options.debugMode ?? false
    );

    return {
      elementTree,
      selectorMap
    };
  }

  /**
   * Get cross-origin iframes
   */
  async getCrossOriginIframes(): Promise<string[]> {
    // Get all hidden iframe URLs for filtering
    const hiddenFrameUrls = await this.page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes
        .filter(iframe => {
          const style = window.getComputedStyle(iframe);
          return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
        })
        .map(iframe => iframe.src);
    });

    // Get all frames from the page
    const frames = this.page.frames();
    const pageUrl = this.page.url();
    
    // Parse the current page URL to get domain
    const pageUrlObj = new URL(pageUrl);
    const pageDomain = pageUrlObj.hostname;
    
    // Filter frames
    const isAdUrl = (url: string) => {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        return ['doubleclick.net', 'adroll.com', 'googletagmanager.com'].some(adDomain => 
          domain.includes(adDomain)
        );
      } catch {
        return false;
      }
    };

    return frames
      .map(frame => frame.url())
      .filter(url => {
        try {
          // Skip about:blank, data: URLs, etc.
          if (!url.startsWith('http')) return false;
          
          const urlObj = new URL(url);
          const domain = urlObj.hostname;
          
          return (
            domain && // Has a valid domain
            domain !== pageDomain && // Not same origin as page
            !hiddenFrameUrls.includes(url) && // Not a hidden frame
            !isAdUrl(url) // Not an ad URL
          );
        } catch {
          return false;
        }
      });
  }

  /**
   * Build the DOM tree
   * @param highlightElements Whether to highlight elements
   * @param focusElement Index of element to focus
   * @param viewportExpansion How much to expand the viewport
   * @param debugMode Whether to enable debug mode
   */
  private async buildDOMTree(
    highlightElements: boolean = true,
    focusElement: number = -1,
    viewportExpansion: number = 0,
    debugMode: boolean = false
  ): Promise<[DOMElementNode, SelectorMap]> {
    // Check if the page can evaluate JavaScript
    try {
      const result = await this.page.evaluate('1+1');
      if (result !== 2) {
        throw new Error('The page cannot evaluate JavaScript properly');
      }
    } catch (error) {
      throw new Error(`Failed to evaluate JavaScript: ${error}`);
    }

    // Short-circuit for about:blank pages
    if (this.page.url() === 'about:blank') {
      const emptyElementNode: DOMElementNode = {
        tagName: 'body',
        xpath: '',
        attributes: {},
        children: [],
        isVisible: false,
        parent: null
      };
      
      const emptySelectorMap: SelectorMap = {};
      
      return [emptyElementNode, emptySelectorMap];
    }

    // Execute the DOM tree builder JavaScript
    const args = {
      doHighlightElements: highlightElements,
      focusHighlightIndex: focusElement,
      viewportExpansion: viewportExpansion,
      debugMode
    };

    try {
      // Use 'any' type for evalPage to avoid type issues with Puppeteer's evaluate return
      const evalPage = await this.page.evaluate(this.jsCode, args) as any;
      
      // Log performance metrics in debug mode
      if (debugMode && evalPage.perfMetrics) {
        console.debug(
          'DOM Tree Building Performance Metrics for:',
          this.page.url(),
          JSON.stringify(evalPage.perfMetrics, null, 2)
        );
      }

      return await this.constructDOMTree(evalPage);
    } catch (error) {
      console.error('Error evaluating JavaScript:', error);
      throw error;
    }
  }

  /**
   * Construct the DOM tree from the evaluated page data
   * @param evalPage Evaluated page data
   */
  private async constructDOMTree(
    evalPage: { map: Record<string, any>; rootId: string }
  ): Promise<[DOMElementNode, SelectorMap]> {
    const jsNodeMap = evalPage.map;
    const jsRootId = evalPage.rootId;

    const selectorMap: SelectorMap = {};
    const nodeMap: Record<string, DOMBaseNode> = {};

    // Process all nodes
    for (const [id, nodeData] of Object.entries(jsNodeMap)) {
      const [node, childrenIds] = this.parseNode(nodeData as any);
      
      if (!node) {
        continue;
      }

      nodeMap[id] = node;

      // Add to selector map if it has a highlight index
      if ('highlightIndex' in node && node.highlightIndex !== undefined && node.highlightIndex !== null) {
        selectorMap[node.highlightIndex] = node as DOMElementNode;
      }

      // Connect children to parent
      if ('children' in node) {
        for (const childId of childrenIds) {
          if (!(childId in nodeMap)) {
            continue;
          }

          const childNode = nodeMap[childId];
          childNode.parent = node as DOMElementNode;
          
          // TypeScript type guard for DOMElementNode
          if ('children' in node) {
            (node as DOMElementNode).children.push(childNode as any);
          }
        }
      }
    }

    // Get the root node
    const htmlToDict = nodeMap[String(jsRootId)];

    if (!htmlToDict || !('tagName' in htmlToDict)) {
      throw new Error('Failed to parse HTML to dictionary');
    }

    return [htmlToDict as DOMElementNode, selectorMap];
  }

  /**
   * Parse a node from the evaluated page data
   * @param nodeData Node data from JavaScript
   */
  private parseNode(
    nodeData: any
  ): [DOMBaseNode | null, string[]] {
    if (!nodeData) {
      return [null, []];
    }

    // Process text nodes immediately
    if (nodeData.type === 'TEXT_NODE') {
      const textNode: DOMTextNode = {
        type: 'TEXT_NODE',
        text: nodeData.text,
        isVisible: nodeData.isVisible,
        parent: null
      };
      return [textNode, []];
    }

    // Process viewport info if available
    let viewportInfo: ViewportInfo | undefined;
    if (nodeData.viewport) {
      viewportInfo = {
        width: nodeData.viewport.width,
        height: nodeData.viewport.height
      };
    }

    // Create element node
    const elementNode: DOMElementNode = {
      tagName: nodeData.tagName,
      xpath: nodeData.xpath,
      attributes: nodeData.attributes || {},
      children: [],
      isVisible: nodeData.isVisible || false,
      isInteractive: nodeData.isInteractive || false,
      isTopElement: nodeData.isTopElement || false,
      isInViewport: nodeData.isInViewport || false,
      highlightIndex: nodeData.highlightIndex,
      shadowRoot: nodeData.shadowRoot || false,
      parent: null,
      viewportInfo
    };

    const childrenIds = nodeData.children || [];

    return [elementNode, childrenIds];
  }
} 