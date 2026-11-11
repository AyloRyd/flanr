# Flanr — MVP Implementation Plan

| Field | Value |
|---|---|
| Version | 0.1 |
| Date | 2026-11-09 |
| Based on | SRS.md v0.2, CONCEPT.md |
| Scope | All requirements with Release = MVP. The MVP is web only: the web client and the API. Mobile apps are not part of the MVP, but the API is designed so that a mobile client can use it later (NFR-PORT-003). |

The plan is split into phases. Each phase ends with a working, testable state. Requirement IDs refer to SRS.md.

---

## Phase 0 — Decisions before coding

Resolve the open issues that block the MVP. Each decision is recorded in the spec.

- [x] OI-002 — choose the OSM extract for the import. Decided: Geofabrik regional extracts processed with osmium. Geoapify localities was chosen first and dropped after checking its data, see DECISIONS.md.
- [x] OI-003 — settlements without a boundary: import as point only (recommended) or skip.
- [ ] OI-005 — what happens to a rating when all visits to the city are deleted (recommended: the rating is deleted too, since BR-005 requires a visit).
- [ ] OI-007 — confirm rounding of the suggested rating to 0.5.
- [ ] OI-008 — approximate dates in the calendar (recommended for MVP: not shown, only counted in the coverage note).
- [ ] OI-010 — username rules.
- [ ] OI-011 — minimum number of ratings for sorting by community rating (recommended: 3).
- [ ] OI-017 — hosting (recommended: one VPS in Germany with about 8 GB RAM running web, API and database in Docker, plus a cheap domain; see the hosting discussion).
- [ ] OI-019 — whether lived-in cities have a period (from, to). Lived-in cities themselves are specified in BR-016 and FR-VIS-010.

**Done when:** all items above have a decision written into the spec.

---

## Phase 1 — Repository and tooling

