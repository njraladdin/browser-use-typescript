/**
 * Browser Use TypeScript
 * A TypeScript port of the browser-use Python library
 * Make websites accessible for AI agents
 */

// Re-export components
export * from './browser_use/agent';
export * from './browser_use/browser';
export * from './browser_use/controller';
export * from './browser_use/dom';
export * from './browser_use/telemetry';

// Export version
export const VERSION = '0.1.0';

// Default export for convenience
import { Agent } from './browser_use/agent';
export default Agent;

// Export all browser-use functionality
export * from './browser_use/index';

// Export browser implementation
export { Browser } from './browser_use/browser/browser';
export { BrowserContext } from './browser_use/browser/context';

// Export browser types
export { 
  BrowserAction,
  BrowserActionType,
  BrowserActionResult,
  BrowserState,
  BrowserStateHistory,
  DOMHistoryElement
} from './browser_use/browser/types';

// Export configuration interfaces
export type { 
  BrowserConfig, 
  ProxySettings 
} from './browser_use/browser/browser';

export type {
  BrowserContextConfig,
  BrowserContextWindowSize
} from './browser_use/browser/context';

// Export chrome configuration
export * as chromeConfig from './browser_use/browser/chrome-config'; 