import { Browser } from '../browser';
import { ActionRegistry, ActionModel } from './registry';
import { ActionResult } from '../agent/types';
import * as playwright from 'playwright';

/**
 * Context type variable for generic controller
 */
export type Context = any;

/**
 * Model for 'done' action parameters
 */
export interface DoneAction {
  text: string;
  success: boolean;
}

/**
 * Model for 'go_to_url' action parameters
 */
export interface GoToUrlAction {
  url: string;
}

/**
 * Model for 'search_google' action parameters
 */
export interface SearchGoogleAction {
  query: string;
}

/**
 * Model for 'click_element' action parameters
 */
export interface ClickElementAction {
  index: number;
  xpath?: string;
}

/**
 * Model for 'input_text' action parameters
 */
export interface InputTextAction {
  index: number;
  text: string;
  xpath?: string;
}

/**
 * Model for 'scroll' action parameters
 */
export interface ScrollAction {
  amount?: number;
}

/**
 * Model for 'switch_tab' action parameters
 */
export interface SwitchTabAction {
  page_id: number;
}

/**
 * Model for 'open_tab' action parameters
 */
export interface OpenTabAction {
  url: string;
}

/**
 * Model for 'close_tab' action parameters
 */
export interface CloseTabAction {
  page_id: number;
}

/**
 * Model for position coordinates
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Model for 'drag_drop' action parameters
 */
export interface DragDropAction {
  element_source?: string;
  element_target?: string;
  element_source_offset?: Position;
  element_target_offset?: Position;
  coord_source_x?: number;
  coord_source_y?: number;
  coord_target_x?: number;
  coord_target_y?: number;
  steps?: number;
  delay_ms?: number;
}

/**
 * Controller class that combines browser control with an action registry
 */
export class Controller<T = Context> {
  public registry: ActionRegistry;

  /**
   * Create a new Controller instance
   * @param excludeActions List of action names to exclude
   * @param outputModel Optional output model type
   */
  constructor(excludeActions: string[] = [], outputModel: any = null) {
    this.registry = new ActionRegistry();
    
    // Register default actions
    this._registerDefaultActions();
  }

