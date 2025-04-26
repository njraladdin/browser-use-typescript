/**
 * Playwright browser with enhanced functionality.
 */

import type * as PlaywrightTypes from 'playwright';
import { BrowserAction, BrowserActionType, BrowserState } from './types';
import * as chromeConfig from './chrome-config';
import { BrowserContext, BrowserContextConfig } from './context';

// Declare types to avoid importing direct from playwright
type PlaywrightBrowser = PlaywrightTypes.Browser;
type BrowserContextOptions = PlaywrightTypes.BrowserContextOptions;
type Playwright = {
  chromium: PlaywrightTypes.BrowserType<PlaywrightBrowser>;
  firefox: PlaywrightTypes.BrowserType<PlaywrightBrowser>;
  webkit: PlaywrightTypes.BrowserType<PlaywrightBrowser>;
};

// Config interfaces
export interface ProxySettings {
  server: string;
  bypass?: string;
  username?: string;
  password?: string;
}

export interface BrowserConfig {
  wssUrl?: string;
  cdpUrl?: string;
  browserClass?: 'chromium' | 'firefox' | 'webkit';
  browserBinaryPath?: string;
  extraBrowserArgs?: string[];
  headless?: boolean;
  disableSecurity?: boolean;
  deterministicRendering?: boolean;
  keepAlive?: boolean;
  proxy?: ProxySettings;
  newContextConfig?: BrowserContextConfig;
}

/**
 * Playwright browser with enhanced functionality.
 * 
 * This is a persistent browser factory that can spawn multiple browser contexts.
 * It is recommended to use only one instance of Browser per application (RAM usage will grow otherwise).
 */
export class Browser {
  private config: BrowserConfig;
  private playwright: Playwright | null = null;
  private playwrightBrowser: PlaywrightBrowser | null = null;
  private chromeSubprocess?: any; // We'll use a more specific type if we implement subprocess management

  /**
   * Create a new Browser instance
   */
  constructor(config?: BrowserConfig) {
    this.config = config || {};
    this.playwright = null;
    this.playwrightBrowser = null;
  }

  /**
   * Create a browser context
   */
  async newContext(config?: BrowserContextConfig): Promise<BrowserContext> {
    const mergedConfig = {
      ...this.config,
      ...(config || {})
    };
    
    return new BrowserContext({
      config: mergedConfig as BrowserContextConfig,
      browser: this
    });
  }

  /**
   * Get a browser instance
   */
  async getPlaywrightBrowser(): Promise<PlaywrightBrowser> {
    if (!this.playwrightBrowser) {
      return await this._init();
    }
    return this.playwrightBrowser;
  }

  /**
   * Initialize the browser session
   */
  private async _init(): Promise<PlaywrightBrowser> {
    // Initialize playwright
    const playwright = await this._startPlaywright();
    this.playwright = playwright;
    
    // Setup browser
    const browser = await this._setupBrowser(playwright);
    this.playwrightBrowser = browser;
    
    return browser;
  }

  /**
   * Start the Playwright automation framework
   */
  private async _startPlaywright(): Promise<Playwright> {
    // In the Node.js version, we need to use the import method to get a playwright instance
    return await import('playwright') as unknown as Playwright;
  }

  /**
   * Set up remote CDP browser
   */
  private async _setupRemoteCdpBrowser(playwright: Playwright): Promise<PlaywrightBrowser> {
    if (!this.config.cdpUrl) {
      throw new Error('CDP URL is required');
    }
    
    console.log(`🔌 Connecting to remote browser via CDP ${this.config.cdpUrl}`);
    
    const browserClass = this._getBrowserClass(playwright);
    return await browserClass.connectOverCDP(this.config.cdpUrl);
  }

