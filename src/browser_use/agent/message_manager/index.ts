/**
 * Message manager for browser-use-typescript
 * This module handles the conversation between the agent and the LLM
 */

import { BrowserState } from '../../browser/types';
import { ActionResult, AgentStepInfo } from '../types';
import { 
  Message, 
  MessageManagerSettings, 
  MessageManagerState, 
  MessageRole, 
  SystemMessage, 
  UserMessage, 
  AssistantMessage 
} from './types';

/**
 * Approximate token count for a string
 * This is a simple estimation - proper tokenization depends on the specific model
 * @param text Text to estimate tokens for
 * @returns Approximate token count
 */
function estimateTokens(text: string): number {
  // A very simple estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Message manager class for managing conversation with LLM
 */
export class MessageManager {
  task: string;
  system_message: string;
  settings: MessageManagerSettings;
  state: MessageManagerState;

  /**
   * Create a new message manager
   * @param task The task to accomplish
   * @param system_message The system prompt
   * @param settings Message manager settings
   * @param state Optional initial state
   */
  constructor(
    task: string,
    system_message: string,
    settings: MessageManagerSettings,
    state?: MessageManagerState
  ) {
    this.task = task;
    this.system_message = system_message;
    this.settings = settings;
    
    // Initialize state or use provided state
    this.state = state || {
      history: {
        messages: [],
        current_tokens: 0
      }
    };

    // Initialize with system message if we're starting fresh
    if (!state || !state.history.messages.length) {
      this._addMessageWithTokens({
        role: MessageRole.SYSTEM,
        content: system_message
      });

      // Add the initial task as a user message
      this._addMessageWithTokens({
        role: MessageRole.USER,
        content: `Task: ${task}`
      });
    }
  }

  /**
   * Add a new message and count its tokens
   * @param message Message to add
   * @returns Estimated token count
   */
  _addMessageWithTokens(message: Message): number {
    const tokens = estimateTokens(message.content);
    this.state.history.messages.push(message);
    this.state.history.current_tokens += tokens;
    return tokens;
  }

  /**
   * Add a new task (replaces the current task)
   * @param new_task The new task
   */
  addNewTask(new_task: string): void {
    this.task = new_task;
    this._addMessageWithTokens({
      role: MessageRole.USER,
      content: `New task: ${new_task}`
    });
  }

  /**
   * Add state message with browser state
   * @param state Browser state
   * @param result Previous action results
   * @param step_info Step information
   * @param use_vision Whether to use vision
   */
  addStateMessage(
    state: BrowserState,
    result: ActionResult[] = [],
    step_info: AgentStepInfo | null = null,
    use_vision: boolean = true
  ): void {
    // Add result messages if they should be included in memory
    if (result && result.length > 0) {
      for (const r of result) {
        if (r.include_in_memory) {
          if (r.extracted_content) {
            this._addMessageWithTokens({
              role: MessageRole.USER,
              content: 'Action result: ' + r.extracted_content
            });
          }
          if (r.error) {
            // Get only the last line of the error
            const lastLine = r.error.split('\n').pop() || r.error;
            this._addMessageWithTokens({
              role: MessageRole.USER,
              content: 'Action error: ' + lastLine
            });
          }
        }
      }
    }
    
    // Create state message
    // In a full implementation, this would format the state properly
    const stateContent = this._formatStateMessage(state, result, step_info);
    const stateMessage: Message = {
      role: MessageRole.USER,
      content: stateContent
    };
    
    // Add vision data if enabled
    if (use_vision && state.screenshot) {
      (stateMessage as any).image_url = state.screenshot;
    }
    
    this._addMessageWithTokens(stateMessage);
  }
  
  /**
   * Format state message content
   */
  private _formatStateMessage(
    state: BrowserState,
    result: ActionResult[] | null,
    step_info: AgentStepInfo | null
  ): string {
    let content = `Current URL: ${state.url}\nPage title: ${state.title}\n\n`;
    
    // Add tabs information
    if (state.tabs && state.tabs.length > 0) {
      content += "Open Tabs:\n";
      state.tabs.forEach((tab, i) => {
        content += `${i + 1}. ${tab.title} (${tab.url})\n`;
      });
      content += "\n";
    }
    
    // Add interactive elements
    if (state.selector_map) {
      content += "Interactive Elements:\n";
      Object.entries(state.selector_map).forEach(([index, element]) => {
        content += `[${index}]<${element.tag}>${element.text || ''}</${element.tag}>\n`;
      });
    }
    
    // Add step info if provided
    if (step_info) {
      content += `\nStep ${step_info.step_number + 1}/${step_info.max_steps}`;
      if (step_info.is_last_step()) {
        content += " (Last step)";
      }
    }
    
    return content;
  }
  
  /**
   * Add a model output as an assistant message
   * @param model_output Model output to add
   */
  addModelOutput(model_output: any): void {
    // In a full implementation, this would handle the AI message with tool calls
    const message: Message = {
      role: MessageRole.ASSISTANT,
      content: JSON.stringify(model_output)
    };
    
    this._addMessageWithTokens(message);
  }
  
  /**
   * Add a message to the history
   * @param message Message to add
   */
  addMessage(message: Message): void {
    this._addMessageWithTokens(message);
  }
  
  /**
   * Remove the last state message
   * Alias for _removeLastStateMessage for consistency
   */
  removeLastStateMessage(): void {
    if (this.state.history.messages.length > 0) {
      const lastMessage = this.state.history.messages.pop();
      if (lastMessage) {
        this.state.history.current_tokens -= estimateTokens(lastMessage.content);
      }
    }
  }
  
  /**
   * Cut messages to fit within the token limit
   * Keeps removing oldest non-system messages until under the limit
   */
  cutMessages(): void {
    while (
      this.state.history.current_tokens > this.settings.max_input_tokens &&
      this.state.history.messages.length > 2
    ) {
      // Find first non-system message (starting from oldest)
      for (let i = 0; i < this.state.history.messages.length; i++) {
        const message = this.state.history.messages[i];
        if (message.role !== MessageRole.SYSTEM) {
          // Remove this message
          const tokenCount = estimateTokens(message.content);
          this.state.history.messages.splice(i, 1);
          this.state.history.current_tokens -= tokenCount;
          console.log(`Removed message to reduce tokens: ${this.state.history.current_tokens}/${this.settings.max_input_tokens}`);
          break;
        }
      }
    }
  }

  /**
   * Get all messages for sending to the LLM
   * @returns Array of messages
   */
  getMessages(): Message[] {
    // Apply token limit if needed
    this.cutMessages();
    return [...this.state.history.messages];
  }

  /**
   * Add a plan message from the planner
   * @param plan Plan text
   * @param position Position to insert the message (default is append)
   */
  addPlan(plan: string, position: number = -1): void {
    const planMessage: Message = {
      role: MessageRole.USER,
      content: `Plan: ${plan}`
    };
    
    if (position < 0 || position >= this.state.history.messages.length) {
      this._addMessageWithTokens(planMessage);
    } else {
      const tokens = estimateTokens(planMessage.content);
      this.state.history.messages.splice(position, 0, planMessage);
      this.state.history.current_tokens += tokens;
    }
  }
} 