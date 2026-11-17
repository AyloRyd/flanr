import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'web',
    // Unit tests of plain functions; the pages are covered by the Playwright tests in e2e/.
    include: ['lib/**/*.test.ts'],
  },
});
