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

| Command          | What it does                                 |
| ---------------- | -------------------------------------------- |
| `pnpm typecheck` | Type-check all packages                      |
| `pnpm lint`      | ESLint                                       |
| `pnpm format`    | Prettier                                     |
| `pnpm test`      | Unit and integration tests (Vitest)          |
| `pnpm test:e2e`  | End-to-end tests (Playwright)                |
| `pnpm db:down`   | Stop the database (data is kept in a volume) |

Before the first end-to-end run, install the browser: `pnpm --filter @flanr/web exec playwright install chromium`.

## Repository layout

```
apps/web               Next.js web client
apps/api               Hono API
packages/shared        Types and zod schemas shared by web and API
packages/data-import   City data import from OpenStreetMap and Wikidata
docs/                  Concept, requirements, plan and decisions
```
