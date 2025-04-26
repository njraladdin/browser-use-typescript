declare module 'playwright' {
  export interface Browser {
    close(): Promise<void>;
    newContext(options?: BrowserContextOptions): Promise<BrowserContext>;
    connectOverCDP(endpointURL: string, options?: any): Promise<Browser>;
    connect(wsEndpoint: string, options?: any): Promise<Browser>;
  }

  export interface BrowserContext {
    pages(): Page[];
    newPage(): Promise<Page>;
    close(): Promise<void>;
    on(event: string, callback: Function): void;
    tracing?: {
      start(options?: { screenshots?: boolean; snapshots?: boolean }): Promise<void>;
      stop(options?: { path: string }): Promise<void>;
    };
  }

  export interface Page {
    url(): string;
    title(): Promise<string>;
    close(): Promise<void>;
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<any>;
    waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle', options?: { timeout?: number }): Promise<void>;
    screenshot(options?: { fullPage?: boolean; type?: string; quality?: number }): Promise<Buffer>;
    on(event: string, callback: Function): void;
  }

  export interface BrowserType<T> {
    launch(options?: any): Promise<T>;
    connectOverCDP(endpointURL: string, options?: any): Promise<Browser>;
    connect(wsEndpoint: string, options?: any): Promise<Browser>;
  }

  export interface BrowserContextOptions {
    viewport?: { width: number; height: number } | null;
    ignoreHTTPSErrors?: boolean;
    userAgent?: string;
    locale?: string;
    recordVideo?: {
      dir: string;
      size: { width: number; height: number };
    };
    isMobile?: boolean;
    hasTouch?: boolean;
    geolocation?: { latitude: number; longitude: number };
    permissions?: string[];
    timezoneId?: string;
    httpCredentials?: { username: string; password: string };
  }

  export const chromium: BrowserType<Browser>;
  export const firefox: BrowserType<Browser>;
  export const webkit: BrowserType<Browser>;
} 