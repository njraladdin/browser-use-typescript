/**
 * Memory module for browser-use-typescript
 * This module handles procedural memory for the agent
 */

import { MessageManager } from '../message_manager';
import { Message, MessageRole } from '../message_manager/types';
import { DEFAULT_MEMORY_CONFIG, MemoryConfig, MemoryConfigHelper } from './types';

/**
 * Logger for memory operations
 */
const logger = {
  info: (message: string) => console.log(`[Memory] INFO: ${message}`),
  warning: (message: string) => console.warn(`[Memory] WARNING: ${message}`),
  error: (message: string) => console.error(`[Memory] ERROR: ${message}`)
};

/**
 * Manages procedural memory for agents
 * 
 * This class implements a procedural memory management system that transforms agent interaction history
 * into concise, structured representations at specified intervals. It serves to optimize context window
 * utilization during extended task execution by converting verbose historical information into compact,
 * yet comprehensive memory constructs that preserve essential operational knowledge.
 */
export class Memory {
  private message_manager: MessageManager;
  private llm: any; // Will be a specific LLM interface in real implementation
  private config: MemoryConfig;
  private mem0: any; // The mem0 library integration will be specific to implementation

  /**
   * Create a new Memory instance
   * @param message_manager The message manager
   * @param llm The LLM instance
   * @param config Optional memory configuration
   */
  constructor(
    message_manager: MessageManager,
    llm: any,
    config?: Partial<MemoryConfig>
  ) {
    this.message_manager = message_manager;
    this.llm = llm;

    // Initialize configuration with defaults or provided values
    if (!config) {
      this.config = { ...DEFAULT_MEMORY_CONFIG, llm_instance: llm, agent_id: `agent_${Date.now()}` };
      
      // Set appropriate embedder based on LLM type if possible
      const llm_class = llm.constructor?.name;
      
      if (llm_class === 'ChatOpenAI') {
        this.config.embedder_provider = 'openai';
        this.config.embedder_model = 'text-embedding-3-small';
        this.config.embedder_dims = 1536;
      } else if (llm_class === 'ChatGoogleGenerativeAI') {
        this.config.embedder_provider = 'gemini';
        this.config.embedder_model = 'models/text-embedding-004';
        this.config.embedder_dims = 768;
      } else if (llm_class === 'ChatOllama') {
        this.config.embedder_provider = 'ollama';
        this.config.embedder_model = 'nomic-embed-text';
        this.config.embedder_dims = 512;
      }
    } else {
      this.config = { ...DEFAULT_MEMORY_CONFIG, ...config, llm_instance: llm };
    }

    // Initialize Mem0 if available
    this.initializeMem0();
  }

  /**
   * Initialize the Mem0 memory system
   * This is a placeholder - actual implementation would depend on Mem0 library
   */
  private initializeMem0(): void {
    try {
      // In a real implementation, this would initialize the Mem0 library
      // this.mem0 = Mem0Memory.from_config(config_dict=this.config.full_config_dict)
      
      // For now, we'll just use a placeholder
      this.mem0 = {
        add: async (params: any) => {
          return {
            results: [{
              memory: this.generatePlaceholderMemory(params.messages)
            }]
          };
        }
      };
      
      logger.info('Memory system initialized');
    } catch (error) {
      logger.error(`Failed to initialize memory system: ${error}`);
      throw new Error('Failed to initialize memory system');
    }
  }

  /**
   * Create a procedural memory based on the current step
   * @param current_step The current step number of the agent
   */
  async createProceduralMemory(current_step: number): Promise<void> {
    logger.info(`Creating procedural memory at step ${current_step}`);

    // Get all messages
    const all_messages = this.message_manager.state.history.messages;

    // Separate messages into those to keep as-is and those to process for memory
    const new_messages: Message[] = [];
    const messages_to_process: Message[] = [];

    for (const msg of all_messages) {
      // In a real implementation, we would check message metadata
      // For now, we'll keep system messages and process others
      if (msg.role === MessageRole.SYSTEM) {
        new_messages.push(msg);
      } else {
        if (msg.content.length > 0) {
          messages_to_process.push(msg);
        }
      }
    }

    // Need at least 2 messages to create a meaningful summary
    if (messages_to_process.length <= 1) {
      logger.info('Not enough non-memory messages to summarize');
      return;
    }

    // Create a procedural memory
    const memory_content = await this.create(messages_to_process, current_step);

    if (!memory_content) {
      logger.warning('Failed to create procedural memory');
      return;
    }

    // Create a new memory message
    const memory_message: Message = {
      role: MessageRole.USER,
      content: memory_content
    };

    // Calculate tokens
    const contentLength = memory_message.content.length;
    const memory_tokens = Math.ceil(contentLength / 4); // Simple token estimation
    
    // In a real implementation, this would include proper metadata
    // memory_metadata = MessageMetadata(tokens=memory_tokens, message_type='memory')

    // Calculate the total tokens being removed
    const removed_tokens = messages_to_process.reduce((sum, msg) => {
      // Estimate tokens for each message
      return sum + Math.ceil(msg.content.length / 4);
    }, 0);

    // Add the memory message
    new_messages.push(memory_message);

    // Update the history
    this.message_manager.state.history.messages = new_messages;
    this.message_manager.state.history.current_tokens -= removed_tokens;
    this.message_manager.state.history.current_tokens += memory_tokens;
    
    logger.info(`Messages consolidated: ${messages_to_process.length} messages converted to procedural memory`);
  }

  /**
   * Create a memory from messages
   * @param messages The messages to process
   * @param current_step The current step number
   * @returns The generated memory content or null if failed
   */
  private async create(messages: Message[], current_step: number): Promise<string | null> {
    try {
      // In a real implementation, this would call the Mem0 library
      const results = await this.mem0.add({
        messages,
        agent_id: this.config.agent_id,
        memory_type: 'procedural_memory',
        metadata: { step: current_step }
      });
      
      if (results.results && results.results.length > 0) {
        return results.results[0].memory;
      }
      return null;
    } catch (error) {
      logger.error(`Error creating procedural memory: ${error}`);
      return null;
    }
  }

  /**
   * Generate a placeholder memory summary
   * This is used for the simplified implementation without Mem0
   * @param messages The messages to summarize
   * @returns A summarized memory
   */
  private generatePlaceholderMemory(messages: Message[]): string {
    // Create a simple summary of the messages
    const userMessages = messages.filter(m => m.role === MessageRole.USER);
    const assistantMessages = messages.filter(m => m.role === MessageRole.ASSISTANT);
    
    // Extract key information like URLs, actions, and results
    const urls = new Set<string>();
    let actionCount = 0;
    
    userMessages.forEach(msg => {
      const urlMatches = msg.content.match(/https?:\/\/[^\s]+/g);
      if (urlMatches) {
        urlMatches.forEach(url => urls.add(url));
      }
      
      // Count potential actions
      if (msg.content.includes("click") || 
          msg.content.includes("type") ||
          msg.content.includes("navigate")) {
        actionCount++;
      }
    });
    
    // Create a memory summary
    const summary = `PROCEDURAL MEMORY (STEP ${Date.now()}):
- Agent has processed ${userMessages.length} user messages and ${assistantMessages.length} assistant messages
- Visited ${urls.size} unique URLs: ${Array.from(urls).slice(0, 3).join(", ")}${urls.size > 3 ? "..." : ""}
- Performed approximately ${actionCount} actions
- Key goals identified: [To be determined from actual conversation]
- Current progress: [To be determined from actual conversation]
- Next steps: Continue following the plan outlined in previous steps`;
    
    return summary;
  }
}

// Export memory types
export * from './types'; 