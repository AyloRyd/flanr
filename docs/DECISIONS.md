# Decisions log

Decisions made while preparing the project, with the reasons behind them. The concept and the SRS describe what Flanr is; this file explains why some choices were made. Newest first.

## 2026-11-10

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
