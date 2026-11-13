# Decisions log

Decisions made while preparing the project, with the reasons behind them. The concept and the SRS describe what Flanr is; this file explains why some choices were made. Newest first.

## 2026-11-13

- **Visibility of the default lists:** two settings of the user, one for the Visited and one for the Planned list, because these lists are not stored as lists (FR-LIST-005).
- **Username and display name are managed in Flanr.** Clerk supplies the first ones when the account is created; later changes at Clerk are not copied. The rules of FR-PROF-001 are checked by the API, which Clerk could not do (reserved names, uniqueness without letter case).
- **Avatar in the MVP is the picture of the Clerk account.** Flanr stores its URL and has no file storage of its own yet.
- **City search stays in PostgreSQL** (`unaccent`, `pg_trgm`), without a search engine. Each name is stored once more in lower case and without diacritics (`city_names.search_name`, a generated column), so the indexes need no upkeep by the import. Names that start with the query and close spellings are only looked for among the main names of a city (its names in the various languages); nicknames, official and former names count when they are the whole query. Otherwise "St" found Berlin through "Stadt Berlin". A second query plan that walks the largest cities first was tried for very common beginnings ("la ") and dropped: it was fast for those and took 1.5 s for beginnings that are common only among small places ("le b").

## 2026-11-12

- **The API client is generated from the OpenAPI document, not from the Hono app (CON-009, NFR-PORT-001).** Hono's own typed client (`hc`) reads the types of the server code, which would tie the web client to this backend. Instead the document is written to `packages/shared/openapi.json`, `openapi-typescript` turns it into types, and `openapi-fetch` (a thin wrapper around `fetch`) uses them. A backend in another language only has to serve the same document. Both generated files are committed, so the web app builds without a generation step, and tests fail when they are out of date.

- **A rating is deleted with the last visit (OI-005, BR-005).** Hiding it until the next visit was considered and rejected: it needs an inactive state and a retention rule for little gain. The user is warned and confirms.
- **The suggested rating rounds halves up (OI-007, BR-007).** 7.25 becomes 7.5.
- **Usernames (OI-010, FR-PROF-001):** 3–30 Latin letters, digits and underscores, unique regardless of case, with a reserved list. They can be changed at any time; old profile URLs do not redirect and the old name is free at once.
- **Lived-in cities can have a period (OI-019, BR-016),** optional and with the precision rules of visit dates. It is shown with the city and stays out of time-based statistics, which count dated visits only.

## 2026-11-11

- **Countries without regions are allowed.** Monaco, Vatican City, Malta, Liechtenstein and San Marino have no first-level regions, so a city's region became optional (SRS 0.7).
- **The capital of a country is always a city.** OpenStreetMap maps Vatican City as a suburb of Rome, which left the country without any city. This is the one exception to "OSM's place type decides" (BR-001).
- **No on-demand lookups in OSM or Wikidata for missing cities.** Considered for world-wide coverage and rejected: the public services limit requests and forbid search-as-you-type, the map and search need local data, and a city found through an external search would be identified by another OSM object than our import uses, which creates duplicates. World-wide coverage can instead start from the same import with default settings (points, names, population) and be refined country by country, with the same city IDs. The plan stays: the owner's countries, then Europe, then a server; the world after the MVP (CON-012).
- **A settlement inside a municipality is still a city (BR-001, BR-017).** The owner's own travel list has Ostia next to Rome and Körbecke, which is part of Möhnesee, so "city = municipality" would lose places people actually go to. It also breaks in countries with large merged municipalities: in the Netherlands it would replace Winschoten and Hoogezand with Oldambt and Midden-Groningen, which are not places. OpenStreetMap already separates settlements (city, town, village, hamlet) from districts (suburb, quarter, neighbourhood, borough), so that classification decides. The municipality becomes reference data that a city links to.
- **A city that is its municipality carries the municipality's data.** Cologne's population and boundary cover the villages inside it, as official statistics do. This is taken from the data (the settlement and the boundary share a Wikidata item), not assumed, because elsewhere the two differ: Winschoten is the seat of Oldambt, not Oldambt itself. Some cases are unclear even in the sources: the Kharkiv hromada is the city of Kharkiv plus four settlements whose merger into the city was decided in 2013 but never confirmed by parliament, so the two are almost, but not legally, the same.
- **Population is optional.** After the Wikidata enrichment two thirds of German settlements still have no figure, almost all of them parts of municipalities, for which no open source publishes one.
- **External map links are generated, not stored (FR-CITY-009).** OpenStreetMap, Google Maps and Apple Maps for the MVP. Organic Maps is left out: its links only work with the app installed, and a mobile client can later hand coordinates to whichever map app the phone has.
- **City districts may be imported later as extra information (FR-CITY-010),** never as cities.
- **City layer delivery for the MVP: tiles built by the API.** The map takes the city layer from `GET /tiles/cities/{z}/{x}/{y}.mvt`, built by PostGIS on request. For Germany this is fast enough (7–40 ms median per tile, see `docs/notes/tile-delivery.md`), the data is always current and there is no separate file to build and publish. The PMTiles build is kept working as the alternative; both produce the same layers, so switching only changes the map source.
- **Revisit after the Europe import.** The measurements are repeated on Europe-sized data. If the API tiles get noticeably slower, the static geometry moves to PMTiles, with user data still coming from the API and applied through feature-state. This hybrid is the expected setup for world-wide data: the geometry changes only with the monthly import, and low-zoom tiles with thousands of cities are expensive to build per request.
- **Open for world-wide data:** the zoom from which a city is shown depends only on its settlement type. That works for Germany but will need thinning by population at low zooms.

