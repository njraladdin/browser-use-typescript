/**
 * Browser context implementation
 */

import type * as PlaywrightTypes from 'playwright';
import { BrowserState } from './types';
import { Browser } from './browser';
import path from 'path';
import fs from 'fs';

// Declare types to avoid importing direct from playwright
type PlaywrightBrowser = PlaywrightTypes.Browser;
type PlaywrightBrowserContext = PlaywrightTypes.BrowserContext;
type Page = PlaywrightTypes.Page;

/**
 * Window size configuration for browser context
 */
export interface BrowserContextWindowSize {
  width: number;
  height: number;
}

/**
 * Configuration for the BrowserContext
 */
export interface BrowserContextConfig {
  /**
   * Path to cookies file for persistence
   */
  cookiesFile?: string;
  
  /**
   * Minimum time to wait before getting page state for LLM input
   * @default 0.25
   */
  minimumWaitPageLoadTime?: number;
  
  /**
   * Time to wait for network requests to finish before getting page state
   * @default 0.5
   */
  waitForNetworkIdlePageLoadTime?: number;
  
  /**
   * Maximum time to wait for page load before proceeding anyway
   * @default 5.0
   */
  maximumWaitPageLoadTime?: number;
  
  /**
   * Time to wait between multiple per step actions
   * @default 0.5
   */
  waitBetweenActions?: number;
  
  /**
   * Disable browser security features (dangerous, but cross-origin iframe support requires it)
   * @default false
   */
  disableSecurity?: boolean;
  
  /**
   * Default browser window size
   * @default { width: 1280, height: 1100 }
   */
  browserWindowSize?: BrowserContextWindowSize;
  
  /**
   * Disable viewport
   * @default false
   */
  noViewport?: boolean;
  
  /**
   * Path to save video recordings
   */
  saveRecordingPath?: string;
  
  /**
   * Path to save downloads to
   */
  saveDownloadsPath?: string;
  
  /**
   * Path to save HAR files
   */
  saveHarPath?: string;
  
  /**
   * Path to save trace files
   */
  tracePath?: string;
  
  /**
   * Specify user locale, e.g., 'en-GB', 'de-DE'
   */
  locale?: string;
  
  /**
   * Custom user agent to use
   */
  userAgent?: string;
  
  /**
   * Highlight elements in the DOM on the screen
   * @default true
   */
  highlightElements?: boolean;
  
  /**
   * Viewport expansion in pixels for including elements in state
   * @default 0
   */
  viewportExpansion?: number;
  
  /**
   * List of allowed domains that can be accessed
   */
  allowedDomains?: string[];
  
  /**
   * Include dynamic attributes in the CSS selector
   * @default true
   */
  includeDynamicAttributes?: boolean;
  
  /**
   * HTTP credentials for authentication
   */
  httpCredentials?: { username: string; password: string };
  
  /**
   * Keep browser context alive after closing
   * @default false
   */
  keepAlive?: boolean;
  
  /**
   * Whether the meta viewport tag is taken into account and touch events are enabled
   */
  isMobile?: boolean;
  
  /**
   * Whether to enable touch events in the browser
   */
  hasTouch?: boolean;
  
  /**
   * Geolocation to be used in the browser context
   */
  geolocation?: { latitude: number; longitude: number };
  
  /**
   * Browser permissions to grant
   */
  permissions?: string[];
  
  /**
   * Changes the timezone of the browser
   */
  timezoneId?: string;
  
  /**
   * Forces a new browser context to be created
   * @default false
   */
  forceNewContext?: boolean;
}

/**
 * Interface for browser context initialization options
 */
interface BrowserContextInit {
  browser: Browser;
  config?: BrowserContextConfig;
}

/**
 * Class that handles browser context operations
 */
export class BrowserContext {
  private browser: Browser;
  private config: BrowserContextConfig;
  private playwrightBrowser: PlaywrightBrowser | null = null;
  private playwrightContext: PlaywrightBrowserContext | null = null;
  private currentPage: Page | null = null;
  private selectorMap: Record<number, any> = {};
  private selectorCounter: number = 0;
  
  /**
   * Create a new BrowserContext
   */
  constructor({ browser, config = {} }: BrowserContextInit) {
    this.browser = browser;
    this.config = this.getDefaultConfig();
    
    // Merge provided config with defaults
    Object.assign(this.config, config);
  }
  