  /**
   * Set up remote WSS browser
   */
  private async _setupRemoteWssBrowser(playwright: Playwright): Promise<PlaywrightBrowser> {
    if (!this.config.wssUrl) {
      throw new Error('WSS URL is required');
    }
    
    console.log(`🔌 Connecting to remote browser via WSS ${this.config.wssUrl}`);
    
    const browserClass = this._getBrowserClass(playwright);
    return await browserClass.connect(this.config.wssUrl);
  }

  /**
   * Get browser class based on config
   */
  private _getBrowserClass(playwright: Playwright) {
    const browserClass = this.config.browserClass || 'chromium';
    switch (browserClass) {
      case 'firefox':
        return playwright.firefox;
      case 'webkit':
        return playwright.webkit;
      case 'chromium':
      default:
        return playwright.chromium;
    }
  }

  /**
   * Setup user provided browser
   */
  private async _setupUserProvidedBrowser(playwright: Playwright): Promise<PlaywrightBrowser> {
    if (!this.config.browserBinaryPath) {
      throw new Error('A browserBinaryPath is required');
    }
    
    // This would require implementing subprocess management
    // For now, we'll just implement a simple version connecting to an existing browser
    // This is a simplified version without the actual subprocess management of the Python version
    
    try {
      // Try connecting to existing browser
      const browserClass = this._getBrowserClass(playwright);
      return await browserClass.connectOverCDP('http://localhost:9222');
    } catch (error) {
      console.error('Failed to connect to existing browser');
      throw new Error('Browser connection failed: ' + error);
    }
  }

  /**
   * Setup built-in browser
   */
  private async _setupBuiltinBrowser(playwright: Playwright): Promise<PlaywrightBrowser> {
    const browserClass = this._getBrowserClass(playwright);
    
    const launchOptions: any = {
      headless: this.config.headless !== undefined ? this.config.headless : false,
    };
    
    // Add browser arguments based on configuration
    const args: string[] = [
      ...chromeConfig.CHROME_ARGS
    ];
    
    // Add conditional arguments
    if (this.config.disableSecurity) {
      args.push(...chromeConfig.CHROME_DISABLE_SECURITY_ARGS);
    }
    
    if (this.config.deterministicRendering) {
      args.push(...chromeConfig.CHROME_DETERMINISTIC_RENDERING_ARGS);
    }
    
    if (this.config.headless) {
      args.push(...chromeConfig.CHROME_HEADLESS_ARGS);
    }
    
    // Add any extra args from config
    if (this.config.extraBrowserArgs && this.config.extraBrowserArgs.length > 0) {
      args.push(...this.config.extraBrowserArgs);
    }
    
    // Set args for chromium
    if (this.config.browserClass === 'chromium' || !this.config.browserClass) {
      launchOptions.args = args;
    }
    
    // Add proxy if configured
    if (this.config.proxy) {
      launchOptions.proxy = this.config.proxy;
    }
    
    console.log('🚀 Launching browser');
    return await browserClass.launch(launchOptions);
  }

  /**
   * Setup browser based on configuration
   */
  private async _setupBrowser(playwright: Playwright): Promise<PlaywrightBrowser> {
    if (this.config.cdpUrl) {
      return await this._setupRemoteCdpBrowser(playwright);
    } else if (this.config.wssUrl) {
      return await this._setupRemoteWssBrowser(playwright);
    } else if (this.config.browserBinaryPath) {
      return await this._setupUserProvidedBrowser(playwright);
    } else {
      return await this._setupBuiltinBrowser(playwright);
    }
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    try {
      if (this.playwrightBrowser) {
        await this.playwrightBrowser.close();
        this.playwrightBrowser = null;
      }
      
      if (this.playwright) {
        // In Playwright for Node.js, there is no explicit way to close the Playwright instance
        // It will be garbage collected automatically
        this.playwright = null;
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }
  
  /**
   * Cleanup resources when browser is destroyed
   */
  async dispose(): Promise<void> {
    if (!this.config.keepAlive) {
      await this.close();
    }
  }
} 