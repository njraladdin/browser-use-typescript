/**
 * Agent module for browser-use-typescript
 * Main agent class for automating browser tasks
 * 
 * Required dependencies for this TypeScript port:
 * - uuid (npm install uuid @types/uuid)
 * - playwright (npm install playwright)
 * 
 * The agent implementation has been ported from Python to TypeScript and
 * might require additional adjustments depending on your specific use case.
 */

import { v4 as uuidv4 } from 'uuid';
import { Browser } from '../browser';
import { BrowserContext } from '../browser/context';
import { BrowserState } from '../browser/types';
import { Controller } from '../controller';
import { ActionModel } from '../controller/registry';
import { Memory } from './memory';
import { MemoryConfig } from './memory/types';
import { MessageManager } from './message_manager';
import { MessageManagerSettings, MessageRole, MessageManagerState, MessageHistory } from './message_manager/types';
import { getSystemMessage } from './system_prompt';
import {
  ActionResult,
  AgentBrain,
  AgentError,
  AgentHistory,
  AgentHistoryList,
  AgentOutput,
  AgentSettings,
  AgentState,
  AgentStepInfo,
  StepMetadata,
  ToolCallingMethod,
} from './types';

// Default timeout for async operations
const DEFAULT_TIMEOUT = 30000;

// Default number of retry attempts
const MAX_RETRIES = 3;

/**
 * Agent class for browser automation
 */
export class Agent<Context = any> {
  task: string;
  llm: any; // LLM type will depend on your implementation
  controller: Controller<Context>;
  browser: Browser;
  browser_context: BrowserContext;
  settings: AgentSettings;
  state: AgentState;
  ActionModel!: typeof ActionModel; // Using definite assignment assertion
  AgentOutput: any;
  memory: Memory | null = null;
  enable_memory: boolean;
  context: Context | null = null;
  version: string = 'unknown';
  source: string = 'unknown';
  
  private _message_manager: MessageManager;
  private unfiltered_actions: string;
  private model_name: string = 'Unknown';
  private planner_model_name: string | null = null;
  private chat_model_library: string = 'Unknown';
  private tool_calling_method: ToolCallingMethod | null = null;
  private initial_actions: ActionModel[] | null = null;
  
