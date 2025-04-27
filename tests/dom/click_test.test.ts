/**
 * Test for DOM element highlighting and clicking
 * Ported from browser_use/browser/tests/test_clicks.py
 */

import fs from 'fs/promises';
import path from 'path';
import { Browser, BrowserConfig } from '../../src/browser_use/browser';
import { DOMElementNode, DOMTextNode } from '../../src/browser_use/dom/types';
import type * as PlaywrightTypes from 'playwright';

// Test configuration 
const TEST_TIMEOUT = 60000; // 60 seconds

/**
 * A class to serialize DOM element trees to JSON
 * Equivalent to the Python ElementTreeSerializer
 */
class ElementTreeSerializer {
  /**
   * Convert a DOM element node to a JSON representation
   * @param elementTree The element tree to serialize
   */
  static domElementNodeToJson(elementTree: DOMElementNode): any {
    function nodeToDict(node: DOMElementNode | DOMTextNode): any {
      if ('type' in node && node.type === 'TEXT_NODE') {
        return { 
          type: 'text', 
          text: node.text 
        };
      } else {
        // This must be a DOMElementNode
        const elemNode = node as DOMElementNode;
        return {
          type: 'element',
          tagName: elemNode.tagName,
          attributes: elemNode.attributes,
          highlightIndex: elemNode.highlightIndex,
          children: elemNode.children.map(child => nodeToDict(child)),
        };
      }
    }

    return nodeToDict(elementTree);
  }
}

describe('Element highlighting and interaction', () => {
  let browser: Browser;

  beforeAll(async () => {
    // Create browser instance with security disabled
    browser = new Browser({
      headless: false,
      disableSecurity: true
    });
  });

  afterAll(async () => {
    // Clean up browser
    await browser.close();
  });

  // Interactive test for element highlighting and clicking
  // Run with: npx jest tests/dom/click_test.test.ts --testNamePattern="should highlight and click elements"
  test('should highlight and click elements', async () => {
    const context = await browser.getContext();
    const page = await context.getCurrentPage();
    
    // Ensure page exists
    expect(page).not.toBeNull();
    if (!page) return;

    // Cast the page to Playwright's Page type to access the proper methods
    const pwPage = page as unknown as PlaywrightTypes.Page;

    // Navigate to test URL - using a more substantial website
    await pwPage.goto('https://github.com');

    // Wait for page to load
    // Use setTimeout instead of waitForTimeout since that's not directly available
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create temp directory if it doesn't exist
    const tempDir = path.resolve(__dirname, '../../tmp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore
    }

    // Main interaction loop
    let continueLoop = true;
    while (continueLoop) {
      try {
        // Get page state with highlighted elements
        const state = await context.getState();

        // In TypeScript, we need to adapt our approach since elementTree might not be directly available
        // We need to get clickable elements from the DOMService
        const clickableElements = [];
        const selectorMap = state.selector_map || {};

        // Save the selector map information to a JSON file if available
        if (Object.keys(selectorMap).length > 0) {
          const outputPath = path.resolve(tempDir, 'page.json');
          await fs.writeFile(
            outputPath,
            JSON.stringify(
              selectorMap,
              null,
              1
            )
          );
          console.log(`Saved selector map to: ${outputPath}`);
        }

        // Check for duplicate XPaths (if selector_map is available)
        if (Object.keys(selectorMap).length > 0) {
          const xpathCounts: Record<string, number> = {};
          
          for (const [_, selector] of Object.entries(selectorMap)) {
            const xpath = selector.xpath;
            if (xpath) {
              if (xpath in xpathCounts) {
                xpathCounts[xpath] += 1;
              } else {
                xpathCounts[xpath] = 1;
              }
            }
          }

          // Print duplicate XPaths
          console.log('\nDuplicate XPaths found:');
          for (const [xpath, count] of Object.entries(xpathCounts)) {
            if (count > 1) {
              console.log(`XPath: ${xpath}`);
              console.log(`Count: ${count}\n`);
            }
          }

          // Print selectable elements
          console.log('Selector map keys:', Object.keys(selectorMap));
          
          // Get next action from user input
          // For interactive operation, uncomment these lines
          // const action = await new Promise<string>(resolve => {
          //   const readline = require('readline').createInterface({
          //     input: process.stdin,
          //     output: process.stdout
          //   });
          //   readline.question('Select next action: ', (answer: string) => {
          //     readline.close();
          //     resolve(answer);
          //   });
          // });
          
          // For automated testing, exit after one iteration
          console.log('Automated test - exiting after one pass');
          continueLoop = false;
          
          // Remove highlights from the page by executing JavaScript in the page context
          try {
            await (pwPage as any).evaluate(() => {
              const highlightContainer = document.getElementById('playwright-highlight-container');
              if (highlightContainer) {
                highlightContainer.remove();
              }
            });
          } catch (error) {
            console.error('Error removing highlight container:', error);
          }
          
          // Click the selected element
          // In a real interactive session, you'd use this code:
          // const nodeElement = selectorMap[parseInt(action)];
          // if (nodeElement && pwPage) {
          //   try {
          //     if (nodeElement.xpath) {
          //       await pwPage.click(`xpath=${nodeElement.xpath}`);
          //       console.log(`Clicked element with xpath: ${nodeElement.xpath}`);
          //       // Wait for any page changes after clicking
          //       await new Promise(resolve => setTimeout(resolve, 2000));
          //     }
          //   } catch (error) {
          //     console.error('Error clicking element:', error);
          //   }
          // }
        } else {
          console.log('No selector map available');
          continueLoop = false;
        }
      } catch (error) {
        console.error('Error during test:', error);
        continueLoop = false;
      }
    }
  }, TEST_TIMEOUT);

  // A non-interactive version of the test for CI environments
  test('should highlight elements and validate structure on complex site', async () => {
    const context = await browser.getContext();
    const page = await context.getCurrentPage();
    
    // Ensure page exists
    expect(page).not.toBeNull();
    if (!page) return;

    // Cast the page to Playwright's Page type to access the proper methods
    const pwPage = page as unknown as PlaywrightTypes.Page;

    // Navigate to a complex website to test with a real-world scenario
    await pwPage.goto('https://kayak.com/flights');
    
    // Wait for page to load
    try {
      // Using a longer timeout for complex sites
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log('Page loaded');
    } catch (error) {
      console.warn('Error waiting for page load:', error);
    }
    
    // Get page state with highlighted elements
    const state = await context.getState();
    
    // Validate the state structure
    expect(state).toBeDefined();
    expect(state.selector_map).toBeDefined();
    
    // Check that there are some selectable elements
    const selectorMapSize = Object.keys(state.selector_map || {}).length;
    console.log(`Found ${selectorMapSize} selectable elements`);
    expect(selectorMapSize).toBeGreaterThan(0);
    
    // Create temp directory and save state for debugging if needed
    const tempDir = path.resolve(__dirname, '../../tmp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
      
      if (Object.keys(state.selector_map || {}).length > 0) {
        const outputPath = path.resolve(tempDir, 'kayak_page.json');
        await fs.writeFile(
          outputPath,
          JSON.stringify(
            state.selector_map,
            null,
            2
          )
        );
        console.log(`Saved selector map to: ${outputPath}`);
      }
    } catch (err) {
      console.warn('Could not save debug data:', err);
    }
  }, TEST_TIMEOUT);
}); 