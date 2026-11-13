import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { noAccountStore } from './accounts.ts';
import { createApp } from './app.ts';
import { noDefaultListStore } from './default-lists.ts';
import { noListStore } from './lists.ts';
import { noLivedCityStore } from './lived-cities.ts';
import { noRatingStore } from './ratings.ts';
import { noProfileStore } from './users.ts';
import { noVisitStore } from './visits.ts';

/**
 * Writes the OpenAPI document to packages/shared/openapi.json. That file is the API contract
 * (CON-009): the typed client is generated from it, not from the Hono app, so a backend in
 * another language only has to serve the same document.
 */
const contractFile = resolve(import.meta.dirname, '../../../packages/shared/openapi.json');

// The document depends only on the route definitions, so the app needs no real services.
const app = createApp({
  checkDatabase: async () => false,
  getCityTile: async () => null,
  corsOrigins: [],
  verifyToken: async () => null,
  resolveUser: async () => {
    throw new Error('Not available while writing the OpenAPI document');
  },
  readWebhook: async () => null,
  applyUserEvent: async () => {},
  visits: noVisitStore,
  livedCities: noLivedCityStore,
  defaultLists: noDefaultListStore,
  ratings: noRatingStore,
  lists: noListStore,
  profiles: noProfileStore,
  accounts: noAccountStore,
});

const response = await app.request('/openapi.json');
await writeFile(contractFile, `${JSON.stringify(await response.json(), null, 2)}\n`);
console.log(`Wrote ${contractFile}`);