  /**
   * Create a new Agent
   * @param task Task to execute
   * @param llm LLM instance
   * @param browser Optional browser instance
   * @param browser_context Optional browser context
   * @param controller Optional controller instance
   * @param sensitive_data Optional sensitive data to mask
   * @param initial_actions Optional initial actions to execute
   * @param register_new_step_callback Optional callback for new steps
   * @param register_done_callback Optional callback for when agent is done
   * @param register_external_agent_status_raise_error_callback Optional callback for checking external status
   * @param use_vision Whether to use vision
   * @param use_vision_for_planner Whether to use vision for planner
   * @param save_conversation_path Optional path to save conversation
   * @param save_conversation_path_encoding Optional encoding for saved conversation
   * @param max_failures Maximum consecutive failures before stopping
   * @param retry_delay Delay between retries in seconds
   * @param override_system_message Optional override for system message
   * @param extend_system_message Optional extension for system message
   * @param max_input_tokens Maximum input tokens for LLM
   * @param validate_output Whether to validate model output
   * @param message_context Optional additional message context
   * @param generate_gif Whether to generate GIF of history
   * @param available_file_paths Optional list of available file paths
   * @param include_attributes List of attributes to include in HTML elements
   * @param max_actions_per_step Maximum actions per step
   * @param tool_calling_method Method for tool calling
   * @param page_extraction_llm Optional LLM for page extraction
   * @param planner_llm Optional LLM for planning
   * @param planner_interval Interval for running planner
   * @param is_planner_reasoning Whether planner should include reasoning
   * @param extend_planner_system_message Optional extension for planner system message
   * @param injected_agent_state Optional injected agent state
   * @param context Optional context
   * @param enable_memory Whether to enable memory
   * @param memory_config Optional memory configuration
   */
  constructor(
    task: string,
    llm: any,
    browser: Browser | null = null,
    browser_context: BrowserContext | null = null,
    controller: Controller<Context> = new Controller(),
    sensitive_data: Record<string, string> | null = null,
    initial_actions: Array<Record<string, Record<string, any>>> | null = null,
    register_new_step_callback: ((state: BrowserState, model_output: AgentOutput, step: number) => void | Promise<void>) | null = null,
    register_done_callback: ((history: AgentHistoryList) => void | Promise<void>) | null = null,
    register_external_agent_status_raise_error_callback: (() => Promise<boolean>) | null = null,
    use_vision: boolean = true,
    use_vision_for_planner: boolean = false,
    save_conversation_path: string | null = null,
    save_conversation_path_encoding: string | null = null,
    max_failures: number = 3,
    retry_delay: number = 10,
    override_system_message: string | null = null,
    extend_system_message: string | null = null,
    max_input_tokens: number = 128000,
    validate_output: boolean = false,
    message_context: string | null = null,
    generate_gif: boolean | string = false,
    available_file_paths: string[] | null = null,
    include_attributes: string[] = [
      'title',
      'type',
      'name',
      'role',
      'aria-label',
      'placeholder',
      'value',
      'alt',
      'aria-expanded',
      'data-date-format',
    ],
    max_actions_per_step: number = 10,
    tool_calling_method: ToolCallingMethod | null = 'auto',
    page_extraction_llm: any | null = null,
    planner_llm: any | null = null,
    planner_interval: number = 1,
    is_planner_reasoning: boolean = false,
    extend_planner_system_message: string | null = null,
    injected_agent_state: AgentState | null = null,
    context: Context | null = null,
    enable_memory: boolean = true,
    memory_config: Partial<MemoryConfig> | null = null
  ) {
    if (page_extraction_llm === null) {
      page_extraction_llm = llm;
    }
    
    // Core components
    this.task = task;
    this.llm = llm;
    this.controller = controller;
    
    // Settings
    this.settings = {
      use_vision,
      use_vision_for_planner,
      save_conversation_path,
      save_conversation_path_encoding,
      max_failures,
      retry_delay,
      override_system_message,
      extend_system_message,
      max_input_tokens,
      validate_output,
      message_context,
      generate_gif,
      available_file_paths,
      include_attributes,
      max_actions_per_step,
      tool_calling_method,
      page_extraction_llm,
      planner_llm,
      planner_interval,
      is_planner_reasoning,
      extend_planner_system_message
    };
    
    // State
    this.state = injected_agent_state || {
      agent_id: uuidv4(),
      n_steps: 1,
      consecutive_failures: 0,
      last_result: null,
      history: { history: [] },
      last_plan: null,
      paused: false,
      stopped: false,
      message_manager_state: {
        history: {
          messages: [],
          current_tokens: 0
        }
      }
    };
    
    // Memory settings
    this.enable_memory = enable_memory;
    this.context = context;
    
    // Set up action models from registry
    this._setupActionModels();
    
    // Set browser-use version and source
    this._setBrowserUseVersionAndSource();
    
    // Set model names
    this._setModelNames();
    this.tool_calling_method = this._setToolCallingMethod();
    
    // Handle vision limitations for certain models
    if (this.model_name.toLowerCase().includes('deepseek')) {
      console.warn('⚠️ DeepSeek models do not support use_vision=True yet. Setting use_vision=False for now...');
      this.settings.use_vision = false;
    }
    if ((this.planner_model_name || '').toLowerCase().includes('deepseek')) {
      console.warn('⚠️ DeepSeek models do not support use_vision=True yet. Setting use_vision_for_planner=False for now...');
      this.settings.use_vision_for_planner = false;
    }
    if (this.model_name.toLowerCase().includes('grok')) {
      console.warn('⚠️ XAI models do not support use_vision=True yet. Setting use_vision=False for now...');
      this.settings.use_vision = false;
    }
    if ((this.planner_model_name || '').toLowerCase().includes('grok')) {
      console.warn('⚠️ XAI models do not support use_vision=True yet. Setting use_vision_for_planner=False for now...');
      this.settings.use_vision_for_planner = false;
    }
    
    // Log agent configuration
    console.log(
      `🧠 Starting an agent with main_model=${this.model_name}` +
      `${this.tool_calling_method === 'function_calling' ? ' +tools' : ''}` +
      `${this.tool_calling_method === 'raw' ? ' +rawtools' : ''}` +
      `${this.settings.use_vision ? ' +vision' : ''}` +
      `${this.enable_memory ? ' +memory' : ''}, ` +
      `planner_model=${this.planner_model_name}` +
      `${this.settings.is_planner_reasoning ? ' +reasoning' : ''}` +
      `${this.settings.use_vision_for_planner ? ' +vision' : ''}, ` +
      `extraction_model=${page_extraction_llm ? 'configured' : 'none'}`
    );
    
    // Initialize available actions for system prompt
    this.unfiltered_actions = this.controller.registry.getPromptDescription();
    
    // Set message context
    this.settings.message_context = this._setMessageContext();
    
    // Initialize message manager
    this._message_manager = new MessageManager(
      task,
      getSystemMessage(
        this.unfiltered_actions,
        this.settings.max_actions_per_step,
        this.settings.override_system_message || undefined,
        this.settings.extend_system_message || undefined
      ),
      {
        max_input_tokens: this.settings.max_input_tokens,
        include_attributes: this.settings.include_attributes,
        message_context: this.settings.message_context || null,
        sensitive_data: sensitive_data || null,
        available_file_paths: this.settings.available_file_paths
      },
      {
        history: this.state.message_manager_state.history || { messages: [], current_tokens: 0 }
      }
    );
    
    // Initialize memory if enabled
    if (this.enable_memory) {
      try {
        this.memory = new Memory(
          this._message_manager,
          this.llm,
          memory_config || undefined
        );
        console.log('Memory system initialized');
      } catch (error) {
        console.warn('Failed to initialize memory system, memory will be disabled:', error);
        this.memory = null;
        this.enable_memory = false;
      }
    }
    
    // Browser setup
    const injected_browser = browser !== null;
    const injected_browser_context = browser_context !== null;
    this.browser = browser || new Browser();
    this.browser_context = browser_context || new BrowserContext({
      browser: this.browser as any, // Type cast to fix compatibility issues
      config: {} // Use default config
    });
    
    // Initial actions
    if (initial_actions) {
      this.initial_actions = this._convertInitialActions(initial_actions);
    }
    
    // Save path notification
    if (this.settings.save_conversation_path) {
      console.log(`Saving conversation to ${this.settings.save_conversation_path}`);
    }
  }
  
