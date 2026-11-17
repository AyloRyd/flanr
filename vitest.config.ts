import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/api', 'apps/web', 'packages/shared', 'packages/data-import'],
  },
});
