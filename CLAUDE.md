# Flanr

Flanr is a web app for tracking and rating visited cities, similar to Letterboxd and Strava. This repository contains the MVP: a Next.js web client and a standalone Hono API. Mobile apps are not part of the MVP.

## Documents

- `docs/CONCEPT.md` — product concept, the source of intent.
- `docs/SRS.md` — requirements (SRS). The source of truth for behaviour.
- `docs/MVP.md` — implementation plan by phases.
- `test-data/travels.csv` — real travel data of the owner, used for seeding and tests. It is personal data and stays local: the folder is gitignored and the repository is public. Never commit it or copy its rows into fixtures.

Before working on a feature, read the relevant requirements in the spec. Reference requirement IDs (for example `FR-VIS-004`, `BR-002`) in commit messages, PR descriptions and test names.

If the spec is unclear, contradicts itself or is missing something, stop and ask instead of guessing. Do not change the spec or the concept without asking. When a decision is made, update the spec and, if needed, the plan.

## Stack

- Monorepo with pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`, `packages/data-import`.
- TypeScript in strict mode everywhere.
- Web: Next.js (App Router, SSR), Tailwind CSS, Clerk, Mapbox GL JS.
- API: Hono with `@hono/zod-openapi`. The OpenAPI document is generated from the zod schemas and is the API contract.
- Database: PostgreSQL with PostGIS, Drizzle ORM, versioned migrations.
- Tests: Vitest for unit and integration tests, Playwright for end-to-end tests.

## Rules

- The web client never accesses the database directly. All data goes through the API.
- Shared types and schemas live in `packages/shared`.
- Every business rule from section 3 of the spec has automated tests.
- Validate all API input with zod. Return errors in RFC 9457 format.
- Check authorisation on every API request that reads or changes user data.
- No secrets in the repository. Use `.env` files that are gitignored, with `.env.example` committed.
- All user-facing text goes into translation files (English only for now).
- Keep changes small and focused on one phase or requirement at a time.

## Working with the owner

The owner reviews all code. Write code that is easy to read and review: clear names, small functions, comments only where the reason is not obvious. Explain non-obvious decisions in the PR description.

Chat with the owner in Russian or English. All code, comments, commit messages and documents are in English.
