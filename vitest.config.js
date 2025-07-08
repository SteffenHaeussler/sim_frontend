import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/app/core/static/js/**/*.js'],
      exclude: ['**/node_modules/**', '**/tests/**']
    }
  }
});