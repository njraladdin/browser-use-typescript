/**
 * Agent view models and types
 * Based on the Python implementation in views.py
 */

import { v4 as uuidv4 } from 'uuid';
import { BrowserStateHistory } from '../browser/types';
import { DOMElement as BrowserDOMElement } from '../browser/types';
import { ActionModel } from '../controller/registry';
import { MessageManagerState } from './message_manager/types';

/**
 * Tool calling method types
 */
export type ToolCallingMethod = 'function_calling' | 'json_mode' | 'raw' | 'auto';

/**
 * Required environment variables for different LLM APIs
 */
export const REQUIRED_LLM_API_ENV_VARS: Record<string, string[]> = {
  'ChatOpenAI': ['OPENAI_API_KEY'],
  'AzureChatOpenAI': ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_KEY'],
  'ChatBedrockConverse': ['ANTHROPIC_API_KEY'],
  'ChatAnthropic': ['ANTHROPIC_API_KEY'],
  'ChatGoogleGenerativeAI': ['GEMINI_API_KEY'],
  'ChatDeepSeek': ['DEEPSEEK_API_KEY'],
  'ChatOllama': [],
  'ChatGrok': ['GROK_API_KEY'],
};

/**
 * Options for the agent
 */
export interface AgentSettings {
  use_vision: boolean;
  use_vision_for_planner: boolean;
  save_conversation_path: string | null;
  save_conversation_path_encoding: string | null;
  max_failures: number;
  retry_delay: number;
  max_input_tokens: number;
  validate_output: boolean;
  message_context: string | null;
  generate_gif: boolean | string;
  available_file_paths: string[] | null;
  override_system_message: string | null;
  extend_system_message: string | null;
  include_attributes: string[];
  max_actions_per_step: number;
  tool_calling_method: ToolCallingMethod | null;
  page_extraction_llm: any | null; // LLM reference type to be specified
  planner_llm: any | null; // LLM reference type to be specified
  planner_interval: number;
  is_planner_reasoning: boolean;
  extend_planner_system_message: string | null;
}

/**
 * Holds all state information for an Agent
 */
export interface AgentState {
  agent_id: string;
  n_steps: number;
  consecutive_failures: number;
  last_result: ActionResult[] | null;
  history: AgentHistoryList;
  last_plan: string | null;
  paused: boolean;
  stopped: boolean;
  message_manager_state: MessageManagerState;
}

/**
 * Extended AgentState type to handle the last_result type difference
 */
export interface ExtendedAgentState extends AgentState {
  last_result: ActionResult[] | null;
}

/**
 * Information about the current step
 */
export class AgentStepInfo {
  step_number: number;
  max_steps: number;

  constructor(step_number: number, max_steps: number) {
    this.step_number = step_number;
    this.max_steps = max_steps;
  }

  /**
   * Check if this is the last step
   */
  is_last_step(): boolean {
    return this.step_number >= this.max_steps - 1;
  }
}

/**
 * Result of executing an action
 */
export interface ActionResult {
  is_done?: boolean;
  success?: boolean;
  extracted_content?: string;
  error?: string;
  include_in_memory: boolean; // whether to include in past messages as context or not
}

/**
 * DOMHistoryElement type for browser state history
 */
export interface MappedDOMHistoryElement {
  tag: string;
  id?: string;
  classes: string[];
  text?: string;
  attributes?: Record<string, string>;
  rect?: DOMRect;
  visible?: boolean;
  enabled?: boolean;
}

/**
 * Metadata for a single step including timing and token information
 */
export class StepMetadata {
  step_start_time: number;
  step_end_time: number;
  input_tokens: number; // Approximate tokens from message manager for this step
  step_number: number;
  
  constructor(step_number: number, step_start_time: number, step_end_time: number, input_tokens: number) {
    this.step_number = step_number;
    this.step_start_time = step_start_time;
    this.step_end_time = step_end_time;
    this.input_tokens = input_tokens;
  }
  
  /**
   * Calculate step duration in seconds
   */
  get duration_seconds(): number {
    return this.step_end_time - this.step_start_time;
  }
}

