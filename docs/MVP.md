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
- [x] OI-005 — what happens to a rating when all visits to the city are deleted. Decided: the rating is deleted too, after a confirmation (BR-005).
- [x] OI-007 — rounding of the suggested rating. Decided: to the nearest 0.5, halves up (BR-007).
- [x] OI-008 — approximate dates in the calendar. Decided for the MVP, to be revisited after it: the calendar covers only the period in which every visit has a day; earlier visits are counted in a note (FR-STAT-003).
- [x] OI-010 — username rules. Decided: 3–30 characters, changeable at any time, see FR-PROF-001.
- [x] OI-011 — minimum number of ratings for sorting by community rating. Decided: the user sets it in the sorting form; the default is 10 and will be raised to 100 or more once there are real users (FR-SRCH-003).
- [ ] OI-017 — hosting (most likely a Hetzner VPS; recommended: one VPS in Germany with about 8 GB RAM running web, API and database in Docker, plus a cheap domain; see the hosting discussion).
- [x] OI-019 — whether lived-in cities have a period (from, to). Decided: an optional period that is not part of time-based statistics (BR-016).

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
- [x] Roll out in stages (CON-012): Germany first, then the other countries in the test data and a few small ones, then the rest of continental Europe (47 countries in all). Not imported yet: Cyprus (fails validation, the northern districts have no ISO 3166-2 code; needs a decision), Jersey (no country boundary in the extract), the Canary Islands, Ceuta and Gibraltar (not in the extracts used), Russia, Turkey and Georgia (left out for now). The whole world comes after the MVP.
- [x] Enrichment from Wikidata: population with year, Wikipedia link, English and alternative names, area, elevation, website and founding year (FR-CITY-002). Done through the Wikidata API instead of SPARQL or a dump. Capital status comes from OSM. Images, coats of arms and flags are left for later because they need author and licence data from Commons (NFR-LIC-003).
- [x] Boundary simplification for different zoom levels.
- [x] Vector tiles for the city layer (points and boundaries), either generated as PMTiles or served from PostGIS with `ST_AsMVT`. Both exist. The MVP map uses the API tiles; revisit after the Europe import (see DECISIONS.md and `docs/notes/tile-delivery.md`).
- [x] Re-runnable import that updates by source IDs and runs in a transaction (FR-CITY-006, NFR-REL-002).
- [x] Attribution data stored for OSM, Wikidata and Commons (NFR-LIC).
- [x] Municipalities: import them as reference data, link each city to its municipality, give a city that represents its municipality the municipality's boundary, and take the Wikidata ID from the linked boundary when the settlement has none (BR-001, BR-017).

**Done when:** all cities from the test data exist in the database with boundaries where OSM has them, and Ostia, Lyngby, Körbecke and Hoogezand are checked by hand against BR-001.

---

## Phase 3 — API foundation

- [x] Hono app with `@hono/zod-openapi`; OpenAPI 3.1 document generated from the schemas (CON-009, section 6.2).
- [x] Clerk token verification middleware, user sync through Clerk webhooks (FR-AUTH-003…005).
- [x] Roles and authorisation checks (FR-AUTH-010, NFR-SEC-003).
- [x] RFC 9457 error format, pagination helpers, rate limiting for write endpoints (NFR-SEC-004).
- [x] Generated typed API client in `packages/shared` for the web app. The OpenAPI document is committed as `packages/shared/openapi.json`; the types are generated from that file, not from the Hono app (`pnpm api:contract`), and tests fail when either is out of date.

**Done when:** a signed-in request reaches a protected endpoint, an unsigned one gets a 401 in Problem Details format, and the OpenAPI document is served.

---

## Phase 4 — Core domain

Each business rule gets unit tests before or together with its implementation (NFR-MAINT-002).

