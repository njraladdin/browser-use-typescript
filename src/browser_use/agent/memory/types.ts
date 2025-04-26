/**
 * Type definitions for the memory module
 */

/**
 * Supported embedder providers
 */
export type EmbedderProvider = 'openai' | 'gemini' | 'ollama' | 'huggingface';

/**
 * Supported LLM providers
 */
export type LLMProvider = 'langchain';

/**
 * Supported vector store providers
 */
export type VectorStoreProvider = 'faiss';

/**
 * Configuration for procedural memory
 */
export interface MemoryConfig {
  // Memory settings
  agent_id: string;
  memory_interval: number;

  // Embedder settings
  embedder_provider: EmbedderProvider;
  embedder_model: string;
  embedder_dims: number;

  // LLM settings
  llm_provider: LLMProvider;
  llm_instance: any | null; // Will be a specific LLM interface in real implementation

  // Vector store settings
  vector_store_provider: VectorStoreProvider;
  vector_store_base_path: string;
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  agent_id: 'browser_use_agent',
  memory_interval: 10,
  embedder_provider: 'huggingface',
  embedder_model: 'all-MiniLM-L6-v2',
  embedder_dims: 384,
  llm_provider: 'langchain',
  llm_instance: null,
  vector_store_provider: 'faiss',
  vector_store_base_path: '/tmp/mem0'
};

/**
 * Memory configuration helper methods
 */
export class MemoryConfigHelper {
  /**
   * Get the full vector store path for the current configuration
   * @param config Memory configuration
   * @returns The vector store path (e.g., /tmp/mem0_384_faiss)
   */
  static getVectorStorePath(config: MemoryConfig): string {
    return `${config.vector_store_base_path}_${config.embedder_dims}_${config.vector_store_provider}`;
  }

  /**
   * Get the embedder configuration dictionary
   * @param config Memory configuration
   * @returns Embedder configuration object
   */
  static getEmbedderConfigDict(config: MemoryConfig): Record<string, any> {
    return {
      provider: config.embedder_provider,
      config: {
        model: config.embedder_model,
        embedding_dims: config.embedder_dims
      }
    };
  }

  /**
   * Get the LLM configuration dictionary
   * @param config Memory configuration
   * @returns LLM configuration object
   */
  static getLLMConfigDict(config: MemoryConfig): Record<string, any> {
    return {
      provider: config.llm_provider,
      config: {
        model: config.llm_instance
      }
    };
  }

  /**
   * Get the vector store configuration dictionary
   * @param config Memory configuration
   * @returns Vector store configuration object
   */
  static getVectorStoreConfigDict(config: MemoryConfig): Record<string, any> {
    return {
      provider: config.vector_store_provider,
      config: {
        embedding_model_dims: config.embedder_dims,
        path: this.getVectorStorePath(config)
      }
    };
  }

  /**
   * Get the complete configuration dictionary
   * @param config Memory configuration
   * @returns Full configuration object
   */
  static getFullConfigDict(config: MemoryConfig): Record<string, Record<string, any>> {
    return {
      embedder: this.getEmbedderConfigDict(config),
      llm: this.getLLMConfigDict(config),
      vector_store: this.getVectorStoreConfigDict(config)
    };
  }
} 