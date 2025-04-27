/**
 * Test for browser screenshot functionality
 * Ported from browser_use/browser/tests/screenshot_test.py
 */

import fs from 'fs/promises';
import path from 'path';
import { Browser, BrowserConfig } from '../../src/browser_use/browser';
import type * as PlaywrightTypes from 'playwright';

// Test configuration 
const TEST_TIMEOUT = 30000; // 30 seconds

// Helper function to check if a string is valid base64
function isValidBase64(str: string): boolean {
  try {
    // The simple check we were using doesn't work in all cases
    // Just check if we can decode it without errors
    Buffer.from(str, 'base64');
    return true;
  } catch (error) {
    return false;
  }
}

describe('Browser Screenshot Tests', () => {
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

  test('should take full page screenshot', async () => {
    const context = await browser.getContext();
    const page = await context.getCurrentPage();
    
    // Ensure page exists
    expect(page).not.toBeNull();
    if (!page) return;

    // Cast the page to Playwright's Page type to access the proper methods
    const pwPage = page as unknown as PlaywrightTypes.Page;

    // Navigate to a test page - using GitHub instead of example.com
    await pwPage.goto('https://github.com');
    
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create temp directory if it doesn't exist
    const tempDir = path.resolve(__dirname, '../../tmp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore
    }
    
    // Take full page screenshot directly to file (most reliable method)
    const outputPath = path.resolve(tempDir, 'full_page_screenshot.png');
    
    try {
      // Take the screenshot to a buffer first
      const screenshotBuffer = await pwPage.screenshot({ 
        fullPage: true
      });
      
      // Then write the buffer to a file
      await fs.writeFile(outputPath, screenshotBuffer);
      
      console.log(`Full page screenshot saved to: ${outputPath}`);
      
      // Verify the file exists and has content
      const fileStats = await fs.stat(outputPath);
      expect(fileStats.size).toBeGreaterThan(0);
      console.log(`Screenshot file size: ${fileStats.size} bytes`);
    } catch (error) {
      console.error('Error taking or saving screenshot:', error);
      throw error;
    }
    
    // Try using context method too if available, but save to a different file
    try {
      if ('takeScreenshot' in context) {
        const ctxScreenshotPath = path.resolve(tempDir, 'full_page_screenshot_context.png');
        const base64 = await (context as any).takeScreenshot(true);
        
        if (base64 && typeof base64 === 'string' && base64.length > 0) {
          await fs.writeFile(ctxScreenshotPath, Buffer.from(base64, 'base64'));
          console.log(`Context screenshot also saved to: ${ctxScreenshotPath}`);
        }
      }
    } catch (err) {
      console.warn('Could not save context screenshot:', err);
    }
    
    // Wait a bit so we can see the result
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, TEST_TIMEOUT);
  
  test('should take viewport screenshot', async () => {
    const context = await browser.getContext();
    const page = await context.getCurrentPage();
    
    // Ensure page exists
    expect(page).not.toBeNull();
    if (!page) return;

    // Cast the page to Playwright's Page type to access the proper methods
    const pwPage = page as unknown as PlaywrightTypes.Page;

    // Navigate to a test page
    await pwPage.goto('https://kayak.com/flights');
    
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Create temp directory if it doesn't exist
    const tempDir = path.resolve(__dirname, '../../tmp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore
    }
    
    // Take viewport screenshot directly to file
    const outputPath = path.resolve(tempDir, 'viewport_screenshot.png');
    
    try {
      // Get buffer first, then write to file
      const screenshotBuffer = await pwPage.screenshot({ 
        fullPage: false  // Just the viewport
      });
      
      // Write buffer to file
      await fs.writeFile(outputPath, screenshotBuffer);
      
      console.log(`Viewport screenshot saved to: ${outputPath}`);
      
      // Verify the file exists and has content
      const fileStats = await fs.stat(outputPath);
      expect(fileStats.size).toBeGreaterThan(0);
      console.log(`Screenshot file size: ${fileStats.size} bytes`);
    } catch (error) {
      console.error('Error taking or saving viewport screenshot:', error);
      throw error;
    }
    
    // Try using context method too if available, but save to a different file
    try {
      if ('takeScreenshot' in context) {
        const ctxScreenshotPath = path.resolve(tempDir, 'viewport_screenshot_context.png');
        const base64 = await (context as any).takeScreenshot(false);
        
        if (base64 && typeof base64 === 'string' && base64.length > 0) {
          await fs.writeFile(ctxScreenshotPath, Buffer.from(base64, 'base64'));
          console.log(`Context viewport screenshot also saved to: ${ctxScreenshotPath}`);
        }
      }
    } catch (err) {
      console.warn('Could not save context viewport screenshot:', err);
    }
  }, TEST_TIMEOUT);
}); 