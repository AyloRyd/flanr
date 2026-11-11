import postgres from 'postgres';

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://flanr:flanr@localhost:5433/flanr_test';

export function connectTestDatabase() {
  return postgres(testDatabaseUrl, { max: 1, onnotice: () => {} });
}
