# Decisions log

Decisions made while preparing the project, with the reasons behind them. The concept and the SRS describe what Flanr is; this file explains why some choices were made. Newest first.

## 2026-11-11

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
