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
    const page = await browser.getCurrentPage();
    
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
    
    // Execute the script in the page context
    const domTree = await (page as any).evaluate(jsCode);
    
    console.timeEnd('DOM tree processing');

    // Ensure the output directory exists
    const outputDir = path.resolve(__dirname, '../../tmp');
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore
    }

    // Write results to file
    const outputPath = path.resolve(outputDir, 'dom.json');
    await fs.writeFile(outputPath, JSON.stringify(domTree, null, 2));

    // Validate the result
    expect(domTree).toBeDefined();
    expect(domTree).toHaveProperty('children');
    
    // Skip the prompt in automated tests, but for manual testing:
    // Uncomment the following line for interactive testing
    // await new Promise(resolve => process.stdin.once('data', resolve));
  }, TEST_TIMEOUT);
}); 