/**
 * Current state of the agent
 */
export interface AgentBrain {
  evaluation_previous_goal: string;
  memory: string;
  next_goal: string;
}

/**
 * Output model for agent
 */
export class AgentOutput {
  current_state: AgentBrain;
  action: ActionModel[];
  
  constructor(current_state: AgentBrain, action: ActionModel[]) {
    this.current_state = current_state;
    this.action = action;
  }
  
  /**
   * Extend actions with custom actions
   * @param custom_actions Custom action model type
   * @returns Extended AgentOutput class with custom actions
   */
  static type_with_custom_actions(custom_actions: any): any {
    // In TypeScript, we can't dynamically create classes like in Python
    // So we'll create a new class that extends AgentOutput
    return class CustomAgentOutput extends AgentOutput {
      // The action property is implicitly typed as custom_actions[]
      declare action: any[];
      
      constructor(current_state: AgentBrain, action: any[]) {
        super(current_state, action);
      }
    };
  }
}

/**
 * History item for agent actions
 */
export class AgentHistory {
  model_output: AgentOutput | null;
  result: ActionResult[];
  state: BrowserStateHistory;
  metadata?: StepMetadata;
  
  constructor(model_output: AgentOutput | null, result: ActionResult[], state: BrowserStateHistory, metadata?: StepMetadata) {
    this.model_output = model_output;
    this.result = result;
    this.state = state;
    this.metadata = metadata;
  }

  /**
   * Get elements interacted with by the agent
   * @param model_output The model output containing actions
   * @param selector_map Map of selectors to DOM elements
   * @returns List of interacted elements
   */
  static get_interacted_element(model_output: AgentOutput, selector_map: Record<string, BrowserDOMElement>): (MappedDOMHistoryElement | null)[] {
    const elements: (MappedDOMHistoryElement | null)[] = [];
    
    for (const action of model_output.action) {
      const index = action.get_index?.();
      if (index !== undefined && index !== null && selector_map[index]) {
        const el = selector_map[index];
        elements.push({
          tag: el.tag,
          id: el.attributes?.id,
          classes: el.attributes?.class?.split(' ') || [],
          text: el.text,
          attributes: el.attributes,
          visible: undefined,
          enabled: undefined
        });
      } else {
        elements.push(null);
      }
    }
    
    return elements;
  }
  
  /**
   * Convert to JSON representation
   */
  toJSON(): Record<string, any> {
    // Handle action serialization
    let model_output_dump = null;
    if (this.model_output) {
      const action_dump = this.model_output.action.map(action => 
        typeof action.toJSON === 'function' ? action.toJSON() : action
      );
      
      model_output_dump = {
        current_state: this.model_output.current_state,
        action: action_dump
      };
    }
    
    return {
      model_output: model_output_dump,
      result: this.result.filter(r => r),
      state: this.state,
      metadata: this.metadata
    };
  }
}

/**
 * List of agent history items
 */
export class AgentHistoryList {
  history: AgentHistory[];
  
  constructor(history: AgentHistory[] = []) {
    this.history = history;
  }
  
  /**
   * Get total duration of all steps in seconds
   */
  total_duration_seconds(): number {
    let total = 0;
    for (const h of this.history) {
      if (h.metadata) {
        total += h.metadata.step_end_time - h.metadata.step_start_time;
      }
    }
    return total;
  }
  
  /**
   * Get total tokens used across all steps
   */
  total_input_tokens(): number {
    let total = 0;
    for (const h of this.history) {
      if (h.metadata) {
        total += h.metadata.input_tokens;
      }
    }
    return total;
  }
  
  /**
   * Get token usage for each step
   */
  input_token_usage(): number[] {
    return this.history
      .filter(h => h.metadata)
      .map(h => h.metadata!.input_tokens);
  }
  