  /**
   * Set message context for the agent
   */
  private _setMessageContext(): string | null {
    if (this.tool_calling_method === 'raw') {
      // For raw tool calling, include actions in the message context
      if (this.settings.message_context) {
        return this.settings.message_context + `\n\nAvailable actions: ${this.unfiltered_actions}`;
      } else {
        return `Available actions: ${this.unfiltered_actions}`;
      }
    }
    return this.settings.message_context;
  }
  
  /**
   * Set up action models from controller's registry
   */
  private _setupActionModels(): void {
    this.ActionModel = this.controller.registry.createActionModel();
    this.AgentOutput = {
      current_state: {
        evaluation_previous_goal: '',
        memory: '',
        next_goal: ''
      },
      action: []
    };
  }
  
  /**
   * Set browser-use version and source information
   */
  private _setBrowserUseVersionAndSource(): void {
    this.version = 'typescript-port';
    this.source = 'browser-use-typescript';
  }
  
  /**
   * Convert initial actions to action models
   * @param actions Initial actions in JSON format
   * @returns Action models
   */
  private _convertInitialActions(actions: Array<Record<string, Record<string, any>>>): ActionModel[] {
    const result: ActionModel[] = [];
    
    for (const action of actions) {
      const actionType = Object.keys(action)[0];
      const actionParams = action[actionType];
      
      const actionModel = new this.ActionModel();
      (actionModel as any)[actionType] = actionParams;
      
      result.push(actionModel);
    }
    
    return result;
  }
  
  /**
   * Set model names based on LLM instance
   */
  private _setModelNames(): void {
    this.chat_model_library = this.llm.constructor?.name || 'Unknown';
    this.model_name = 'Unknown';
    
    if ('model_name' in this.llm) {
      this.model_name = this.llm.model_name || 'Unknown';
    } else if ('model' in this.llm) {
      this.model_name = this.llm.model || 'Unknown';
    }
    
    if (this.settings.planner_llm) {
      if ('model_name' in this.settings.planner_llm) {
        this.planner_model_name = this.settings.planner_llm.model_name;
      } else if ('model' in this.settings.planner_llm) {
        this.planner_model_name = this.settings.planner_llm.model;
      } else {
        this.planner_model_name = 'Unknown';
      }
    } else {
      this.planner_model_name = null;
    }
  }
  
