# Testing Guide for SIM Frontend

## Overview

This project uses Vitest for JavaScript testing, following Kent Beck's Test-Driven Development (TDD) principles.

## Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Run all tests once
npm test

# Run tests in watch mode (recommended for TDD)
npm run test:watch

# Run tests with coverage
npm run coverage

# Open Vitest UI for interactive testing
npm run test:ui
```

## TDD Workflow

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to pass the test
3. **Refactor**: Improve code structure while keeping tests green

## Testing Strategies

### 1. Testing New Modules

For new testable modules, use ES6 exports:

```javascript
// src/app/core/static/js/my-module.js
export class MyModule {
  // ... implementation
}

// tests/my-module.test.js
import { MyModule } from "../src/app/core/static/js/my-module.js";
```

### 2. Testing Existing Global Code

For existing code that attaches to window:

```javascript
import { loadScript } from "./helpers/load-script.js";

describe("Existing Module", () => {
  let window;

  beforeEach(() => {
    window = loadScript("src/app/core/static/js/existing-module.js");
  });

  it("should work with global instance", () => {
    const module = window.existingModule;
    // ... test the module
  });
});
```

### 3. Mocking Dependencies

Common mocks are configured in `tests/setup.js`:

- `fetch` - for API calls
- `WebSocket` - for real-time connections
- `localStorage` - for client storage

## Writing Tests

### Basic Test Structure

```javascript
describe("Module Name", () => {
  describe("method name", () => {
    it("should do something specific", () => {
      // Arrange
      const input = "test";

      // Act
      const result = myFunction(input);

      // Assert
      expect(result).toBe("expected");
    });
  });
});
```

### Testing Async Code

```javascript
it("should handle async operations", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: "test" }),
  });

  const result = await myAsyncFunction();

  expect(result).toEqual({ data: "test" });
});
```

### Testing Error Cases

```javascript
it("should throw on invalid input", async () => {
  await expect(myFunction("invalid")).rejects.toThrow("Expected error message");
});
```

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how
2. **Keep Tests Small**: Each test should verify one thing
3. **Use Descriptive Names**: Test names should explain what is being tested
4. **Follow AAA Pattern**: Arrange, Act, Assert
5. **Don't Test External Libraries**: Mock them instead
6. **Run Tests Before Committing**: Ensure all tests pass

## Coverage Goals

- Aim for 80%+ code coverage
- Focus on critical paths first
- Don't chase 100% - some code may not need tests

## Debugging Tests

1. Use `console.log` in tests to debug
2. Run specific test file: `npm test auth-api.test.js`
3. Use Vitest UI for visual debugging: `npm run test:ui`
4. Add `.only` to run single test: `it.only('test name', ...)`

## Next Steps

1. Add tests for critical user flows (authentication, data lookup)
2. Set up E2E tests with Playwright for integration testing
3. Integrate tests into CI/CD pipeline
4. Add pre-commit hooks to run tests automatically