- [x] Visits: create, edit, delete, date precision, no future dates, undated visits before registration, date required after registration (FR-VIS-001…006, BR-002, BR-003). API only; removing a city from the Planned list (BR-004) and deleting the rating with the last visit (BR-005) come with the lists and the ratings.
- [x] Setting the number of undated visits directly (FR-VIS-005).
- [x] Lived-in cities, current and past, with an optional period (FR-VIS-010, BR-016). API only; that a lived-in city counts as visited and can be rated comes with the lists and the ratings, the home location with the profile.
- [x] Planned list and derived Visited list, automatic move on first visit (FR-LIST-001…002, BR-004). API only. A lived-in city is in the Visited list too; marking a city as lived-in also takes it off the Planned list.
- [x] Ratings: subjective rating, criteria, suggested value, change and delete, one per user and city, rating requires a visit (FR-RATE-001…004, BR-005…BR-008). API only. Removing the last visit or the lived-in mark of a rated city is answered with 409 until the request carries the confirmation, then the rating is deleted with it. The suggested value is a function in `packages/shared` for the rating form.
- [x] Criteria management for administrators (FR-RATE-006). API only: add, rename, reorder, switch off and on. A criterion is never deleted; switching it off keeps its ratings.
- [x] Community rating and per-criterion averages, including private profiles (FR-CITY-003, FR-RATE-005, BR-009, FR-PRIV-002). API only. The averages are computed on request from all ratings; private profiles do not exist yet, so the test for them comes with profile visibility.
- [x] Custom lists: create, rename, delete, entries, order, notes, visibility (FR-LIST-003…005). API only, for the owner: the visibility is stored and can be changed, but nobody else can read a list yet. Showing public lists to others, and the visibility of the two default lists, come with the profile and profile visibility items below.
- [x] Profile: username, display name, avatar, bio, home location with visibility (FR-PROF-001…003). API only: `PATCH /v1/me` and the public profile `GET /v1/users/{username}`, which already shows only the names of a private profile. The settings for profile visibility and for the visibility of the Visited and Planned lists are stored here; the lists, ratings and visits of other users, and their filtering, are the next item.
- [x] Profile visibility and filtering of private content everywhere (FR-PRIV-001…003). API only: the Visited and Planned lists, the ratings and the public custom lists of a user under `/v1/users/{username}/…`. A private profile shows none of them, a private list is hidden on a public profile. The Visited list of another user has the number of visits and the lived-in marks too, but not which lived-in city is the current one (SRS 0.16). Global statistics (FR-PRIV-003) come with phase 9.
- [x] Account deletion with removal of personal data (FR-AUTH-009, section 5.4). `DELETE /v1/me?confirm=true` deletes the account at Clerk first and then everything Flanr stores; if Clerk fails, nothing is deleted. The call to Clerk is covered by a stand-in in the tests and has not been tried against the real Clerk application yet.
- [x] Data export as JSON (NFR-GDPR-003). `GET /v1/me/export`: profile, visits, lived-in and planned cities, ratings, lists with entries, and what the city IDs stand for.

**Done when:** all business rules in section 3 that apply to the MVP have passing tests and all endpoints are in the OpenAPI document.

---

## Phase 5 — Search

- [x] PostgreSQL search over all city names with `unaccent` and `pg_trgm` (FR-SRCH-001). `GET /v1/cities?q=`: exact names first, then main names that start with the query, then close spellings; the largest city first. Measured on the 47 imported countries (985,736 cities, 2.5 million names) with 1,382 typed-out queries: median 19 ms, 95th percentile 109 ms, slowest 368 ms, at the query, on the development machine (NFR-PERF-002).
- [x] Results with country, region and settlement type (FR-SRCH-002), and the municipality for a city that is part of one.
- [x] Filters and sorting, including minimum rating and the minimum-ratings threshold (FR-SRCH-003). `GET /v1/cities` takes the filters and the sorting with or without a search text; `GET /v1/countries` and `GET /v1/countries/{code}/regions` feed the filter form. The community rating is computed from the ratings on request; it will need a stored value once there are many ratings.
- [x] Search over public custom lists (FR-SRCH-004, FR-LIST-006). `GET /v1/public-lists?q=`, open to guests: lists whose title or description contains every word of the query, without letter case and diacritics; lists with all words in the title first, then the longer ones. Only public lists are found, also those of private profiles (SRS 0.12). A trigram index on the title and description keeps it fast once there are many lists.