  /**
   * Save history to JSON file
   */
  save_to_file(filepath: string): void {
    try {
      // Check if we're in Node.js environment
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        const fs = require('fs');
        const path = require('path');
        
        // Create directory if it doesn't exist
        const dirname = path.dirname(filepath);
        if (!fs.existsSync(dirname)) {
          fs.mkdirSync(dirname, { recursive: true });
        }
        
        // Write to file
        fs.writeFileSync(filepath, JSON.stringify(this.model_dump(), null, 2), 'utf-8');
        console.log(`Successfully saved history to ${filepath}`);
      } else {
        // Browser environment or other - use localStorage if available
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`agent_history_${filepath}`, JSON.stringify(this.model_dump()));
          console.log(`Saved history to localStorage with key: agent_history_${filepath}`);
        } else {
          console.warn(`Cannot save history to ${filepath} - no file system access in this environment`);
        }
      }
    } catch (e) {
      console.error(`Error saving history to ${filepath}:`, e);
    }
  }
  
  /**
   * Load history from JSON file
   */
  static load_from_file(filepath: string, output_model: any): AgentHistoryList {
    try {
      let data: any;
      
      // Check if we're in Node.js environment
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        const fs = require('fs');
        
        if (!fs.existsSync(filepath)) {
          throw new Error(`File not found: ${filepath}`);
        }
        
        const content = fs.readFileSync(filepath, 'utf-8');
        data = JSON.parse(content);
      } else {
        // Browser environment - try localStorage
        if (typeof localStorage !== 'undefined') {
          const content = localStorage.getItem(`agent_history_${filepath}`);
          if (!content) {
            throw new Error(`No saved history found with key: agent_history_${filepath}`);
          }
          data = JSON.parse(content);
        } else {
          throw new Error('No file system access in this environment');
        }
      }
      
      // Process the history data
      for (const h of data.history) {
        if (h.model_output) {
          // Create new output model instance with custom actions
          try {
            h.model_output = new output_model(h.model_output.current_state, h.model_output.action);
          } catch (e) {
            h.model_output = null;
          }
        }
        if (!h.state.interacted_element) {
          h.state.interacted_element = null;
        }
      }
      
      // Create new AgentHistoryList instance
      const historyItems = data.history.map((h: any) => {
        return new AgentHistory(
          h.model_output,
          h.result,
          h.state,
          h.metadata ? new StepMetadata(
            h.metadata.step_number,
            h.metadata.step_start_time,
            h.metadata.step_end_time,
            h.metadata.input_tokens
          ) : undefined
        );
      });
      
      return new AgentHistoryList(historyItems);
    } catch (e) {
      console.error(`Error loading history from ${filepath}:`, e);
      throw e;
    }
  }
  
  /**
   * Get last action in history
   */
  last_action(): Record<string, any> | null {
    if (this.history.length > 0 && this.history[this.history.length - 1].model_output) {
      const actions = this.history[this.history.length - 1].model_output!.action;
      if (actions.length > 0) {
        // Return the last action in the last model output
        return actions[actions.length - 1].toJSON();
      }
    }
    return null;
  }
  
  /**
   * Get all errors from history
   */
  errors(): (string | null)[] {
    return this.history.map(h => {
      const stepErrors = h.result
        .filter(r => r.error)
        .map(r => r.error);
      return stepErrors.length > 0 ? stepErrors[0]! : null;
    });
  }
  
  /**
   * Get final result from history
   */
  final_result(): string | null {
    if (this.history.length > 0 && this.history[this.history.length - 1].result.length > 0) {
      return this.history[this.history.length - 1].result[this.history[this.history.length - 1].result.length - 1].extracted_content || null;
    }
    return null;
  }
  
  /**
   * Check if the agent is done
   */
  is_done(): boolean {
    if (this.history.length > 0 && this.history[this.history.length - 1].result.length > 0) {
      return this.history[this.history.length - 1].result[this.history[this.history.length - 1].result.length - 1].is_done === true;
    }
    return false;
  }
  
  /**
   * Check if the agent completed successfully
   */
  is_successful(): boolean | null {
    if (this.history.length > 0 && this.history[this.history.length - 1].result.length > 0) {
      const lastResult = this.history[this.history.length - 1].result[this.history[this.history.length - 1].result.length - 1];
      if (lastResult.is_done === true) {
        return lastResult.success === true;
      }
    }
    return null;
  }
  
  /**
   * Check if the agent has any errors
   */
  has_errors(): boolean {
    return this.errors().some(error => error !== null);
  }
  
  /**
   * Get all URLs from history
   */
  urls(): (string | null)[] {
    return this.history.map(h => h.state.url || null);
  }
  
  /**
   * Get all screenshots from history
   */
  screenshots(): (string | null)[] {
    return this.history.map(h => h.state.screenshot || null);
  }
  
  /**
   * Get all action names from history
   */
  action_names(): string[] {
    const actionNames: string[] = [];
    for (const action of this.model_actions()) {
      const actions = Object.keys(action);
      if (actions.length > 0) {
        actionNames.push(actions[0]);
      }
    }
    return actionNames;
  }
  
  /**
   * Get all thoughts from history
   */
  model_thoughts(): AgentBrain[] {
    return this.history
      .filter(h => h.model_output)
      .map(h => h.model_output!.current_state);
  }
  
  /**
   * Get all model outputs from history
   */
  model_outputs(): AgentOutput[] {
    return this.history
      .filter(h => h.model_output)
      .map(h => h.model_output!);
  }
  
  /**
   * Get all actions from history
   */
  model_actions(): Record<string, any>[] {
    const outputs: Record<string, any>[] = [];
    for (const h of this.history) {
      if (h.model_output) {
        for (let i = 0; i < h.model_output.action.length; i++) {
          const action = h.model_output.action[i];
          const interactedElement = h.state.interacted_element && h.state.interacted_element[i] ? 
            h.state.interacted_element[i] : null;
          
          const output = action.toJSON();
          output.interacted_element = interactedElement;
          outputs.push(output);
        }
      }
    }
    return outputs;
  }
  
  /**
   * Get all results from history
   */
  action_results(): ActionResult[] {
    const results: ActionResult[] = [];
    for (const h of this.history) {
      results.push(...h.result.filter(r => r));
    }
    return results;
  }
  
  /**
   * Get all extracted content from history
   */
  extracted_content(): string[] {
    const content: string[] = [];
    for (const h of this.history) {
      content.push(...h.result
        .filter(r => r.extracted_content)
        .map(r => r.extracted_content!));
    }
    return content;
  }
  
  /**
   * Get model actions filtered by action type
   */
  model_actions_filtered(include: string[] | null = null): Record<string, any>[] {
    if (!include || include.length === 0) {
      return [];
    }
    
    const outputs = this.model_actions();
    const result: Record<string, any>[] = [];
    
    for (const o of outputs) {
      const actionType = Object.keys(o)[0];
      if (include.includes(actionType)) {
        result.push(o);
      }
    }
    
    return result;
  }
  
  /**
   * Get the number of steps in the history
   */
  number_of_steps(): number {
    return this.history.length;
  }
  
  /**
   * String representation of the AgentHistoryList
   * Equivalent to Python's __str__ and __repr__
   */
  toString(): string {
    return `AgentHistoryList(all_results=${JSON.stringify(this.action_results())}, all_model_outputs=${JSON.stringify(this.model_actions())})`;
  }

  /**
   * Custom serialization that properly uses AgentHistory's toJSON
   * Equivalent to Python's model_dump
   */
  model_dump(options: any = {}): Record<string, any> {
    return {
      history: this.history.map(h => 
        typeof h.toJSON === 'function' ? h.toJSON() : h
      )
    };
  }
}

/**
 * Container for agent error handling
 */
export class AgentError {
  static VALIDATION_ERROR = 'Invalid model output format. Please follow the correct schema.';
  static RATE_LIMIT_ERROR = 'Rate limit reached. Waiting before retry.';
  static NO_VALID_ACTION = 'No valid action found';

  /**
   * Format an error into a user-friendly message
   * @param error Exception object
   * @param include_trace Whether to include stack trace
   * @returns Formatted error message
   */
  static format_error(error: Error, include_trace: boolean = false): string {
    if (include_trace) {
      return `${error.message}\n${error.stack || ''}`;
    }
    return error.message;
  }
} 