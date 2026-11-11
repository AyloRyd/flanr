import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'api',
    globalSetup: ['./test/global-setup.ts'],
    // Integration tests share one test database.
    fileParallelism: false,
  },
});