**Done when:** the acceptance criteria of FR-SRCH-001…004 pass, including "Cologne", "Koln", "Kiev" and "Frankfurt", and search stays under 300 ms (NFR-PERF-002).

---

## Phase 6 — Web foundation

- [x] Next.js App Router with SSR, Tailwind CSS and shadcn/ui (CON-002). Light and dark theme, see DECISIONS.md.
- [x] Clerk integration: sign-up and sign-in with email and password, email code and Google; sign-out; change email (FR-AUTH-003…008). Clerk's own components on `/sign-in` and `/sign-up` and its account menu in the header; which methods are offered is set in the Clerk dashboard. The web app reads the root `.env`. End-to-end tests sign a test user of the development instance in and out; CI needs the repository secrets `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` of the development instance.
- [x] Registration prompt on write actions with return to the same page (FR-AUTH-002). A dialog with sign-in and sign-up; first used by the Planned button on the city page (Phase 7).
- [x] i18n setup with all text in English translation files (NFR-L10N-001…003). `next-intl` with `messages/en.json` and type-checked keys; dates and numbers are formatted with it as pages need them.
- [x] Layout, navigation, responsive design from 360 px (NFR-UX-001). Header, footer, skip link and a not-found page; navigation links are added with their pages.

**Done when:** a guest can browse, and a user can sign up, sign in and sign out in desktop and mobile browsers.

---

## Phase 7 — Web pages

