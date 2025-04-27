# Browser-Use Agent TypeScript Port

This module contains a TypeScript port of the Python `browser-use` Agent class, which is used for browser automation with LLMs.

## Status

This is a work-in-progress port of the Python implementation. The following components have been completed:

- ✅ Core Agent class structure
- ✅ LLM response handling with three modes (function calling, raw, standard)
- ✅ Proper callback handling and execution
- ✅ Basic browser state extraction from Playwright
- ✅ Action execution through the controller
- ✅ Done action handling for last steps
- ✅ Error handling and recovery

The following components still need work:

- ⚠️ Complete browser integration with proper type definitions
- ⚠️ Memory implementation
- ⚠️ Full validation of inputs and outputs
- ⚠️ Testing and examples
- ⚠️ Complete documentation

## Dependencies

This implementation requires:

- TypeScript 4.x+
- Playwright for browser automation
- UUID for generating unique IDs

## Basic Usage

```typescript
import { Agent } from './browser-use/agent';
import { Browser } from './browser-use/browser';
import { createLLM } from './llm-adapter'; // Your LLM implementation

async function main() {
  // Create a browser instance
  const browser = new Browser();
  
  // Create an LLM instance (OpenAI, Anthropic, etc.)
  const llm = createLLM({
    model: "gpt-4-vision",
    apiKey: process.env.OPENAI_API_KEY
  });
  
  // Create the agent
  const agent = new Agent(
    "Search for information about browser automation with LLMs",
    llm,
    browser
  );
  
  try {
    // Run the agent
    const history = await agent.run(10); // Maximum 10 steps
    
    // Get the result
    if (history.is_done()) {
      console.log("Task completed!");
      console.log("Success:", history.is_successful());
      console.log("Result:", history.final_result());
    } else {
      console.log("Task not completed within max steps");
    }
  } finally {
    // Clean up
    await agent.close();
  }
}

main().catch(console.error);
```

## Implementation Notes

### LLM Integration

The agent supports three types of LLM interaction:

1. **Function Calling**: For models that support OpenAI-style function calling (e.g., GPT-4)
2. **Raw Text**: For models that return JSON in text format (e.g., DeepSeek)
3. **Standard**: For models that return structured JSON responses

### Action Handling

Actions are executed through a controller, which implements the actual browser interactions. The agent handles:

- Multiple actions per step
- Updating element indices when the page changes
- Special handling for the "done" action
- Error recovery

### Browser State

The agent extracts the following information from the browser:

- Current URL and title
- Open tabs
- Screenshot (for vision models)
- Clickable elements with their attributes

## Known Issues

1. Type definitions for browser integration need refinement
2. Memory system is not fully implemented
3. Element tracking across page changes needs improvement

## Next Steps

1. Complete the browser state integration
2. Implement the memory system
3. Add comprehensive testing
4. Add examples for different LLM providers
5. Improve type safety throughout 