import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'packages/core/src/graph.ts',
        'packages/core/src/learning.ts',
        'apps/api/src/app.ts',
        'apps/api/src/store.ts',
      ],
    },
  },
});
