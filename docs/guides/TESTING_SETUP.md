# Testing Setup Guide

## Install Testing Dependencies

Run the following command to install all required testing dependencies:

```bash
npm install --save-dev vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

## Update package.json

Add the following to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Create vitest.config.ts

Create a file `vitest.config.ts` in the root directory:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
        'src/vite-env.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

## Create tests/setup.ts

Create a file `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};
global.localStorage = localStorageMock as any;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};
global.sessionStorage = sessionStorageMock as any;

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  // Keep error for debugging
  error: console.error,
};
```

## Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- authService.test.ts
```

## CI/CD Integration

Add to your `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Generate coverage
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella
```

## What Gets Tested

Our test suite covers:

1. **Authentication Service** (`tests/authService.test.ts`)
   - Sign in with valid/invalid credentials
   - Sign out (including on failure)
   - Sign up with validation
   - getCurrentUser with various states
   - Timeout handling
   - Error handling

2. **Auth Context** (`tests/AuthContext.test.tsx`)
   - Initial loading state
   - Session hydration
   - Auth state changes
   - Profile setup detection
   - Subscription cleanup
   - Loading timeout behavior

## Test Coverage Goals

- **Auth flows**: >90% coverage
- **Core services**: >80% coverage
- **Components**: >70% coverage
- **Overall**: >75% coverage

## Troubleshooting Tests

### "Cannot find module" errors
Make sure all dependencies are installed:
```bash
npm install
```

### Tests timing out
Increase timeout in test:
```typescript
it('should handle slow operation', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Mock not working
Ensure mock is before imports:
```typescript
vi.mock('../lib/supabase', () => ({
  supabase: { /* mock */ }
}));

import { MyComponent } from '../MyComponent';
```

### Tests failing intermittently
Add proper async/await and waitFor:
```typescript
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```
