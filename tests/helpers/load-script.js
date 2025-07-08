import { readFileSync } from 'fs';
import { join } from 'path';
import { JSDOM } from 'jsdom';

/**
 * Helper to load and execute vanilla JS files that attach to window
 * This allows testing existing code without major refactoring
 */
export function loadScript(scriptPath) {
  const fullPath = join(process.cwd(), scriptPath);
  const scriptContent = readFileSync(fullPath, 'utf8');
  
  // Create a new JSDOM instance with the script
  const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost',
    beforeParse(window) {
      // Add any globals your scripts expect
      Object.defineProperty(window, 'localStorage', {
        value: global.localStorage,
        writable: true
      });
      Object.defineProperty(window, 'fetch', {
        value: global.fetch,
        writable: true
      });
      Object.defineProperty(window, 'WebSocket', {
        value: global.WebSocket,
        writable: true
      });
    }
  });
  
  // Execute the script in the JSDOM context
  const scriptElement = dom.window.document.createElement('script');
  scriptElement.textContent = scriptContent;
  dom.window.document.body.appendChild(scriptElement);
  
  return dom.window;
}