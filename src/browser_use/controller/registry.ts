/**
 * Registry module for browser-use-typescript
 * This module contains the action registry for DOM interactions
 */

import * as playwright from 'playwright';
type Page = playwright.Page;

/**
 * Base interface for models
 */
export interface BaseModel {
  [key: string]: any;
}

/**
 * Model for a registered action
 */
export class RegisteredAction {
  name: string;
  description: string;
  function: Function;
  paramModel: any; // Type of model/interface for parameters

  // Filters: provide specific domains or a function to determine whether the action should be available on the given page or not
  domains: string[] | null = null; // e.g. ['*.google.com', 'www.bing.com', 'yahoo.*]
  pageFilter: ((page: Page) => boolean) | null = null;

  constructor(
    name: string,
    description: string,
    fn: Function,
    paramModel: any,
    domains: string[] | null = null,
    pageFilter: ((page: Page) => boolean) | null = null
  ) {
    this.name = name;
    this.description = description;
    this.function = fn;
    this.paramModel = paramModel;
    this.domains = domains;
    this.pageFilter = pageFilter;
  }

  /**
   * Get a description of the action for the prompt
   */
  promptDescription(): string {
    const skipKeys = ['title'];
    let s = `${this.description}: \n`;
    s += '{' + this.name + ': ';

    // Get schema properties from the param model
    // This is a simplification - in TypeScript we'd need to use reflection or schema validation libraries
    // to get the full schema equivalent to Pydantic's model_json_schema
    if (this.paramModel) {
      const properties = Object.getOwnPropertyNames(this.paramModel.prototype)
        .filter(prop => prop !== 'constructor')
        .reduce((acc, prop) => {
          acc[prop] = { type: typeof this.paramModel.prototype[prop] };
          return acc;
        }, {} as Record<string, any>);

      s += JSON.stringify(properties);
    } else {
      s += '{}';
    }
    
    s += '}';
    return s;
  }
}

/**
 * Base class for dynamically created action models
 */
export class ActionModel {
  [key: string]: any;
  
  /**
   * Get the index of the action
   */
  getIndex(): number | null {
    // Get all property values
    const params = Object.values(this).filter(val => val !== null && val !== undefined);
    
    if (!params.length) {
      return null;
    }
    
    // Look for an index property in any of the parameter objects
    for (const param of params) {
      if (param !== null && typeof param === 'object' && 'index' in param) {
        return param.index;
      }
    }
    
    return null;
  }

  /**
   * Overwrite the index of the action
   */
  setIndex(index: number): void {
    // Get the action name and params
    const keys = Object.keys(this);
    if (!keys.length) return;
    
    const actionName = keys[0];
    const actionParams = this[actionName];

    // Update the index directly on the model
    if (actionParams && typeof actionParams === 'object' && 'index' in actionParams) {
      actionParams.index = index;
    }
  }
}

/**
 * Model representing the action registry
 */
export class ActionRegistry {
  actions: Record<string, RegisteredAction> = {};

  /**
   * Create an action model class based on registered actions
   * @param page Optional page to filter actions by
   * @param includeActions Optional list of actions to include
   * @returns ActionModel class with registered actions
   */
  createActionModel(page?: Page, includeActions?: string[]): typeof ActionModel {
    // Create a dynamic class that extends ActionModel
    class DynamicActionModel extends ActionModel {}
    
    // Get filtered actions
    const filteredActions = this.getFilteredActions(page, includeActions);
    
    // Add properties for each action
    filteredActions.forEach(action => {
      Object.defineProperty(DynamicActionModel.prototype, action.name, {
        enumerable: true,
        configurable: true,
        get() {
          return this[`_${action.name}`];
        },
        set(value) {
          this[`_${action.name}`] = value;
        }
      });
    });
    
    return DynamicActionModel;
  }