  /**
   * Default configuration for browser context
   */
  private getDefaultConfig(): BrowserContextConfig {
    return {
      minimumWaitPageLoadTime: 0.25,
      waitForNetworkIdlePageLoadTime: 0.5,
      maximumWaitPageLoadTime: 5.0,
      waitBetweenActions: 0.5,
      disableSecurity: false,
      browserWindowSize: { width: 1280, height: 1100 },
      highlightElements: true,
      viewportExpansion: 0,
      includeDynamicAttributes: true,
      keepAlive: false,
      forceNewContext: false
    };
  }
  
  /**
   * Allow usage with 'async with' pattern
   */
  async init(): Promise<BrowserContext> {
    await this.initializeSession();
    return this;
  }
  
  /**
   * Get current browser state
   */
  async getState(): Promise<BrowserState> {
    const page = await this.getCurrentPage();
    
    if (!page) {
      return {
        selector_map: this.selectorMap
      };
    }
    
    // Getting basic page information
    const url = page.url();
    const title = await page.title();
    
    // Get all tabs information
    const context = await this.getContext();
    const tabs = context ? context.pages() : [];
    
    // Get tab info with resolved titles
    const tabPromises = tabs.map(async (tab) => {
      return {
        url: tab.url(),
        title: await tab.title()
      };
    });
    const tabsInfo = await Promise.all(tabPromises);
    
    // TODO: Implement screenshot functionality if needed
    
    // Populate the selector map with DOM elements from the page
    try {
      // Execute the DOM tree builder script to extract elements
      // This is similar to what's done in process_dom.test.ts
      const scriptPath = path.resolve(__dirname, '../dom/buildDomTree.js');
      const jsCode = await fs.promises.readFile(scriptPath, 'utf-8');
      
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
      
      // Check if the page has the evaluate method (Playwright typings)
      if ('evaluate' in page) {
        const domTree = await (page as any).evaluate(evalFn);
        
        // If we got a valid DOM tree, extract the selector map from it
        if (domTree && domTree.map) {
          this.selectorMap = {};
          
          // Convert the DOM tree to a selector map similar to what the Python version expects
          for (const [id, nodeData] of Object.entries(domTree.map)) {
            // Only add elements that are highlighted (interactive)
            const typedNodeData = nodeData as any;
            if (typedNodeData.highlightIndex !== undefined) {
              this.selectorMap[typedNodeData.highlightIndex] = {
                tagName: typedNodeData.tagName,
                attributes: typedNodeData.attributes || {},
                isVisible: typedNodeData.isVisible || false,
                isInteractive: typedNodeData.isInteractive || false,
              };
            }
          }
          
          console.log(`Populated selector map with ${Object.keys(this.selectorMap).length} elements`);
        }
      } else {
        console.warn('Page does not have evaluate method. Selector map will be empty.');
      }
    } catch (error) {
      console.error('Error populating selector map:', error);
    }
    
    return {
      url,
      title,
      tabs: tabsInfo,
      selector_map: this.selectorMap
    };
  }
  
  /**
   * Get the current page
   */
  async getCurrentPage(): Promise<Page | null> {
    if (!this.currentPage) {
      const context = await this.getContext();
      if (context) {
        const pages = context.pages();
        if (pages.length > 0) {
          this.currentPage = pages[0];
        }
      }
    }
    
    return this.currentPage;
  }
  
  /**
   * Get or create the Playwright context
   */
  async getContext(): Promise<PlaywrightBrowserContext | null> {
    if (!this.playwrightContext) {
      await this.initializeSession();
    }
    
    return this.playwrightContext;
  }
  
  /**
   * Initialize the browser session
   */
  private async initializeSession(): Promise<void> {
    // Get the Playwright browser instance
    this.playwrightBrowser = await this.browser.getPlaywrightBrowser();
    
    // Create a new context
    this.playwrightContext = await this.createContext(this.playwrightBrowser);
    
    // Get the first page or create one if not exists
    const pages = this.playwrightContext.pages();
    if (pages.length > 0) {
      this.currentPage = pages[0];
    } else {
      this.currentPage = await this.playwrightContext.newPage();
    }
    
    // Add event listeners to context
    this.addNewPageListener(this.playwrightContext);
  }
  
