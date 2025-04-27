/**
 * Agent module implementation for browser automation
 * Based on the Python implementation in service.py
 */

import { v4 as uuidv4 } from 'uuid';
import { Browser } from '../browser';
import { BrowserContext, BrowserContextConfig } from '../browser/context';
import { BrowserState, ActionResult as BrowserActionResult, DOMElement as BrowserDOMElement } from '../browser/types';
import { Controller } from '../controller';
import { ActionModel } from '../controller/registry';
import { Memory } from './memory';
import { MemoryConfig } from './memory/types';
import { MessageManager } from './message_manager';
import { MessageRole } from './message_manager/types';
import { SystemPrompt, PlannerPrompt, AgentMessagePrompt } from './prompts';
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
  ExtendedAgentState,
  MappedDOMHistoryElement,
  StepMetadata,
  ToolCallingMethod,
} from './views';

// Add Playwright Page type
import type { Page } from 'playwright';

// Default timeout for async operations
const DEFAULT_TIMEOUT = 30000;

// Default number of retry attempts
const MAX_RETRIES = 3;

// Define extended interfaces for Browser and Page to fix missing method errors
interface ExtendedBrowser extends Browser {
  getPlaywrightBrowser(): Promise<any>;
  // Required to silence TypeScript errors
  newContext(config?: BrowserContextConfig): Promise<BrowserContext>;
  close(): Promise<void>;
  dispose(): Promise<void>;
  playwright: any;
  _startPlaywright: any;
  _setupRemoteCdpBrowser: any;
  _setupRemoteWssBrowser: any;
  _getBrowserClass: any;
  _setupUserProvidedBrowser: any;
  _setupBuiltinBrowser: any;
  _setupBrowser: any;
}

interface ExtendedPage extends Page {
  evaluate<T>(pageFunction: Function | string, ...args: any[]): Promise<T>;
}

/**
 * Agent class for browser automation
 */
export class Agent<Context = any> {
  task: string;
  llm: any; // LLM type will depend on your implementation
  controller: Controller<Context>;
  browser: ExtendedBrowser;
  browser_context: BrowserContext;
  settings: AgentSettings;
  state: ExtendedAgentState;
  ActionModel!: typeof ActionModel; // Using definite assignment assertion
  AgentOutput: any;
  memory: Memory | null = null;
  enable_memory: boolean;
  context: Context | null = null;
  version: string = 'unknown';
  source: string = 'unknown';
  sensitive_data: Record<string, string> | null;
  
  // Add callback properties
  private register_new_step_callback: ((state: BrowserState, model_output: AgentOutput, step: number) => void | Promise<void>) | null = null;
  private register_done_callback: ((history: AgentHistoryList) => void | Promise<void>) | null = null;
  private register_external_agent_status_raise_error_callback: (() => Promise<boolean>) | null = null;
  
  private _message_manager: MessageManager;
  private unfiltered_actions: string;
  private model_name: string = 'Unknown';
  private planner_model_name: string | null = null;
  private chat_model_library: string = 'Unknown';
  private tool_calling_method: ToolCallingMethod | null = null;
  private initial_actions: ActionModel[] | null = null;
  
  // Add the DoneAgentOutput property and setup code
  private DoneAgentOutput: any;
  private DoneActionModel!: typeof ActionModel;

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
    
    // Initialize core components
    this.task = task;
    this.llm = llm;
    this.controller = controller;
    this.sensitive_data = sensitive_data;
    
    // Initialize browser components - cast to extended types
    this.browser = (browser || new Browser()) as unknown as ExtendedBrowser;
    this.browser_context = browser_context || new BrowserContext({ 
      browser: this.browser as unknown as Browser,
      config: {} // Use default config
    });
    
    // Initialize state with injected state or new state
    this.state = injected_agent_state ? injected_agent_state as ExtendedAgentState : {
      agent_id: uuidv4(),
      n_steps: 1,
      consecutive_failures: 0,
      last_result: null,
      history: new AgentHistoryList([]),
      last_plan: null,
      paused: false,
      stopped: false,
      message_manager_state: {
        history: {
          messages: [],
          current_tokens: 0
        }
      }
    } as ExtendedAgentState;
    
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
      new SystemPrompt(
        this.unfiltered_actions,
        this.settings.max_actions_per_step,
        this.settings.override_system_message || undefined,
        this.settings.extend_system_message || undefined
      ).get_system_message(),
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
    
    // Initial actions
    if (initial_actions) {
      this.initial_actions = this._convertInitialActions(initial_actions);
    }
    
    // Save path notification
    if (this.settings.save_conversation_path) {
      console.log(`Saving conversation to ${this.settings.save_conversation_path}`);
    }
    
    // Store callbacks
    this.register_new_step_callback = register_new_step_callback;
    this.register_done_callback = register_done_callback;
    this.register_external_agent_status_raise_error_callback = register_external_agent_status_raise_error_callback;
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
    // Initialize action models from controller's registry
    this.ActionModel = this.controller.registry.createActionModel();
    
    // Create output model with dynamic actions
    this.AgentOutput = AgentOutput.type_with_custom_actions(this.ActionModel);
    
    // Create a separate action model for the "done" action only
    this.DoneActionModel = this.controller.registry.createActionModel(undefined, ['done']);
    
    // Create a matching AgentOutput model for the done action
    this.DoneAgentOutput = AgentOutput.type_with_custom_actions(this.DoneActionModel);
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
    let result: BrowserActionResult[] = [];
    const step_start_time = Date.now() / 1000;
    let tokens = 0;
    
    try {
      // Get browser state (implementation would go here)
      state = await this._getBrowserState();
      
      // Generate procedural memory if enabled
      if (this.enable_memory && this.memory && this.state.n_steps % 5 === 0) {
        this.memory.createProceduralMemory(this.state.n_steps);
      }
      
      // Additional step implementation would go here...
      console.log('Step implementation would be here.');
      
      // Store the result
      this.state.last_result = result.map(r => ({
        ...r,
        include_in_memory: r.include_in_memory === undefined ? true : r.include_in_memory
      })) as unknown as ActionResult[];
      
    } catch (error) {
      console.error('Error in step:', error);
      // Error handling would go here...
    } finally {
      const step_end_time = Date.now() / 1000;
      
      // Create history item if we have state and result
      if (state && model_output) {
        const metadata = new StepMetadata(
          this.state.n_steps,
          step_start_time,
          step_end_time,
          tokens
        );
        
        // Make history item would go here...
      }
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
          
          console.log('Step completed');
          
          if (this.state.history.is_done()) {
            console.log('Task completed successfully');
            break;
          }
        } catch (error) {
          console.error('Error during step execution:', error);
        }
      }
      
      return this.state.history;
    } catch (error) {
      console.error('Error in run:', error);
      return this.state.history;
    }
  }
  
  /**
   * Get the browser state
   * This is a placeholder implementation
   */
  private async _getBrowserState(): Promise<BrowserState> {
    try {
      console.log('Getting browser state...');
      
      // Get the current page
      const page = await this.browser_context.getCurrentPage();
      if (!page) {
        throw new Error('No active page found');
      }
      
      // Create minimal state object
      return {
        url: await page.url(),
        title: await page.title(),
        tabs: [{
          id: 0,
          url: await page.url(),
          title: await page.title(),
          is_active: true
        }],
        selector_map: {},
        screenshot: undefined
      };
    } catch (e) {
      console.error('Error getting browser state:', e);
      throw e;
    }
  }
} 