  /**
   * Register default actions
   * This is where all the default browser actions are registered
   */
  private _registerDefaultActions(): void {
    // Register 'done' action
    this.registry.action(
      'Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached',
      async (params: DoneAction): Promise<ActionResult> => {
        return {
          is_done: true,
          success: params.success,
          extracted_content: params.text,
          include_in_memory: true
        };
      },
      { text: String, success: Boolean }
    );

    // Register 'go_to_url' action
    this.registry.action(
      'Navigate to URL in the current tab',
      async (params: GoToUrlAction, browser: Browser): Promise<ActionResult> => {
        await browser.navigateTo(params.url);
        const msg = `🔗 Navigated to ${params.url}`;
        console.log(msg);
        return {
          extracted_content: msg,
          include_in_memory: true
        };
      },
      { url: String }
    );

    // Register 'search_google' action
    this.registry.action(
      'Search the query in Google in the current tab, the query should be a search query like humans search in Google, concrete and not vague or super long. More the single most important items.',
      async (params: SearchGoogleAction, browser: Browser): Promise<ActionResult> => {
        await browser.navigateTo(`https://www.google.com/search?q=${encodeURIComponent(params.query)}&udm=14`);
        const msg = `🔍 Searched for "${params.query}" in Google`;
        console.log(msg);
        return {
          extracted_content: msg,
          include_in_memory: true
        };
      },
      { query: String }
    );

    // Register 'click_element' action
    this.registry.action(
      'Click element by index',
      async (params: ClickElementAction, browser: Browser): Promise<ActionResult> => {
        const context = await browser.getContext();
        const page = await browser.getCurrentPage();
        
        if (!page) {
          return {
            error: 'No active page',
            include_in_memory: true
          };
        }

        try {
          // Implement element clicking logic here
          // This would need to be implemented with DOM traversal
          const msg = `🖱️ Clicked element with index ${params.index}`;
          console.log(msg);
          return {
            extracted_content: msg,
            include_in_memory: true
          };
        } catch (error) {
          console.error('Element click error:', error);
          return {
            error: error instanceof Error ? error.message : String(error),
            include_in_memory: true
          };
        }
      },
      { index: Number, xpath: String }
    );

    // Register 'input_text' action
    this.registry.action(
      'Input text into an input interactive element',
      async (params: InputTextAction, browser: Browser): Promise<ActionResult> => {
        const page = await browser.getCurrentPage();
        
        if (!page) {
          return {
            error: 'No active page',
            include_in_memory: true
          };
        }

        try {
          // Implement text input logic here
          const msg = `⌨️ Input "${params.text}" into element with index ${params.index}`;
          console.log(msg);
          return {
            extracted_content: msg,
            include_in_memory: true
          };
        } catch (error) {
          console.error('Text input error:', error);
          return {
            error: error instanceof Error ? error.message : String(error),
            include_in_memory: true
          };
        }
      },
      { index: Number, text: String, xpath: String }
    );

    // Register 'wait' action
    this.registry.action(
      'Wait for x seconds default 3',
      async (seconds: number = 3): Promise<ActionResult> => {
        const msg = `🕒 Waiting for ${seconds} seconds`;
        console.log(msg);
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        return {
          extracted_content: msg,
          include_in_memory: true
        };
      }
    );

    // Register 'scroll_down' action
    this.registry.action(
      'Scroll down the page by pixel amount - if no amount is specified, scroll down one page',
      async (params: ScrollAction, browser: Browser): Promise<ActionResult> => {
        const page = await browser.getCurrentPage();
        
        if (!page) {
          return {
            error: 'No active page',
            include_in_memory: true
          };
        }

        try {
          const amount = params.amount || 800; // Default scroll amount if none specified
          if (page) {
            await (page as any).evaluate((scrollAmount: number) => {
              window.scrollBy(0, scrollAmount);
            }, amount);
          }
          
          const msg = `⬇️ Scrolled down ${amount} pixels`;
          console.log(msg);
          return {
            extracted_content: msg,
            include_in_memory: true
          };
        } catch (error) {
          console.error('Scroll error:', error);
          return {
            error: error instanceof Error ? error.message : String(error),
            include_in_memory: true
          };
        }
      },
      { amount: Number }
    );

    // Register 'scroll_up' action
    this.registry.action(
      'Scroll up the page by pixel amount - if no amount is specified, scroll up one page',
      async (params: ScrollAction, browser: Browser): Promise<ActionResult> => {
        const page = await browser.getCurrentPage();
        
        if (!page) {
          return {
            error: 'No active page',
            include_in_memory: true
          };
        }

        try {
          const amount = params.amount || 800; // Default scroll amount if none specified
          if (page) {
            await (page as any).evaluate((scrollAmount: number) => {
              window.scrollBy(0, -scrollAmount);
            }, amount);
          }
          
          const msg = `⬆️ Scrolled up ${amount} pixels`;
          console.log(msg);
          return {
            extracted_content: msg,
            include_in_memory: true
          };
        } catch (error) {
          console.error('Scroll error:', error);
          return {
            error: error instanceof Error ? error.message : String(error),
            include_in_memory: true
          };
        }
      },
      { amount: Number }
    );

    // More actions would be registered here to match Python implementation
    // Tab management actions, drag and drop, extract content, etc.
  }

  /**
   * Execute an action by name with parameters
   * @param actionType Type of action to execute
   * @param params Parameters for the action
   * @param browser Browser instance to use
   * @returns Result of the action
   */
  async executeAction(
    actionType: string, 
    params: Record<string, any>, 
    browser: Browser
  ): Promise<ActionResult> {
    try {
      // Get the action executor from the registry
      const actionExecutor = this.registry.getAction(actionType);
      
      if (!actionExecutor) {
        throw new Error(`Unknown action type: ${actionType}`);
      }
      
      // Execute the action with the provided parameters and browser
      return await actionExecutor(params, browser);
    } catch (error) {
      console.error(`Error executing action ${actionType}:`, error);
      return {
        error: error instanceof Error ? error.message : String(error),
        include_in_memory: true
      };
    }
  }

  /**
   * Create action models based on registered actions
   * @param page Optional page to filter actions
   * @param includeActions Optional list of actions to include
   */
  createActionModel(page?: playwright.Page, includeActions?: string[]): typeof ActionModel {
    return this.registry.createActionModel(page, includeActions);
  }

  /**
   * Get description of available actions for prompts
   * @param page Optional page to filter actions
   */
  getPromptDescription(page: playwright.Page | null = null): string {
    return this.registry.getPromptDescription(page);
  }
} 