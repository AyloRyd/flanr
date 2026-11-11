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

| Command            | What it does                                 |
| ------------------ | -------------------------------------------- |
| `pnpm typecheck`   | Type-check all packages                      |
| `pnpm lint`        | ESLint                                       |
| `pnpm format`      | Prettier                                     |
| `pnpm test`        | Unit and integration tests (Vitest)          |
| `pnpm test:e2e`    | End-to-end tests (Playwright)                |
| `pnpm db:down`     | Stop the database (data is kept in a volume) |
| `pnpm db:migrate`  | Apply database migrations                    |
| `pnpm db:generate` | Generate a migration from schema changes     |

Before the first end-to-end run, install the browser: `pnpm --filter @flanr/web exec playwright install chromium`.

## City data

Cities come from OpenStreetMap. Download a country extract from [Geofabrik](https://download.geofabrik.de/) into `data/raw/geofabrik/` (the `data/` folder is gitignored), then run:

```bash
pnpm db:migrate
pnpm import:osm --country DE --pbf data/raw/geofabrik/germany-latest.osm.pbf
```

The import filters the extract with osmium (it runs in Docker, nothing to install), loads it into staging tables, links settlements with their boundaries and regions, validates the result and applies it in one transaction. It can be re-run at any time; cities keep their IDs. Germany takes about five minutes.

Unit and integration tests need the database to be running (`pnpm db:up`). They use a separate `flanr_test` database.

## Repository layout

```
apps/web               Next.js web client
apps/api               Hono API
packages/shared        Types and zod schemas shared by web and API
packages/db            Drizzle schema, migrations and database client
packages/data-import   City data import from OpenStreetMap and Wikidata
tools/osmium           Docker image with osmium for processing OSM extracts
docs/                  Concept, requirements, plan and decisions
```
