/**
 * Telemetry module for browser-use-typescript
 * This module contains the Telemetry class responsible for collecting and reporting usage data
 */

import { TelemetryEvent, TelemetryOptions } from './types';
import { version } from '../../../package.json';

/**
 * Telemetry class for tracking usage
 */
export class Telemetry {
  private enabled: boolean;
  private events: TelemetryEvent[] = [];
  private options: TelemetryOptions;
  private sessionId: string;

  /**
   * Create a new Telemetry instance
   * @param options Telemetry configuration options
   */
  constructor(options: TelemetryOptions = {}) {
    // Generate a random session ID
    this.sessionId = Math.random().toString(36).substring(2, 15);
    
    this.options = {
      enabled: options.enabled ?? process.env.BROWSER_USE_TELEMETRY_ENABLED !== 'false',
      endpoint: options.endpoint ?? process.env.BROWSER_USE_TELEMETRY_ENDPOINT,
      batchSize: options.batchSize ?? 10
    };
    
    this.enabled = this.options.enabled;
    
    // Register shutdown handler
    process.on('beforeExit', () => {
      this.flush();
    });
  }

  /**
   * Track an event
   * @param event Event object or name
   * @param properties Additional properties
   */
  track(event: string | Partial<TelemetryEvent>, properties: Record<string, any> = {}): void {
    if (!this.enabled) return;
    
    const eventObj: TelemetryEvent = typeof event === 'string'
      ? {
          name: event,
          properties,
          timestamp: Date.now()
        }
      : {
          ...event,
          properties: { ...event.properties, ...properties },
          timestamp: event.timestamp || Date.now()
        };
    
    // Add standard properties
    eventObj.properties = {
      ...eventObj.properties,
      sessionId: this.sessionId,
      version,
      platform: process.platform,
      nodeVersion: process.version
    };
    
    this.events.push(eventObj);
    
    // Flush if we've reached the batch size
    if (this.events.length >= (this.options.batchSize || 10)) {
      this.flush();
    }
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Flush the event queue
   */
  async flush(): Promise<void> {
    if (!this.enabled || this.events.length === 0) return;
    
    const events = [...this.events];
    this.events = [];
    
    if (this.options.endpoint) {
      try {
        // Use fetch for modern environments and fallback to dynamic import
        if (typeof fetch === 'function') {
          await fetch(this.options.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ events })
          });
        } else {
          // Dynamic import for Node.js environments without fetch
          const { default: axios } = await import('axios');
          await axios.post(this.options.endpoint, { events });
        }
      } catch (error) {
        // Silently fail to avoid disrupting the application
        console.error('Failed to send telemetry:', error);
      }
    }
  }
}

// Export type definitions
export * from './types'; 