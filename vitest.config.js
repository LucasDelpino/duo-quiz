import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js'],
      exclude: ['js/vendor.js', 'js/config.js'],
      reporter: ['text-summary', 'text'],
    },
  },
});
