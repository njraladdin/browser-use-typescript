/**
 * Type definitions for the message manager module
 */

/**
 * Message manager settings
 */
export interface MessageManagerSettings {
  max_input_tokens: number;
  include_attributes: string[];
  message_context: string | null;
  sensitive_data: Record<string, string> | null;
  available_file_paths: string[] | null;
}

/**
 * Message manager state
 */
export interface MessageManagerState {
  history: MessageHistory;
}

/**
 * Message history
 */
export interface MessageHistory {
  messages: Message[];
  current_tokens: number;
}

/**
 * Message types
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
}

/**
 * Base message interface
 */
export interface Message {
  role: MessageRole;
  content: string;
}

/**
 * System message
 */
export interface SystemMessage extends Message {
  role: MessageRole.SYSTEM;
}

/**
 * User message
 */
export interface UserMessage extends Message {
  role: MessageRole.USER;
}

/**
 * Assistant message
 */
export interface AssistantMessage extends Message {
  role: MessageRole.ASSISTANT;
} 