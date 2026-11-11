import { runMigrations } from './index.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

await runMigrations(databaseUrl);
console.log('Migrations applied');
