/**
 * Agent prompts for LLM interactions
 * Based on the Python implementation in prompts.py
 */

/**
 * Class for generating system prompts for the agent
 */
export class SystemPrompt {
  private action_description: string;
  private max_actions_per_step: number;
  private override_system_message: string | undefined;
  private extend_system_message: string | undefined;

  /**
   * Constructor for SystemPrompt
   * @param action_description Description of available actions
   * @param max_actions_per_step Maximum actions per step
   * @param override_system_message Optional full override of system message
   * @param extend_system_message Optional extension to system message
   */
  constructor(
    action_description: string,
    max_actions_per_step: number = 10,
    override_system_message?: string,
    extend_system_message?: string
  ) {
    this.action_description = action_description;
    this.max_actions_per_step = max_actions_per_step;
    this.override_system_message = override_system_message;
    this.extend_system_message = extend_system_message;
  }

  /**
   * Get the complete system message
   * @returns System message for the agent
   */
  get_system_message(): string {
    if (this.override_system_message) {
      return this.override_system_message;
    }

    let message = `You are BrowserGPT, a helpful AI that uses web browsers to help users with a range of tasks.

The user will provide a task, and you will execute actions on the browser to help them achieve the task. You can see a screenshot of the current browser state to understand what you're interacting with.

GUIDELINES:
1. Choose the most appropriate action for the task.
2. You can execute up to ${this.max_actions_per_step} actions per message.
3. Your ultimate objective is to solve the user's task accurately and efficiently. 
4. If you need to end the conversation with final output, use only the "done" action.

When a webpage first loads, analyze the content thoroughly and explain what you're seeing.

Begin each response with a brief plan, then execute the relevant actions. If a webpage is difficult to read due to a popup, cookie notice, or other obstacles, try to dismiss them to access the content.

You can use these actions:

${this.action_description}

IMPORTANT: Be extremely concise in your answers. Only discuss what is relevant to the task. Don't mention generic browsing capabilities unless relevant to the specific task.`;

    if (this.extend_system_message) {
      message += `\n\n${this.extend_system_message}`;
    }

    return message;
  }
}

/**
 * Class for generating planner prompts
 */
export class PlannerPrompt {
  private available_actions: string;

  /**
   * Constructor for PlannerPrompt
   * @param available_actions Description of available actions
   */
  constructor(available_actions: string) {
    this.available_actions = available_actions;
  }

  /**
   * Get the planner system message
   * @param is_planner_reasoning Whether to include reasoning
   * @param extended_planner_system_prompt Optional extension to planner system message
   * @returns System message for the planner
   */
  get_system_message(
    is_planner_reasoning: boolean = false,
    extended_planner_system_prompt?: string
  ): { role: string; content: string } {
    let content = `You are an AI planner specialized in web tasks.
You analyze browser states and user requests to create step-by-step plans.

Available actions:
${this.available_actions}

Your planning must:
1. Analyze the current state and identify the next best actions.
2. Focus on achieving the user's goal in an efficient way.
3. Consider appropriate fallbacks if initial approaches might fail.
4. Be specific about what to look for, what to click, and what to type.`;

    if (is_planner_reasoning) {
      content += `\n\nFirst, reason through your thought process and explain why you're making these recommendations.`;
    }

    if (extended_planner_system_prompt) {
      content += `\n\n${extended_planner_system_prompt}`;
    }

    return {
      role: "system",
      content: content
    };
  }
}

/**
 * Class for generating agent message prompts
 */
export class AgentMessagePrompt {
  private state: any;
  private result: any[];
  private include_attributes: string[];

  /**
   * Constructor for AgentMessagePrompt
   * @param state Browser state
   * @param result Previous action results
   * @param include_attributes List of attributes to include
   */
  constructor(state: any, result: any[], include_attributes: string[]) {
    this.state = state;
    this.result = result;
    this.include_attributes = include_attributes;
  }

  /**
   * Get the user message with state information
   * @param use_vision Whether to include screenshots
   * @returns User message with state information
   */
  get_user_message(use_vision: boolean): { role: string; content: any } {
    // Create text content with page information
    let content = `Current page: ${this.state.url}\nTitle: ${this.state.title}\n\n`;

    // Add previous action results if available
    if (this.result && this.result.length > 0) {
      for (const r of this.result) {
        if (r.error) {
          content += `Error from previous action: ${r.error}\n\n`;
        } else if (r.extracted_content) {
          content += `Information from previous action: ${r.extracted_content}\n\n`;
        }
      }
    }

    // Add clickable elements information
    const selector_map = this.state.selector_map || {};
    const elements = Object.values(selector_map);
    
    if (elements.length > 0) {
      content += "Clickable elements on the page:\n";
      
      for (const [index, element] of Object.entries(selector_map)) {
        const el = element as any;
        content += `${index}: <${el.tag}`;
        
        // Add attributes
        for (const attr of this.include_attributes) {
          if (el.attributes && el.attributes[attr]) {
            content += ` ${attr}="${el.attributes[attr]}"`;
          }
        }
        
        content += `>${el.text ? el.text.substring(0, 100) : ''}</${el.tag}>\n`;
      }
    }

    // Create the message with or without vision
    if (use_vision && this.state.screenshot) {
      return {
        role: "user",
        content: [
          { 
            type: "text", 
            text: content 
          },
          { 
            type: "image_url", 
            image_url: this.state.screenshot 
          }
        ]
      };
    } else {
      return {
        role: "user",
        content: content
      };
    }
  }
} 