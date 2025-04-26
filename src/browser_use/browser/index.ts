/**
 * Browser module for browser-use-typescript
 * This module contains the Browser class responsible for browser interactions
 */

import * as playwright from 'playwright';
import { BrowserContextConfig, BrowserContext } from './context';
import { BrowserState } from './types';

/**
 * Configuration for the Browser
 */
export interface BrowserConfig {
  /**
   * Browser type to launch
   * @default 'chromium'
   */
  browserType?: 'chromium' | 'firefox' | 'webkit';
  
  /**
   * Whether to run browser in headless mode
   * @default false
   */
  headless?: boolean;
  
  /**
   * Default viewport size
   * @default { width: 1280, height: 1100 }
   */
  viewport?: { width: number; height: number };
  
  /**
   * Custom user agent to use
   */
  userAgent?: string;
  
  /**
   * Default operation timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
  
  /**
   * Configuration for new browser contexts
   */
  newContextConfig?: BrowserContextConfig;
  
  /**
   * Disable browser security features
   * @default false
   */
  disableSecurity?: boolean;
}

/**
 * Browser class for managing browser instances and interactions
 */
export class Browser {
  private playwrightBrowser: playwright.Browser | null = null;
  public config: BrowserConfig;
  private context: BrowserContext | null = null;
  private page: playwright.Page | null = null;

  /**
   * Create a new Browser instance
   * @param config Browser configuration options
   */
  constructor(config: BrowserConfig = {}) {
    this.config = {
      browserType: config.browserType ?? 'chromium',
      headless: config.headless ?? false,
      viewport: config.viewport ?? { width: 1280, height: 1100 },
      userAgent: config.userAgent,
      timeout: config.timeout ?? 30000,
      disableSecurity: config.disableSecurity ?? false,
      newContextConfig: config.newContextConfig ?? {}
    };
  }

  /**
   * Initialize the browser instance if needed
   */
  async _init(): Promise<void> {
    if (this.playwrightBrowser) {
      return;
    }

    // Launch the appropriate browser type
    const browserType = this.config.browserType || 'chromium';
    
    // Launch browser with appropriate options
    this.playwrightBrowser = await playwright[browserType].launch({
      headless: this.config.headless
    });
    
    // Create a default context if none exists
    if (!this.context) {
      this.context = new BrowserContext({ 
        browser: this as any // Type cast to avoid the circular reference issue
      });
      await this.context.init();
    }
    
    // Get or create page
    this.page = await this.getCurrentPage();
  }
  
  /**
   * Get the current context or create a new one
   */
  async getContext(): Promise<BrowserContext> {
    if (!this.context) {
      this.context = new BrowserContext({ 
        browser: this as any // Type cast to avoid the circular reference issue
      });
      await this.context.init();
    }
    return this.context;
  }
  
  /**
   * Get the current page or create a new one
   */
  async getCurrentPage(): Promise<playwright.Page | null> {
    if (!this.page) {
      const context = await this.getContext();
      const page = await context.getCurrentPage();
      this.page = page;
    }
    return this.page;
  }
  
  /**
   * Get the browser state
   */
  async getState(): Promise<BrowserState> {
    const context = await this.getContext();
    return await context.getState();
  }
  
  /**
   * Navigate to a URL
   * @param url URL to navigate to
   */
  async navigateTo(url: string): Promise<void> {
    const context = await this.getContext();
    await context.navigateTo(url);
  }
  
  /**
   * Take a screenshot of the current page
   * @param fullPage Whether to take a full page screenshot
   */
  async takeScreenshot(fullPage: boolean = false): Promise<string> {
    const context = await this.getContext();
    return await context.takeScreenshot(fullPage);
  }

  /**
   * Get the Playwright browser instance, initializing if needed
   */
  async getPlaywrightBrowser(): Promise<playwright.Browser> {
    await this._init();
    
    if (!this.playwrightBrowser) {
      throw new Error('Failed to launch browser');
    }
    
    return this.playwrightBrowser;
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    
    if (this.playwrightBrowser) {
      await this.playwrightBrowser.close();
      this.playwrightBrowser = null;
      this.page = null;
    }
  }
}

// Export other components from browser submodules
export * from './types'; 