## 2026-11-10

- **City data extract revised: Geofabrik instead of Geoapify (OI-002).** The Geoapify archive for Germany (snapshot of September 2025) turned out to have no boundary geometry: its `border` field only gives the boundary relation's ID, name, population and bbox. It also has no Wikidata IDs and contains mis-tagged objects such as restaurants and mills. Geofabrik extracts are updated daily, carry full geometry and the `wikidata` and `population` tags, and keep OpenStreetMap as the only source. The cost is that the import links settlements to boundaries itself, through the boundary relation's `label` or `admin_centre` member, the shared Wikidata ID, or spatial containment.
- **The owner's travel data is not committed.** The repository is public, and `test-data/travels.csv` shows the owner's travel history and where they have lived. It stays local and gitignored. Automated tests use a made-up fixture in the same format.
- **City data extract: Geoapify localities (OI-002).** *Superseded the same day, see above.* It already links OSM settlements with their boundaries, so no own processing of the OSM planet file is needed. Overture Divisions would need extra matching to OSM IDs. Licence and download terms are checked at the start of the import work.
- **Settlements without a boundary are imported as points (OI-003).** Skipping them would lose villages and hamlets that users have visited; FR-CITY-001 already requires a point fallback on the city page.
- **Name: Flanr** (from flâneur, a person who explores a city on foot). Formerly CityHub. Domain not bought yet; candidates are `flanr.app` (about $14/year at Cloudflare Registrar) or a `.com` variant (about $10.50/year). Check availability and EU trademarks before buying.
- **Hosting (proposal, decide in phase 11):** one VPS in Germany with about 8 GB RAM running PostgreSQL + PostGIS, the Hono API and Next.js (standalone) in Docker Compose behind Caddy, optionally managed with Coolify or Dokploy. Not Vercel, because the Hobby plan is non-commercial only and affiliate links later count as commercial use. Hetzner's cheap plans were unavailable to order in autumn 2026; netcup (VPS 1000, about 14 €/month) was the best value at that time. Nightly `pg_dump` to separate storage. Nothing needs to be bought before phase 11.
- **City data:** Flanr keeps its own copy and imports monthly (FR-CITY-006). Rollout: Germany, then continental Europe for the MVP, then the world after the MVP (CON-012).
- **Lived-in cities** added (BR-016, FR-VIS-010).
- **Rating colour scale** added (SRS Appendix C).

## 2026-11-09

- **Stack:** Next.js (SSR) web client, standalone Hono API, PostgreSQL + PostGIS with Drizzle, pnpm monorepo. TypeScript instead of Go because the owner reviews AI-written code and can review TypeScript confidently; OpenAPI keeps a later move to Go possible. TanStack Start is still considered as an alternative to Next.js.
- **Base map: Mapbox.** Free tier covers the expected scale, has a globe on web and Android, satellite imagery and good quality. MapTiler's free plan is non-commercial only. MapLibre Native has no globe yet. Cities are drawn as Flanr's own layer so the base map stays replaceable.
- **City data sources:** OpenStreetMap for settlements and boundaries, Wikidata for all other fields. GeoNames has no boundaries.
- **Monetization direction:** accommodation through an aggregator (for example Stay22), tours later (GetYourGuide), transport only for convenience (Omio). Direct Booking.com, FlixBus and Skyscanner programmes pay too little. A subscription is only a future concept and will never limit core features.
- **MVP scope:** web only. Social features, photos, moderation, places and monetization come later.