  /**
   * Set tool calling method based on model type
   */
  private _setToolCallingMethod(): ToolCallingMethod | null {
    const toolCallingMethod = this.settings.tool_calling_method;
    
    if (toolCallingMethod === 'auto') {
      if (this.model_name.includes('deepseek-reasoner') || this.model_name.includes('deepseek-r1')) {
        return 'raw';
      } else if (this.chat_model_library === 'ChatGoogleGenerativeAI') {
        return null;
      } else if (this.chat_model_library === 'ChatOpenAI' || this.chat_model_library === 'AzureChatOpenAI') {
        return 'function_calling';
      } else {
        return null;
      }
    } else {
      return toolCallingMethod;
    }
  }
  
  /**
   * Get the message manager
   */
  get message_manager(): MessageManager {
    return this._message_manager;
  }
  
  /**
   * Execute one step of the task
   * @param step_info Information about the current step
   */
  async step(step_info?: AgentStepInfo): Promise<void> {
    console.log(`📍 Step ${this.state.n_steps}`);
    let state: BrowserState | null = null;
    let model_output: AgentOutput | null = null;
    let result: ActionResult[] = [];
    const step_start_time = Date.now() / 1000;
    let tokens = 0;

    try {
      // Get browser state
      state = await this._getBrowserState();
      
      // Generate procedural memory if enabled
      if (this.enable_memory && this.memory) {
        const memoryInterval = 5; // Default interval if config can't be accessed
        this.memory.createProceduralMemory(this.state.n_steps);
      }
      
      // Check if agent is paused or stopped
      await this._raiseIfStoppedOrPaused();
      
      // Update action models for current page
      await this._updateActionModelsForPage(await this.browser.getCurrentPage());
      
      // Get page-specific filtered actions
      const page_filtered_actions = this.controller.registry.getPromptDescription(await this.browser.getCurrentPage());
      
      // If there are page-specific actions, add them to the message context for this step only
      if (page_filtered_actions) {
        const page_action_message = `For this page, these additional actions are available:\n${page_filtered_actions}`;
        this._message_manager.addMessage({
          role: MessageRole.USER,
          content: page_action_message
        });
      }
      
      // Update message context for raw tool calling if needed
      if (this.tool_calling_method === 'raw') {
        // Get all available actions
        const all_unfiltered_actions = this.controller.registry.getPromptDescription();
        let all_actions = all_unfiltered_actions;
        if (page_filtered_actions) {
          all_actions += '\n' + page_filtered_actions;
        }
        
        // Update message context with the new actions
        const context_lines = (this._message_manager.settings.message_context || '').split('\n');
        const non_action_lines = context_lines.filter(line => !line.startsWith('Available actions:'));
        let updated_context = non_action_lines.join('\n');
        
        if (updated_context) {
          updated_context += `\n\nAvailable actions: ${all_actions}`;
        } else {
          updated_context = `Available actions: ${all_actions}`;
        }
        
        this._message_manager.settings.message_context = updated_context;
      }
      
      // Add state message with current browser state
      this._message_manager.addStateMessage(
        state, 
        this.state.last_result || [], 
        step_info, 
        this.settings.use_vision
      );
      
      // Run planner at specified intervals if planner is configured
      if (this.settings.planner_llm && this.state.n_steps % this.settings.planner_interval === 0) {
        const plan = await this._runPlanner();
        if (plan) {
          this._message_manager.addPlan(plan);
        }
      }
      
      // Add last step warning if needed
      if (step_info && step_info.is_last_step()) {
        const msg = 'Now comes your last step. Use only the "done" action now. No other actions - so here your action sequence must have length 1.\n' +
                    'If the task is not yet fully finished as requested by the user, set success in "done" to false! E.g. if not all steps are fully completed.\n' +
                    'If the task is fully finished, set success in "done" to true.\n' +
                    'Include everything you found out for the ultimate task in the done text.';
        console.log('Last step finishing up');
        this._message_manager.addMessage({
          role: MessageRole.USER,
          content: msg
        });
        
        // Force the done action
        this.AgentOutput = {
          // Copy whatever was in the original AgentOutput and replace the action
          ...this.AgentOutput,
          // Add logic to force the 'done' action only
        };
      }
      
      // Get input messages for the LLM
      const input_messages = this._message_manager.getMessages();
      tokens = this._message_manager.state.history.current_tokens;
      
      try {
        // Get the next action from the LLM
        model_output = await this._getNextAction(input_messages);
        
        // Check again for paused/stopped state after getting model output
        await this._raiseIfStoppedOrPaused();
        
        // Increment step counter
        this.state.n_steps += 1;
        
        // Save conversation if path is provided
        if (this.settings.save_conversation_path) {
          const target = `${this.settings.save_conversation_path}_${this.state.n_steps}.txt`;
          this._saveConversation(input_messages, model_output, target);
        }
        
        // Remove the state message from history to reduce token usage
        this._message_manager.removeLastStateMessage();
        
        // Check again if paused or stopped before committing output to history
        await this._raiseIfStoppedOrPaused();
        
        // Add model output to message history
        this._message_manager.addModelOutput(model_output);
      } catch (error) {
        // Remove the state message from history
        this._message_manager.removeLastStateMessage();
        
        // Handle different error types
        if (error instanceof Error && error.message === 'Agent paused or stopped') {
          throw error; // Re-throw to be caught by the outer try/except
        } else {
          // For other errors, rethrow
          throw error;
        }
      }
      
      // Execute the actions
      result = await this._multiAct(model_output.action);
      
      // Store the result
      this.state.last_result = result;
      
      // Reset consecutive failures counter on success
      this.state.consecutive_failures = 0;
      
      // Log the result if it's a 'done' action
      if (result.length > 0 && result[result.length - 1].is_done) {
        console.log(`📄 Result: ${result[result.length - 1].extracted_content}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Agent paused or stopped') {
        // Agent was paused or stopped mid-step
        this.state.last_result = [{
          error: 'The agent was paused mid-step - the last action might need to be repeated',
          include_in_memory: false
        }];
        return;
      } else {
        // Other errors
        result = await this._handleStepError(error as Error);
        this.state.last_result = result;
      }
    } finally {
      const step_end_time = Date.now() / 1000;
      
      // Create history item if we have state and result
      if (state && model_output) {
        const metadata: StepMetadata = {
          step_number: this.state.n_steps,
          step_start_time,
          step_end_time,
          input_tokens: tokens
        };
        
        this._makeHistoryItem(model_output, state, result, metadata);
      }
    }
  }
  
  /**
   * Check if agent is paused or stopped and raise an error if so
   * @throws Error if agent is paused or stopped
   */
  private async _raiseIfStoppedOrPaused(): Promise<void> {
    if (this.state.stopped || this.state.paused) {
      throw new Error('Agent paused or stopped');
    }
  }
  
  /**
   * Save conversation to file
   * @param input_messages Input messages sent to LLM
   * @param model_output Model output received from LLM
   * @param target_path Path to save the conversation
   */
  private _saveConversation(input_messages: any[], model_output: AgentOutput, target_path: string): void {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Create directory if it doesn't exist
      const dir = path.dirname(target_path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Format conversation
      const conversation = {
        input_messages,
        model_output
      };
      
      // Write to file
      fs.writeFileSync(
        target_path, 
        JSON.stringify(conversation, null, 2), 
        { encoding: this.settings.save_conversation_path_encoding || 'utf-8' }
      );
      
      console.log(`Saved conversation to ${target_path}`);
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }
  
  /**
   * Run the agent for a specified number of steps
   * @param max_steps Maximum number of steps to run
   * @returns Agent history list
   */
  async run(max_steps: number = 100): Promise<AgentHistoryList> {
    console.log(`🚀 Starting agent run with max_steps=${max_steps}`);
    this.state.paused = false;
    this.state.stopped = false;
    
    try {
      // Execute initial actions if provided
      // (This would be implemented in a full version)
      
      // Main loop
      while (this.state.n_steps < max_steps && !this.state.stopped) {
        if (this.state.paused) {
          console.log('Agent is paused. Waiting to resume...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        try {
          // Create step info
          const step_info = new AgentStepInfo(this.state.n_steps, max_steps);
          
          // Execute step
          await this.step(step_info);
          
          // Check if task is complete
          if (this.state.last_result && 
              this.state.last_result.length > 0 && 
              this.state.last_result[this.state.last_result.length - 1].is_done) {
            console.log('🎉 Task completed successfully');
            break;
          }
          
          // Check for max failures
          if (this.state.consecutive_failures >= this.settings.max_failures) {
            console.error(`❌ Reached maximum consecutive failures (${this.settings.max_failures}), aborting.`);
            break;
          }
        } catch (error) {
          console.error('Error during step execution:', error);
          // Don't increment consecutive failures here, that's handled in step()
        }
      }
      
      if (this.state.n_steps >= max_steps) {
        console.log(`⏱️ Reached maximum steps (${max_steps})`);
      }
      
      // Generate a completion GIF if requested
      if (this.settings.generate_gif) {
        await this._generateGif();
      }
      
      // Return the history
      return { ...this.state.history };
    } catch (error) {
      console.error('Error running agent:', error);
      throw error;
    }
  }
  
  /**
   * Generate a GIF of the agent's history
   * This is a placeholder for the actual implementation
   */
  private async _generateGif(): Promise<void> {
    console.log('Generating GIF of agent history is not implemented in this version');
    // In a full implementation, this would create a GIF from screenshots in history
  }
  
  /**
   * Handle errors that occur during a step
   * @param error Error that occurred
   * @returns List of action results with error information
   */
  private async _handleStepError(error: Error): Promise<ActionResult[]> {
    const include_trace = true; // Set based on log level in a full implementation
    const error_msg = AgentError.format_error(error, include_trace);
    const prefix = `❌ Result failed ${this.state.consecutive_failures + 1}/${this.settings.max_failures} times:\n`;
    
    this.state.consecutive_failures += 1;
    
    // Check for specific error types
    if (error_msg.includes('Browser closed')) {
      console.error('❌ Browser is closed or disconnected, unable to proceed');
      return [{
        error: 'Browser closed or disconnected, unable to proceed',
        include_in_memory: false
      }];
    }
    
    if (error instanceof Error) {
      if (error.message.includes('Max token limit reached')) {
        console.error(`${prefix}${error_msg}`);
        
        // Cut tokens from history
        this._message_manager.settings.max_input_tokens = this.settings.max_input_tokens - 500;
        console.log(`Cutting tokens from history - new max input tokens: ${this._message_manager.settings.max_input_tokens}`);
        this._message_manager.cutMessages();
      } else if (error.message.includes('Could not parse response')) {
        console.error(`${prefix}${error_msg}`);
        return [{
          error: `${error_msg}\n\nReturn a valid JSON object with the required fields.`,
          include_in_memory: true
        }];
      } else if (error.message.includes('Rate limit')) {
        console.warn(`${prefix}${error_msg}`);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.settings.retry_delay * 1000));
      } else {
        console.error(`${prefix}${error_msg}`);
      }
    } else {
      console.error(`${prefix}Unknown error: ${error_msg}`);
    }
    
    return [{
      error: error_msg,
      include_in_memory: true
    }];
  }
  
  /**
   * Execute multiple actions in sequence
   * @param actions List of actions to execute
   * @returns List of action results
   */
  private async _multiAct(actions: ActionModel[]): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    
    if (!actions || actions.length === 0) {
      console.warn('No actions to execute');
      return [{
        error: 'No actions provided',
        include_in_memory: true
      }];
    }
    
    console.log(`Executing ${actions.length} actions`);
    
    // Check if we're exceeding the maximum actions per step
    if (actions.length > this.settings.max_actions_per_step) {
      console.warn(`Too many actions (${actions.length}), limiting to ${this.settings.max_actions_per_step}`);
      actions = actions.slice(0, this.settings.max_actions_per_step);
    }
    
    // Execute each action in sequence
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(`Executing action ${i + 1}/${actions.length}: ${JSON.stringify(action)}`);
      
      try {
        // Get the action type (only one key per action)
        const actionKeys = Object.keys(action).filter(key => key !== 'model_dump_json');
        if (actionKeys.length !== 1) {
          throw new Error(`Invalid action format: Each action must have exactly one action type`);
        }
        
        const actionType = actionKeys[0];
        const actionParams = action[actionType];
        
        // Execute the action
        let result: ActionResult;
        
        if (actionType === 'done') {
          // Special handling for 'done' action
          result = {
            is_done: true,
            success: actionParams.success || false,
            extracted_content: actionParams.text || 'Task completed',
            include_in_memory: true
          };
        } else {
          // Execute the action through the controller
          result = await this.controller.executeAction(actionType, actionParams, this.browser);
          result.include_in_memory = true;
        }
        
        results.push(result);
        
        // If there was an error, stop executing actions
        if (result.error) {
          console.error(`Error executing action ${i + 1}: ${result.error}`);
          break;
        }
        
        // If we need to check for new elements after this action
        if (i < actions.length - 1) {
          // Update browser state if needed
          // This would be implemented in a full version
        }
      } catch (error) {
        const errorResult: ActionResult = {
          error: error instanceof Error ? error.message : String(error),
          include_in_memory: true
        };
        results.push(errorResult);
        break;
      }
    }
    
    return results;
  }
  
  /**
   * Create and store history item
   * @param model_output Model output
   * @param state Browser state
   * @param result Action results
   * @param metadata Metadata for the step
   */
  private _makeHistoryItem(
    model_output: AgentOutput,
    state: BrowserState,
    result: ActionResult[],
    metadata?: StepMetadata
  ): void {
    // In a full implementation, this would map interacted elements
    const interacted_elements = model_output && model_output.action ? 
      this._getInteractedElements(model_output, state.selector_map) : [null];
    
    const state_history = {
      url: state.url,
      title: state.title,
      tabs: state.tabs,
      interacted_element: interacted_elements,
      screenshot: state.screenshot
    };
    
    const history_item: AgentHistory = {
      model_output,
      result,
      state: state_history,
      metadata
    };
    
    this.state.history.history.push(history_item);
  }
  
  /**
   * Get elements that were interacted with in an action
   * @param model_output Model output with actions
   * @param selector_map Map of selectors to elements
   * @returns List of interacted elements
   */
  private _getInteractedElements(model_output: AgentOutput, selector_map: Record<string, any> | null): any[] {
    if (!model_output || !model_output.action || model_output.action.length === 0 || !selector_map) {
      return [null];
    }
    
    const interacted_elements: any[] = [];
    
    for (const action of model_output.action) {
      const actionKeys = Object.keys(action).filter(key => key !== 'model_dump_json');
      if (actionKeys.length !== 1) {
        continue;
      }
      
      const actionType = actionKeys[0];
      const actionParams = action[actionType];
      
      if (actionType === 'click_element' && 'index' in actionParams) {
        const index = actionParams.index;
        const element = selector_map[index.toString()];
        interacted_elements.push(element);
      } else if (actionType === 'input_text' && 'index' in actionParams) {
        const index = actionParams.index;
        const element = selector_map[index.toString()];
        interacted_elements.push(element);
      } else {
        interacted_elements.push(null);
      }
    }
    
    return interacted_elements;
  }
  
  /**
   * Get the browser state
   * @returns Browser state
   */
  private async _getBrowserState(): Promise<BrowserState> {
    try {
      return await this.browser.getState();
    } catch (error) {
      console.error('Error getting browser state:', error);
      throw error;
    }
  }
  
  /**
   * Run the planner LLM to get the next steps
   * @returns Planner output or null if planner is not configured
   */
  private async _runPlanner(): Promise<string | null> {
    if (!this.settings.planner_llm) {
      return null;
    }
    
    console.log('Running planner...');
    
    try {
      // Get the current browser state
      const state = await this._getBrowserState();
      
      // Prepare planner prompt
      const plannerPrompt = this._createPlannerPrompt(state);
      
      // Call planner LLM
      const plannerResponse = await this.settings.planner_llm.invoke(plannerPrompt);
      
      // Extract and return planner content
      return plannerResponse.content;
    } catch (error) {
      console.error('Error running planner:', error);
      return null;
    }
  }
  
  /**
   * Create prompt for the planner
   * @param state Current browser state
   * @returns Planner prompt
   */
  private _createPlannerPrompt(state: BrowserState): any[] {
    // Create system message for planner
    const systemMessage = {
      role: 'system',
      content: `You are an AI planner that helps analyze web pages and create plans for web automation tasks. 
Your goal is to assist with the following task: ${this.task}

Based on the current browser state and history, create a plan for the next steps to complete the task.
Be specific about what actions to take and what information to gather.

${this.settings.extend_planner_system_message || ''}`
    };
    
    // Create user message with browser state
    const userMessage = {
      role: 'user',
      content: `Current URL: ${state.url}
Page title: ${state.title}
Number of steps taken so far: ${this.state.n_steps}

Please analyze the current state and provide a detailed plan for the next few steps.
${this.settings.is_planner_reasoning ? 'Include your reasoning about why these steps are appropriate.' : ''}
`
    };
    
    // If vision is enabled for planner, add the screenshot
    if (this.settings.use_vision_for_planner && state.screenshot) {
      userMessage.content += '\nThe current page looks like this:';
      (userMessage as any).image_url = state.screenshot;
    }
    
    return [systemMessage, userMessage];
  }
  
  /**
   * Update action models for the current page
   */
  private async _updateActionModelsForPage(page: any): Promise<void> {
    if (!page) {
      return;
    }
    
    // Update action models with page-specific actions
    // In a real implementation, this would filter actions based on page
    try {
      // Create action model with actions appropriate for this page
      this.ActionModel = this.controller.registry.createActionModel(page);
      
      // Update AgentOutput type with the new action model
      this.AgentOutput = {
        current_state: {
          evaluation_previous_goal: '',
          memory: '',
          next_goal: ''
        },
        action: []
      };
    } catch (error) {
      console.error('Error updating action models for page:', error);
    }
  }
  
  /**
   * Pause the agent
   */
  pause(): void {
    console.log('Agent paused');
    this.state.paused = true;
  }
  
  /**
   * Resume the agent
   */
  resume(): void {
    console.log('Agent resumed');
    this.state.paused = false;
  }
  
  /**
   * Stop the agent permanently
   */
  stop(): void {
    console.log('Agent stopped');
    this.state.stopped = true;
  }
  
  /**
   * Close the agent and release resources
   */
  async close(): Promise<void> {
    console.log('Closing agent...');
    
    // Clean up memory
    if (this.memory) {
      // Memory cleanup
    }
    
    // Close browser if we created it
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
    
    console.log('Agent closed');
  }
  
  /**
   * Get the next action from the LLM
   * @param input_messages Input messages for the LLM
   * @returns The next action to take
   */
  private async _getNextAction(input_messages: any[]): Promise<AgentOutput> {
    try {
      // This implementation will vary based on the LLM library
      // For now, we'll provide a simple implementation
      
      let response;
      
      // Handle different tool calling methods
      if (this.tool_calling_method === 'function_calling') {
        // Function calling for models that support it (e.g., OpenAI)
        response = await this.llm.invoke(input_messages, {
          tools: this._getFunctionCallingTools(),
          tool_choice: 'auto'
        });
        
        // Parse the function calling response
        return this._parseFunctionCallingResponse(response);
      } else if (this.tool_calling_method === 'raw') {
        // Raw tool calling for models that only support text
        response = await this.llm.invoke(input_messages);
        
        // Parse the raw response
        return this._parseRawResponse(response);
      } else {
        // Standard format for most models
        response = await this.llm.invoke(input_messages);
        
        // Parse the standard response
        return this._parseStandardResponse(response);
      }
    } catch (error) {
      console.error('Error calling LLM:', error);
      
      // Provide a helpful error message if possible
      if (error instanceof Error && error.message) {
        if (error.message.includes('Max token limit')) {
          throw new Error('Max token limit reached. Try cutting down the history or splitting the task.');
        } else if (error.message.includes('Rate limit')) {
          throw new Error('Rate limit reached. Please wait before making more requests.');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Get function calling tools for OpenAI-compatible models
   */
  private _getFunctionCallingTools(): any[] {
    // Implementation would convert action registry to OpenAI function calling format
    return [];
  }
  
  /**
   * Parse a function calling response from OpenAI-compatible models
   */
  private _parseFunctionCallingResponse(response: any): AgentOutput {
    // Implementation would parse the tool calls from the response
    return {
      current_state: {
        evaluation_previous_goal: '',
        memory: '',
        next_goal: ''
      },
      action: []
    };
  }
  
  /**
   * Parse a raw text response from LLMs without structured output
   */
  private _parseRawResponse(response: any): AgentOutput {
    // Implementation would parse JSON from the text response
    return {
      current_state: {
        evaluation_previous_goal: '',
        memory: '',
        next_goal: ''
      },
      action: []
    };
  }
  
  /**
   * Parse a standard LLM response
   */
  private _parseStandardResponse(response: any): AgentOutput {
    // Implementation would parse standard JSON response
    return {
      current_state: {
        evaluation_previous_goal: '',
        memory: '',
        next_goal: ''
      },
      action: []
    };
  }
}

// Export other components from agent submodules
export * from './memory';
export * from './types'; 