  /**
   * Get filtered actions based on page and includeActions
   * @param page Optional page to filter actions by
   * @param includeActions Optional list of actions to include
   * @returns List of filtered actions
   */
  private getFilteredActions(page?: Page, includeActions?: string[]): RegisteredAction[] {
    let filteredActions = Object.values(this.actions);
    
    if (includeActions) {
      filteredActions = filteredActions.filter(action => 
        includeActions.includes(action.name)
      );
    } else if (page) {
      // Filter by page URL and page filter if provided
      const url = page.url();
      filteredActions = filteredActions.filter(action => 
        ActionRegistry._matchDomains(action.domains, url) && 
        ActionRegistry._matchPageFilter(action.pageFilter, page)
      );
    } else {
      // No page or includeActions, return only actions with no filters
      filteredActions = filteredActions.filter(action => 
        action.pageFilter === null && action.domains === null
      );
    }
    
    return filteredActions;
  }

  /**
   * Match a list of domain glob patterns against a URL
   * @param domains List of domain patterns that can include glob patterns (* wildcard)
   * @param url The URL to match against
   * @returns True if the URL's domain matches the pattern, False otherwise
   */
  private static _matchDomains(domains: string[] | null, url: string): boolean {
    if (domains === null || !url) {
      return true;
    }

    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.hostname) {
        return false;
      }

      let domain = parsedUrl.hostname;
      // Remove port if present
      if (domain.includes(':')) {
        domain = domain.split(':')[0];
      }

      for (const domainPattern of domains) {
        if (this._matchGlob(domain, domainPattern)) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Simple glob pattern matching implementation (similar to fnmatch)
   * @param str String to match
   * @param pattern Pattern with * wildcards
   * @returns True if the string matches the pattern
   */
  private static _matchGlob(str: string, pattern: string): boolean {
    const escapeRegex = (s: string) => s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
    const regexPattern = pattern
      .split('*')
      .map(escapeRegex)
      .join('.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  /**
   * Match a page filter against a page
   * @param pageFilter Function that takes a Page and returns a boolean
   * @param page Page to test
   * @returns Result of the filter function or true if no filter
   */
  private static _matchPageFilter(
    pageFilter: ((page: Page) => boolean) | null,
    page: Page
  ): boolean {
    if (pageFilter === null) {
      return true;
    }
    return pageFilter(page);
  }

  /**
   * Get a description of all actions for the prompt
   * @param page If provided, filter actions by page using pageFilter and domains
   * @returns A string description of available actions
   */
  getPromptDescription(page: Page | null = null): string {
    if (page === null) {
      // For system prompt (no page provided), include only actions with no filters
      return Object.values(this.actions)
        .filter(action => action.pageFilter === null && action.domains === null)
        .map(action => action.promptDescription())
        .join('\n');
    } else {
      // For page prompt, filter actions by page
      return this.getFilteredActions(page)
        .map(action => action.promptDescription())
        .join('\n');
    }
  }

  /**
   * Register a new action
   * @param description Description of the action
   * @param fn Function to execute
   * @param paramModel Parameter model for the action
   * @param domains Optional domains to filter by
   * @param pageFilter Optional page filter function
   * @returns The registered action
   */
  action(
    description: string,
    fn: Function,
    paramModel: any = null,
    domains: string[] | null = null,
    pageFilter: ((page: Page) => boolean) | null = null
  ): RegisteredAction {
    // Generate name from the function name or use a generic name
    const name = fn.name || `action_${Object.keys(this.actions).length}`;
    
    // Create a new registered action
    const action = new RegisteredAction(name, description, fn, paramModel, domains, pageFilter);
    
    // Add to the registry
    this.actions[name] = action;
    
    return action;
  }

  /**
   * Get an action by name
   * @param actionName Name of the action to get
   * @returns The action function or null if not found
   */
  getAction(actionName: string): Function | null {
    if (actionName in this.actions) {
      return this.actions[actionName].function;
    }
    return null;
  }
}

// Export everything
export * from './types'; 