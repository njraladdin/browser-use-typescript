/**
 * Type definitions for the telemetry module
 */

/**
 * Telemetry options for configuration
 */
export interface TelemetryOptions {
  enabled?: boolean;
  endpoint?: string;
  batchSize?: number;
}

/**
 * Telemetry event structure
 */
export interface TelemetryEvent {
  name: string;
  properties: Record<string, any>;
  timestamp: number;
}

/**
 * Telemetry event types
 */
export enum TelemetryEventType {
  PAGE_VISIT = 'page_visit',
  ELEMENT_CLICK = 'element_click',
  ELEMENT_TYPE = 'element_type',
  ERROR = 'error',
  AGENT_START = 'agent_start',
  AGENT_END = 'agent_end',
  DOM_EXTRACTION = 'dom_extraction'
} 