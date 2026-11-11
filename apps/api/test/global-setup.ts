import { prepareTestDatabase } from '@flanr/db/testing';
import { testDatabaseUrl } from './database.ts';

export default async function setup(): Promise<void> {
  await prepareTestDatabase(testDatabaseUrl);
}
