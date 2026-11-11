import { runMigrations } from '@flanr/db';
import postgres from 'postgres';
import { testDatabaseUrl } from './database.ts';

/** Creates the test database if needed and brings it to the latest migration. */
export default async function setup(): Promise<void> {
  const url = new URL(testDatabaseUrl);
  const name = url.pathname.slice(1);
  const admin = postgres({
    ...connectionOf(url),
    database: 'postgres',
    max: 1,
    onnotice: () => {},
  });
  const [exists] = await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
  if (!exists) {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  }
  await admin.end();

  await runMigrations(testDatabaseUrl);
}

function connectionOf(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}
