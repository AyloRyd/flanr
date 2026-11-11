import postgres from 'postgres';
import { runMigrations } from './index.ts';

/** Creates the database behind the URL if it does not exist and brings it to the latest migration. */
export async function prepareTestDatabase(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const name = url.pathname.slice(1);
  const admin = postgres({
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: 'postgres',
    max: 1,
    onnotice: () => {},
  });
  try {
    const [exists] = await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (!exists) {
      await admin.unsafe(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.end();
  }
  await runMigrations(databaseUrl);
}
