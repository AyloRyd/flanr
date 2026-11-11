import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'data-import',
    globalSetup: ['./test/global-setup.ts'],
    // Integration tests share one test database.
    fileParallelism: false,
  },
});
