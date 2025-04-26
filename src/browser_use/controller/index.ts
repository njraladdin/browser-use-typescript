/**
 * Controller module for browser-use-typescript
 * This module contains exports for browser control components
 */

// Export the Controller class and all related interfaces from controller.ts
export { 
  Controller, 
  Context,
  DoneAction,
  GoToUrlAction, 
  SearchGoogleAction,
  ClickElementAction,
  InputTextAction,
  ScrollAction,
  SwitchTabAction,
  OpenTabAction,
  CloseTabAction,
  Position,
  DragDropAction
} from './controller';

// Export other components from controller submodules
export * from './types';
export * from './registry'; 