- [x] Monorepo with pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`, `packages/data-import` (CON-008).
- [x] TypeScript strict mode, shared tsconfig, ESLint, Prettier (NFR-MAINT-001).
- [x] Docker Compose for local PostgreSQL with PostGIS.
- [x] Vitest for unit tests, Playwright for end-to-end tests.
- [x] GitHub Actions: typecheck, lint, tests on every push.
- [x] Environment variable handling, no secrets in the repository (NFR-SEC-006).
- [x] Concept, spec and this plan committed to `docs/`. The owner's test data stays local in `test-data/travels.csv`, which is gitignored because the repository is public.

**Done when:** a fresh clone runs `pnpm install && pnpm dev` with an empty web page, an API health endpoint and a running database.

---

## Phase 2 — City data pipeline

- [x] Drizzle schema for countries, regions, cities, city names (section 5.2), with PostGIS geometry columns and spatial indexes.
- [x] Import from the chosen OSM extract: city, town, village, hamlet; exclude suburbs and boroughs (BR-001, FR-CITY-005).
- [ ] Roll out in stages (CON-012): Germany first (done), then continental Europe (covers all countries in the test data). The whole world comes after the MVP.
- [x] Enrichment from Wikidata: population with year, Wikipedia link, English and alternative names, area, elevation, website and founding year (FR-CITY-002). Done through the Wikidata API instead of SPARQL or a dump. Capital status comes from OSM. Images, coats of arms and flags are left for later because they need author and licence data from Commons (NFR-LIC-003).
- [x] Boundary simplification for different zoom levels.
- [x] Vector tiles for the city layer (points and boundaries), either generated as PMTiles or served from PostGIS with `ST_AsMVT`. Both exist. The MVP map uses the API tiles; revisit after the Europe import (see DECISIONS.md and `docs/notes/tile-delivery.md`).
- [x] Re-runnable import that updates by source IDs and runs in a transaction (FR-CITY-006, NFR-REL-002).
- [x] Attribution data stored for OSM, Wikidata and Commons (NFR-LIC).
- [x] Municipalities: import them as reference data, link each city to its municipality, give a city that represents its municipality the municipality's boundary, and take the Wikidata ID from the linked boundary when the settlement has none (BR-001, BR-017).

**Done when:** all cities from the test data exist in the database with boundaries where OSM has them, and Ostia, Lyngby, Körbecke and Hoogezand are checked by hand against BR-001.

---

## Phase 3 — API foundation

- [ ] Hono app with `@hono/zod-openapi`; OpenAPI 3.1 document generated from the schemas (CON-009, section 6.2).
- [ ] Clerk token verification middleware, user sync through Clerk webhooks (FR-AUTH-003…005).
- [ ] Roles and authorisation checks (FR-AUTH-010, NFR-SEC-003).
- [ ] RFC 9457 error format, pagination helpers, rate limiting for write endpoints (NFR-SEC-004).
- [ ] Generated typed API client in `packages/shared` for the web app.

**Done when:** a signed-in request reaches a protected endpoint, an unsigned one gets a 401 in Problem Details format, and the OpenAPI document is served.

---

## Phase 4 — Core domain

Each business rule gets unit tests before or together with its implementation (NFR-MAINT-002).

- [ ] Visits: create, edit, delete, date precision, no future dates, undated visits before registration, date required after registration (FR-VIS-001…006, BR-002, BR-003).
- [ ] Setting the number of undated visits directly (FR-VIS-005).
- [ ] Lived-in cities, current and past (FR-VIS-010, BR-016).
- [ ] Planned list and derived Visited list, automatic move on first visit (FR-LIST-001…002, BR-004).
- [ ] Ratings: subjective rating, criteria, suggested value, change and delete, one per user and city, rating requires a visit (FR-RATE-001…004, BR-005…BR-008).
- [ ] Criteria management for administrators (FR-RATE-006).
- [ ] Community rating and per-criterion averages, including private profiles (FR-CITY-003, FR-RATE-005, BR-009, FR-PRIV-002).
- [ ] Custom lists: create, rename, delete, entries, order, notes, visibility (FR-LIST-003…005).
- [ ] Profile: username, display name, avatar, bio, home location with visibility (FR-PROF-001…003).
- [ ] Profile visibility and filtering of private content everywhere (FR-PRIV-001…003).
- [ ] Account deletion with removal of personal data (FR-AUTH-009, section 5.4).
- [ ] Data export as JSON (NFR-GDPR-003).

**Done when:** all business rules in section 3 that apply to the MVP have passing tests and all endpoints are in the OpenAPI document.

---

## Phase 5 — Search

- [ ] PostgreSQL search over all city names with `unaccent` and `pg_trgm` (FR-SRCH-001).
- [ ] Results with country, region and settlement type (FR-SRCH-002).
- [ ] Filters and sorting, including minimum rating and the minimum-ratings threshold (FR-SRCH-003).
- [ ] Search over public custom lists (FR-SRCH-004, FR-LIST-006).

**Done when:** the acceptance criteria of FR-SRCH-001…004 pass, including "Cologne", "Koln", "Kiev" and "Frankfurt", and search stays under 300 ms (NFR-PERF-002).

---

## Phase 6 — Web foundation

- [ ] Next.js App Router with SSR, Tailwind CSS and a component library (for example shadcn/ui) (CON-002).
- [ ] Clerk integration: sign-up and sign-in with email and password, email code and Google; sign-out; change email (FR-AUTH-003…008).
- [ ] Registration prompt on write actions with return to the same page (FR-AUTH-002).
- [ ] i18n setup with all text in English translation files (NFR-L10N-001…003).
- [ ] Layout, navigation, responsive design from 360 px (NFR-UX-001).

**Done when:** a guest can browse, and a user can sign up, sign in and sign out in desktop and mobile browsers.

---

## Phase 7 — Web pages

- [ ] City page: required and optional data, community rating, personal data, log visit, rate, add to lists (FR-CITY-001…004).
- [ ] Links to external maps on the city page (FR-CITY-009).
- [ ] Visit form with date precision and the "before registration" option, help hint with the recommended visit model (FR-VIS-002, FR-VIS-003, FR-VIS-008).
- [ ] Rating form with criteria and the suggested subjective rating (FR-RATE-001…003).
- [ ] Search page for cities and lists (Phase 5).
- [ ] Profile page with lists, ratings, map and statistics (FR-PROF-004).
- [ ] List pages and list editing (FR-LIST-003…005).
- [ ] Onboarding flow for past visits (FR-VIS-007).
- [ ] Settings: account, profile, visibility, data export, account deletion.

**Done when:** all MVP acceptance criteria of these requirements pass manually and the key flows are covered by Playwright.

---

## Phase 8 — Map

- [ ] Mapbox GL JS with standard and satellite styles, globe at low zoom (FR-MAP-001…002).
- [ ] City layer from Flanr's own vector tiles, served by the API (FR-MAP-003).
- [ ] Click on a city: boundary highlight and preview (FR-MAP-004).
- [ ] Three map modes with legends (FR-MAP-005).
- [ ] Planned cities as a separate layer (FR-MAP-006).
- [ ] Map on public profiles (FR-MAP-007).
- [ ] Map and data attribution (NFR-LIC-001).

**Done when:** the test user's 161 cities are shown in all three modes and the map stays smooth (NFR-PERF-003).

---

## Phase 9 — Statistics

- [ ] Summary: cities, countries, visits (FR-STAT-001).
- [ ] Statistics by country and first-level region (FR-STAT-002).
- [ ] Trip calendar from dated visits, with the coverage note (FR-STAT-003…004).
- [ ] Global statistics for guests: most visited and best rated cities (FR-STAT-005).

**Done when:** the statistics for the test user match numbers calculated by hand from the test data.

---

## Phase 10 — Test data

- [ ] Seed script that reads `test-data/travels.csv` and matches each row to a city by name, country and region, with a report of unmatched or ambiguous rows.
- [ ] Creates undated visits before registration with the given count, and ratings from the `Rating` column.
- [ ] Rows with `Lived` become lived-in cities (FR-VIS-010) without visits.
- [ ] Creates a test user and a second user with a private profile for privacy tests.
- [ ] Automated tests and CI use a small made-up fixture in the same CSV format, committed to the repository. The real `test-data/travels.csv` is only read when it exists locally.

**Done when:** the seed runs on an empty database and all 161 rows are either imported or listed in the report with a reason.

---

## Phase 11 — Compliance, quality and deployment

- [ ] Privacy policy and imprint pages (NFR-GDPR-001).
- [ ] Hosting in the EU for API and database (NFR-GDPR-005), daily backups kept for 7 days (NFR-REL-001).
- [ ] Production deployment pipeline from GitHub.
- [ ] Monthly scheduled city data import with validation (FR-CITY-006).
- [ ] Accessibility check against WCAG 2.2 AA for the main pages (NFR-UX-002).
- [ ] Performance check: city page LCP, search latency (NFR-PERF-001…002).
- [ ] Security pass against OWASP ASVS level 1 (NFR-SEC-005).
- [ ] Full run of all MVP acceptance criteria; status of each requirement set to `Verified` in the spec.

**Done when:** Flanr runs in production and all MVP requirements are verified.

---

## Order and dependencies

```
Phase 0 → Phase 1 → Phase 2 ─┬→ Phase 3 → Phase 4 → Phase 5 ─┐
                             │                                ├→ Phase 7 → Phase 9 → Phase 10 → Phase 11
                             └→ Phase 6 ──────────────────────┤
                                                Phase 8 ──────┘ (needs Phase 2 tiles and Phase 6)
```

Phases 2 and 6 can run in parallel. The map (Phase 8) can start as soon as the city tiles from Phase 2 and the web foundation from Phase 6 exist.
