/**
 * Goal: Automates webpage scrolling with various scrolling actions and text search functionality.
 * Ported from Python to TypeScript
 */

import path from 'path';
import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { Agent } from '../../src/browser_use/agent';
import { Browser, BrowserConfig } from '../../src/browser_use/browser';

// Load environment variables
config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

/**
 * Example: Using the 'Scroll down' action.
 *
 * This script demonstrates how the agent can navigate to a webpage and:
 * 1. Scroll down the content by a specific amount
 * 2. Scroll up by a specific amount
 * 3. Scroll to find specific text on the page
 */

async function main() {
  // Initialize the LLM
  const llm = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0
  });

  // Choose the task - uncommenting either one to test different scrolling behaviors
  
  // Task 1: Scroll by specific amounts
  // const task = "Navigate to 'https://en.wikipedia.org/wiki/Internet' and scroll down by one page - then scroll up by 100 pixels - then scroll down by 100 pixels - then scroll down by 10000 pixels.";
  
  // Task 2: Scroll to find specific text
  const task = "Navigate to 'https://en.wikipedia.org/wiki/Internet' and scroll to the string 'The vast majority of computer'";

  // Initialize the agent with the browser
  const agent = new Agent({
    task: task,
    llm: llm,
    browser: new Browser({
      headless: false,
      disableSecurity: true
    })
  });

  try {
    // Run the agent
    console.log('Starting agent with task:', task);
    await agent.run();
    console.log('Agent task completed successfully');
  } catch (error) {
    console.error('Error running agent:', error);
  } finally {
    // Ensure cleanup happens
    await agent.cleanup();
  }
}

// Execute the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Failed to run example:', error);
    process.exit(1);
  });
} 