  /**
   * Create a new browser context
   */
  private async createContext(browser: PlaywrightBrowser): Promise<PlaywrightBrowserContext> {
    // Prepare context options
    const contextOptions: any = {
      viewport: this.config.noViewport ? null : {
        width: this.config.browserWindowSize?.width || 1280,
        height: this.config.browserWindowSize?.height || 1100
      },
      ignoreHTTPSErrors: this.config.disableSecurity || false,
      userAgent: this.config.userAgent,
      locale: this.config.locale,
      recordVideo: this.config.saveRecordingPath ? {
        dir: this.config.saveRecordingPath,
        size: {
          width: this.config.browserWindowSize ? this.config.browserWindowSize.width : 1280,
          height: this.config.browserWindowSize ? this.config.browserWindowSize.height : 1100
        }
      } : undefined,
      
      // Add more options based on config
      isMobile: this.config.isMobile,
      hasTouch: this.config.hasTouch,
      geolocation: this.config.geolocation,
      permissions: this.config.permissions,
      timezoneId: this.config.timezoneId,
      httpCredentials: this.config.httpCredentials
    };
    
    // Create the context
    const context = await browser.newContext(contextOptions);
    
    // Set up context tracing if trace path is provided
    if (this.config.tracePath) {
      // Check if tracing is available and start it
      if (context.tracing) {
        await context.tracing.start({ screenshots: true, snapshots: true });
      } else {
        console.warn('Tracing is not available in this Playwright context');
      }
    }
    
    return context;
  }
  
  /**
   * Add listener for new pages
   */
  private addNewPageListener(context: PlaywrightBrowserContext): void {
    context.on('page', async (page: Page) => {
      // Set the current page to the newly created one
      this.currentPage = page;
      
      // Add event handlers for page events if needed
      page.on('close', () => {
        if (this.currentPage === page) {
          this.currentPage = null;
        }
      });
    });
  }
  
  /**
   * Navigate to a URL
   */
  async navigateTo(url: string): Promise<void> {
    const page = await this.getCurrentPage();
    if (page) {
      // Check if URL is allowed
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        const isAllowed = this.isUrlAllowed(url);
        if (!isAllowed) {
          throw new Error(`URL ${url} is not in the allowed domains list`);
        }
      }
      
      // Navigate to the URL
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.maximumWaitPageLoadTime ? this.config.maximumWaitPageLoadTime * 1000 : 5000
      });
      
      // Wait for page to stabilize
      await this.waitForStableNetwork();
    }
  }
  
  /**
   * Wait for the network to become stable
   */
  private async waitForStableNetwork(): Promise<void> {
    const page = await this.getCurrentPage();
    if (!page) return;
    
    // Wait for network to be idle
    await page.waitForLoadState('networkidle', {
      timeout: this.config.waitForNetworkIdlePageLoadTime ? this.config.waitForNetworkIdlePageLoadTime * 1000 : 500
    }).catch(() => {
      // Ignore timeout errors, we'll proceed anyway
    });
    
    // Additional pause to ensure everything is loaded
    if (this.config.minimumWaitPageLoadTime) {
      const waitTime = this.config.minimumWaitPageLoadTime;
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
  }
  
  /**
   * Check if a URL is allowed
   */
  private isUrlAllowed(url: string): boolean {
    if (!this.config.allowedDomains || this.config.allowedDomains.length === 0) {
      return true;
    }
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Check if the hostname matches any of the allowed domains
      return this.config.allowedDomains.some(domain => {
        // Exact domain match
        if (hostname === domain) {
          return true;
        }
        
        // Subdomain match
        if (hostname.endsWith(`.${domain}`)) {
          return true;
        }
        
        return false;
      });
    } catch (e) {
      // Invalid URL, default to not allowed
      return false;
    }
  }
  
  /**
   * Take a screenshot of the current page
   */
  async takeScreenshot(fullPage: boolean = false): Promise<string> {
    const page = await this.getCurrentPage();
    if (!page) {
      throw new Error('No page available to take screenshot');
    }
    
    const screenshotBuffer = await page.screenshot({
      fullPage,
      type: 'jpeg',
      quality: 80
    });
    
    // Convert to base64
    return `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
  }
  
  /**
   * Close the browser context
   */
  async close(): Promise<void> {
    try {
      // Save tracing if enabled
      if (this.playwrightContext && this.config.tracePath) {
        // Check if tracing is available and stop it
        if (this.playwrightContext.tracing) {
          try {
            await this.playwrightContext.tracing.stop({
              path: `${this.config.tracePath}/trace.zip`
            });
          } catch (traceError) {
            console.error('Error stopping tracing:', traceError);
          }
        }
      }
      
      // Close the context if not set to keep alive
      if (!this.config.keepAlive && this.playwrightContext) {
        await this.playwrightContext.close();
        this.playwrightContext = null;
        this.currentPage = null;
      }
    } catch (error) {
      console.error('Error closing browser context:', error);
    }
  }
} 