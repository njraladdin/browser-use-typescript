/**
 * Test for DOM tree processing
 * Ported from browser_use/dom/tests/process_dom_test.py
 */

import fs from 'fs/promises';
import path from 'path';
import { Browser, BrowserConfig } from '../../src/browser_use/browser';

// Test configuration 
const TEST_TIMEOUT = 60000; // 60 seconds

describe('DOM processing', () => {
  let browser: Browser;

  beforeAll(async () => {
    // Create browser instance
    browser = new Browser({
      headless: false // Set to true for CI environments
    });
  });

  afterAll(async () => {
    // Clean up browser
    await browser.close();
  });

  test('should process DOM tree', async () => {
    // This test mirrors the Python test process_dom_test.py
    const context = await browser.getContext();
    const page = await context.getCurrentPage();
    
    // Ensure page exists
    expect(page).not.toBeNull();
    if (!page) return; // TypeScript safety

    // Navigate to test URL
    await page.goto('https://kayak.com/flights');

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Read the DOM tree builder script
    const scriptPath = path.resolve(__dirname, '../../src/browser_use/dom/buildDomTree.js');
    const jsCode = await fs.readFile(scriptPath, 'utf-8');

    // Performance measurement
    console.time('DOM tree processing');
    
    try {
      // The buildDomTree.js script is an IIFE (Immediately Invoked Function Expression)
      // that returns a function. We need to call that function with our arguments.
      const evalFn = `
        (() => {
          const buildDomTree = ${jsCode};
          return buildDomTree({
            doHighlightElements: true,
            focusHighlightIndex: -1,
            viewportExpansion: 0,
            debugMode: false
          });
        })()
      `;
      
      // Use type assertion to workaround TypeScript limitations
      const domTree = await (page as any).evaluate(evalFn);
      
      console.timeEnd('DOM tree processing');
      console.log('DOM tree result:', domTree ? 'Received data' : 'No data');
      if (domTree) {
        console.log('DOM tree properties:', Object.keys(domTree));
      }

      // Ensure the output directory exists
      const outputDir = path.resolve(__dirname, '../../tmp');
      try {
        await fs.mkdir(outputDir, { recursive: true });
      } catch (err) {
        // Directory might already exist, ignore
      }

      // Validate the result before writing
      expect(domTree).toBeDefined();
      
      // Write results to file
      const outputPath = path.resolve(outputDir, 'dom.json');
      await fs.writeFile(outputPath, JSON.stringify(domTree, null, 2));

      // Validate the structure based on the expected output format
      expect(domTree).toHaveProperty('rootId');
      expect(domTree).toHaveProperty('map');
    } catch (error) {
      console.error('Error evaluating DOM tree script:', error);
      throw error;
    }
    
    // This matches the Python test's input() call for interactive testing
    // await new Promise(resolve => process.stdin.once('data', resolve));
  }, TEST_TIMEOUT);
}); 