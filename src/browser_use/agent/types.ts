/**
 * Type definitions for the agent module
 */

import { Page } from 'playwright';
import { BrowserStateHistory } from '../browser/types';
import { ActionModel } from '../controller/registry';

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
 * Message manager state interface
 */
export interface MessageManagerState {
  history: {
    messages: any[];
    current_tokens: number;
  };
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
 * Metadata for a single step including timing and token information
 */
export interface StepMetadata {
  step_start_time: number;
  step_end_time: number;
  input_tokens: number; // Approximate tokens from message manager for this step
  step_number: number;
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
export interface AgentOutput {
  current_state: AgentBrain;
  action: ActionModel[];
}

/**
 * History item for agent actions
 */
export interface AgentHistory {
  model_output: AgentOutput | null;
  result: ActionResult[];
  state: BrowserStateHistory;
  metadata?: StepMetadata;
}

/**
 * List of agent history items
 */
export interface AgentHistoryList {
  history: AgentHistory[];
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