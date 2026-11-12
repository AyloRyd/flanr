# Flanr

Track and rate the cities you visit. Flanr is a web app in the spirit of Letterboxd and Strava, for cities.

This repository contains the MVP: a Next.js web client and a Hono API on PostgreSQL with PostGIS.

- [Concept](docs/CONCEPT.md)
- [Requirements (SRS)](docs/SRS.md)
- [MVP plan](docs/MVP.md)
- [Decisions log](docs/DECISIONS.md)

## Development

Requirements: Node.js 24 or newer, pnpm 10, Docker.

```bash
cp .env.example .env
pnpm install
pnpm dev
```

`pnpm dev` starts the database in Docker and runs both apps:

| Service  | URL                          |
| -------- | ---------------------------- |
| Web      | http://localhost:3000        |
| API      | http://localhost:8787/health |
| Database | localhost:5433               |

### Other commands

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `pnpm typecheck`    | Type-check all packages                         |
| `pnpm lint`         | ESLint                                          |
| `pnpm format`       | Prettier                                        |
| `pnpm test`         | Unit and integration tests (Vitest)             |
| `pnpm test:e2e`     | End-to-end tests (Playwright)                   |
| `pnpm db:down`      | Stop the database (data is kept in a volume)    |
| `pnpm db:migrate`   | Apply database migrations                       |
| `pnpm db:generate`  | Generate a migration from schema changes        |
| `pnpm api:contract` | Write the OpenAPI document and the client types |

After changing an API route or its schemas, run `pnpm api:contract`. It writes the OpenAPI document to `packages/shared/openapi.json` and generates the types of the API client from it; both files are committed, and the tests fail when they are out of date. The web client calls the API through `createApiClient` from `@flanr/shared`.

Before the first end-to-end run, install the browser: `pnpm --filter @flanr/web exec playwright install chromium`.

## City data

Cities come from OpenStreetMap. Download a country extract from [Geofabrik](https://download.geofabrik.de/) into `data/raw/geofabrik/` (the `data/` folder is gitignored), then run:

```bash
pnpm db:migrate
pnpm import:osm --country DE --pbf data/raw/geofabrik/germany-latest.osm.pbf
pnpm import:wikidata --country DE
```

Countries set up so far are listed in `packages/data-import/src/countries.ts`. Vatican City and San Marino are inside the Italy extract and are imported from its files: `pnpm import:osm --country VA --files-of IT --skip-extract`. The United Kingdom is spread over two extracts, so `--pbf` is given twice: `pnpm import:osm --country GB --pbf data/raw/geofabrik/great-britain-latest.osm.pbf --pbf data/raw/geofabrik/ireland-and-northern-ireland-latest.osm.pbf`. A new country needs an entry in `packages/data-import/src/countries.ts` that says at which OpenStreetMap admin levels its regions and municipalities are. `--extract-only` writes the filtered files without touching the database, which helps to look at the levels first.

Every city is also linked to its municipality. A city that is its municipality (Cologne) gets the municipality's boundary; a village inside it (Worringen) stays a city of its own and is marked as part of it.

The import filters the extract with osmium (it runs in Docker, nothing to install), loads it into staging tables, links settlements with their boundaries and regions, validates the result and applies it in one transaction. It can be re-run at any time; cities keep their IDs. Germany takes about five minutes.

`import:wikidata` fetches the Wikidata items that the cities link to into our own copy and fills population, English names, Wikipedia links, area, elevation, website and founding year from it. It asks Wikidata only for items that are new or older than 30 days, and it continues where it stopped if interrupted. The first run for Germany makes about 850 requests. Later OSM imports reuse the stored copy without calling Wikidata.

### Map tiles

The API serves the city layer as vector tiles at `/tiles/cities/{z}/{x}/{y}.mvt`, built by PostGIS from boundaries that the import simplifies per zoom range. `pnpm tiles:build` builds the same layer as a PMTiles archive in `data/tiles/`. `tools/tile-bench` has a map page to look at both.

Unit and integration tests need the database to be running (`pnpm db:up`). They use a separate `flanr_test` database.

## Repository layout

```
apps/web               Next.js web client
apps/api               Hono API
packages/shared        Types and zod schemas shared by web and API, the API contract and client
packages/db            Drizzle schema, migrations and database client
packages/data-import   City data import from OpenStreetMap and Wikidata
tools/osmium           Docker image with osmium for processing OSM extracts
tools/tippecanoe       Docker image with tippecanoe for building PMTiles
tools/tile-bench       Map stand and measurements for the city tiles
docs/                  Concept, requirements, plan and decisions
```