- [x] City page: required and optional data, community rating, personal data, log visit, rate, add to lists (FR-CITY-001…004). Done: `/cities/{id}` with the data, the community rating and its criteria (FR-CITY-001…003) from `GET /v1/cities/{cityId}`; the user's own data (FR-CITY-004) from `GET /v1/me/cities/{cityId}`; saving to the Planned list; logging, changing and deleting visits (FR-VIS-006); setting the number of undated visits (FR-VIS-005); rating and deleting the rating (FR-RATE-004). Deleting the last visit to a rated city, or setting the undated visits to zero, says that the rating goes too, and the user confirms it (BR-005). The page lists the ten newest visits and loads the older ones on request. Marking the city as lived-in, now or before, with an optional period (FR-VIS-010, BR-016). Adding it to custom lists and creating a list for it (FR-LIST-004). The boundary map came with Phase 8.
- [x] Links to external maps on the city page (FR-CITY-009).
- [x] Visit form with date precision and the "before registration" option, help hint with the recommended visit model (FR-VIS-002, FR-VIS-003, FR-VIS-008). A dialog on the city page with day, month, year or no date; an undated visit needs the confirmation that it was before the registration date, which the form shows. The form checks the date with the same rules as the API (`checkVisitDate` in `packages/shared`), against today in the user's own time zone. Guests get the sign-in dialog.
- [x] Rating form with criteria and the suggested subjective rating (FR-RATE-001…003). A dialog from the user's own data on the city page, shown only for a visited or lived-in city. Every criterion is optional; the subjective rating follows the rounded criteria average (`suggestedSubjectiveRating` in `packages/shared`) until the user picks one, and a link brings the suggestion back. An existing rating opens in the form and is replaced on saving (BR-008).
- [x] Search page for cities and lists (Phase 5). `/search` finds and browses cities with the filters and sorting of FR-SRCH-003, `/search/lists` finds public lists (FR-SRCH-004). Both are GET forms, so every search has its own URL and works without JavaScript; the web app checks the filters with the API's own schema first. A Search link in the header and a search field on the home page lead there. Found lists are not links yet; they become links with the list pages.
- [x] Profile page with lists, ratings, map and statistics (FR-PROF-004). `/users/{username}` with the profile information and the home city when it is shown, and tabs for the Visited list with the user's ratings, the Planned list and the custom lists. A private profile shows others only its public lists (FR-PRIV-001); the owner sees everything, with the number of visits and the lived-in marks. "Your profile" in the account menu leads there. The lists carry city IDs only, so `GET /v1/city-summaries` gives a page of them their names and places in one request. The map came with Phase 8, the statistics come with Phase 9.
- [x] List pages and list editing (FR-LIST-003…005). `/users/{username}/lists/{id}` shows a list in its order; its owner creates, renames, describes, hides and deletes lists, moves entries, writes notes and removes cities. Found lists in the search open these pages.
- [x] Onboarding flow for past visits (FR-VIS-007). `/onboarding` finds cities with the city search and adds them with a number of visits and, if known, the date of one visit; the others are undated and need the before-registration confirmation. Offered after signing up without a page to return to (Clerk's sign-up fallback) and from an empty Visited list.
- [x] Settings: account, profile, visibility, data export, account deletion. `/settings`, in the account menu: username, display name and bio (FR-PROF-001, FR-PROF-002); profile visibility and whether the home city is shown (FR-PRIV-001, FR-PROF-003); email and sign-in through Clerk's account dialog (FR-AUTH-008); the export as a JSON file (NFR-GDPR-003); deleting the account after typing the username (FR-AUTH-009), which also deletes the user at Clerk. The end-to-end test of the deletion runs against the Clerk development instance.

**Done when:** all MVP acceptance criteria of these requirements pass manually and the key flows are covered by Playwright.

---

## Phase 8 — Map

- [x] Mapbox GL JS with standard and satellite styles, globe at low zoom (FR-MAP-001…002). `BaseMap` loads Mapbox only in the browser, switches between the Standard and the Standard Satellite style and follows the site's light or dark theme. Without `NEXT_PUBLIC_MAPBOX_TOKEN` or WebGL it shows a note instead, and the rest of the page works; the end-to-end tests run this way.
- [x] City layer from Flanr's own vector tiles, served by the API (FR-MAP-003). The browser loads `/tiles/cities/…` from the web app, which passes the requests on to the API. A click resolves to the Flanr ID from the user's markers, the city points or a boundary.
- [x] Click on a city: boundary highlight and preview (FR-MAP-004). The boundary is highlighted through feature-state on the tiles, a ring marks the point, and the map zooms in to where the tiles have the boundary. The preview shows the name, place, community rating and the data of the map's owner, with a link to the city page. The selected city, the mode and the planned layer are in the URL.
- [x] Three map modes with legends (FR-MAP-005). Visits: size and colour by the number of visits, a lived-in city above any number. Rating: the colour scale of appendix C, unrated cities in grey. Population: size and colour by population, unknown in grey. Every legend counts the cities of each class. `GET /v1/map-cities` gives the cities of the own map in one document.
- [x] Planned cities as a separate layer (FR-MAP-006), as hollow markers that the user turns on.
- [x] Map on public profiles (FR-MAP-007). A Map tab on the profile; others read `GET /v1/users/{username}/map-cities`, with the visibility of the Visited list. A private profile has no map for others.
- [x] Map and data attribution (NFR-LIC-001). The map keeps Mapbox's logo and attribution and adds Flanr's city data from OpenStreetMap and Wikidata.
- [x] Map with the boundary on the city page (FR-CITY-001, from Phase 7). A city without a boundary is shown as a point.

**Done when:** the test user's 161 cities are shown in all three modes and the map stays smooth (NFR-PERF-003).

---

## Phase 8b — Map-first interface

The interface is rebuilt around the map, as common map services are (SRS 0.17, §6.1, FR-MAP-008). The design stays minimal for now; it will change.

- [x] Landing page for guests with a button that opens the map; signed-in users go to the map. Text only for now; the pictures come later.
- [x] Full-screen map at `/map`: the world map for guests, the own visited cities for signed-in users, the account menu top left (FR-MAP-008). The pages around the map moved into the `(site)` route group, which has the header and footer. The map settings (mode, toggles, base style) are remembered in the browser.
- [x] City names drawn by Flanr and selected by clicking them; markers for all cities as an option (FR-MAP-003). Mapbox's Standard style at day or night by the theme, with its settlement labels hidden; satellite imagery from Sentinel-2 cloudless until Mapbox's is available.
- [x] City panel on the right side, expandable to the city page; the city page gets a link back to the map (FR-MAP-004). `/map/cities/{id}`, not indexed, with the city page as canonical URL. It opens from the bottom on phones. Changes in the panel refresh the map.
- [x] Population mode with larger markers above smaller ones; values inside markers as an option (FR-MAP-005). Markers are images with the value drawn in, so a larger one covers a smaller one completely; a house marks lived-in cities.
- [x] Map settings behind a button at the top right, in a popup; the button moves aside for the city panel. An option shows the boundaries of all visited cities, another switches between the globe and a flat map (FR-MAP-002). A click on a city always moves the map to it. The criteria of the community rating are folded in the city panel.
- [x] Left panel with the Visited and Planned lists (FR-MAP-008), with a filter.
- [x] Trip calendar in the left panel (FR-STAT-003, FR-STAT-004), moved here from Phase 9. `GET /v1/trip-calendar`; a year at a time, a day's cities on click.
- [ ] Later in this phase: search on the map, the profile's map opened in the workspace, a remembered default view, pictures for the landing page.

**Done when:** a guest gets from the landing page to any city on the map and its page, and the test user sees their cities in all three modes, their Visited list and their trip calendar.

---

## Phase 9 — Statistics

- [ ] Summary: cities, countries, visits (FR-STAT-001).
- [ ] Statistics by country and first-level region (FR-STAT-002).
- [ ] Trip calendar from dated visits, with the coverage note (FR-STAT-003…004). Moved to Phase 8b.
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
- [ ] Monthly scheduled city data import with validation (FR-CITY-006). At the first re-import, also store the municipality's `admin_centre` and the Wikidata classes (P31) of cities, so that settlement points standing for a municipality can be reported later (OI-021, see DECISIONS.md 2026-11-17).
- [ ] Accessibility check against WCAG 2.2 AA for the main pages (NFR-UX-002).
- [ ] Performance check: city page LCP, search latency (NFR-PERF-001…002).
- [ ] Security pass against OWASP ASVS level 1 (NFR-SEC-005).
- [ ] Full run of all MVP acceptance criteria; status of each requirement set to `Verified` in the spec.

**Done when:** Flanr runs in production and all MVP requirements are verified.

---

## Phase 12 — Search engine optimisation

- [ ] Title, description and canonical URL for every public page (NFR-SEO-001). Pages built before this phase get them here; new pages can get them as they are built.
- [ ] Open Graph and Twitter previews for city, profile and list pages (NFR-SEO-002).
- [ ] `noindex` for sign-in, sign-up, settings and private profiles (NFR-SEO-003).
- [ ] `robots.txt` and sitemaps split into files of at most 50,000 URLs (NFR-SEO-004).
- [ ] JSON-LD on city pages (NFR-SEO-005).
- [ ] Indexing only cities from 50,000 people and a hand-picked list of well-known smaller cities (NFR-SEO-006).
- [ ] Register the site in Google Search Console and submit the sitemaps.

**Done when:** the sitemaps list the indexable cities, and a shared link to a city, profile or list shows a preview.

---

## Order and dependencies

```
Phase 0 → Phase 1 → Phase 2 ─┬→ Phase 3 → Phase 4 → Phase 5 ─┐
                             │                                ├→ Phase 7 → Phase 9 → Phase 10 → Phase 11 → Phase 12
                             └→ Phase 6 ──────────────────────┤
                                                Phase 8 ──────┘ (needs Phase 2 tiles and Phase 6)
                                                Phase 8b (map-first interface, after Phase 8)
```

Phases 2 and 6 can run in parallel. The map (Phase 8) can start as soon as the city tiles from Phase 2 and the web foundation from Phase 6 exist.
