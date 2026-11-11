import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  // Tables created by the PostGIS extension are not ours to manage.
  extensionsFilters: ['postgis'],
});
