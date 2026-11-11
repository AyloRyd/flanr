# City layer delivery: measurements

Working notes for the MVP decision on how to deliver the city layer, and raw material for the theses (`docs/THESES.md`). Measured on 2026-11-11 with `tools/tile-bench`.

## Setup

- Data: Germany from the Geofabrik extract of 2026-11-08. 85,802 settlements, 25,700 of them with a boundary. Full boundaries: 172 MB in PostGIS, 11.2 million points.
- Everything runs on one developer laptop, over localhost. There is no network latency and no CDN, so the numbers compare the work each approach does, not what a user on a real connection sees.
- Layer rules are the same for all approaches (`packages/shared/src/city-tiles.ts`): zooms 0–12, points from zoom 0 (city), 7 (town), 9 (village), 11 (hamlet); boundaries from 5, 8, 10, 11.

Approaches:

1. **GeoJSON** — the whole layer as two documents, loaded by the map at once.
2. **PostGIS tiles** — `GET /tiles/cities/{z}/{x}/{y}.mvt`, built per request with `ST_AsMVT` from boundaries simplified in advance for three zoom ranges (tolerances 600 m, 75 m and 10 m). No server-side tile cache.
3. **PMTiles** — one archive built with tippecanoe 2.53, read with HTTP range requests.

## Preparation and storage

| | GeoJSON | PostGIS tiles | PMTiles |
|---|---|---|---|
| Preparation | export, 7 s | simplification inside the import, about 1.5 min | export 7 s + tippecanoe 56 s |
| Storage | 249 MB (17 MB points, 232 MB boundaries) | 84 MB of simplified boundaries (62 + 22 + 0.07 MB) | 41 MB |
| Data changes show up | after a new export | immediately | after a rebuild (about 1 min) |

## Time to get one tile

Tiles were sampled where cities are, 60 per zoom where that many exist, each fetched three times after a warm-up. Milliseconds, median / p95. Sizes are uncompressed kilobytes, median / p95.

| Zoom | Tiles | PostGIS ms | PMTiles ms | PostGIS kB | PMTiles kB |
|---|---|---|---|---|---|
| 4 | 1 | 22 / 27 | 4.2 / 4.5 | 3.8 / 3.8 | 3.8 / 3.8 |
| 6 | 6 | 14 / 31 | 3.1 / 3.5 | 1.5 / 8.2 | 3.5 / 18 |
| 8 | 54 | 40 / 88 | 1.9 / 2.9 | 12 / 32 | 17 / 46 |
| 10 | 60 | 8.9 / 13 | 2.6 / 2.9 | 9.5 / 15 | 18 / 32 |
| 12 | 60 | 6.7 / 9.2 | 1.8 / 2.0 | 2.2 / 4.6 | 2.7 / 6.1 |

Zooms 4 and 6 have very few tiles over Germany, so their percentiles mean little.

## First render in the browser

Headless Chromium, 1280 × 800, empty cache, median of three runs. Time from page start until the map is idle, and bytes downloaded for the layer.

| View | GeoJSON | PostGIS tiles | PMTiles |
|---|---|---|---|
| Germany, zoom 5.5 | 24.0 s, 249 MB | 0.41 s, 10 kB | 0.47 s, 38 kB |
| Cologne, zoom 11 | 21.4 s, 249 MB | 0.43 s, 16 kB | 0.48 s, 44 kB |

The stand serves GeoJSON without compression; gzip would cut the transfer but not the parsing time. PostGIS tiles are sent gzipped. PMTiles also download the archive header and directory (about 16 kB once per session), and tippecanoe keeps more detail than our simplification, which is why its tiles are larger.

## What it says so far

- GeoJSON is not usable for this layer: over 20 seconds and 249 MB for any view.
- A PMTiles tile is fetched 3 to 20 times faster than a PostGIS tile is built. In the browser the two are equal within measurement noise at this data size, because rendering dominates.
- PostGIS tiles at zoom 8 are the slowest case (p95 88 ms): town boundaries appear there at the middle detail level, and tiles are large.
- The fix that mattered most for PostGIS tiles was simplifying boundaries in advance and letting the low-zoom query use the index on settlement type (zoom 4 went from about 250 ms to 22 ms).

## Not measured yet

- A real network and a CDN in front of either approach.
- Concurrent requests.
- Europe-sized data.
- The hybrid from the theses' hypothesis: static geometry plus user data applied with feature-state. The stand already highlights boundaries through feature-state, with city IDs as feature IDs in both tile sources.
