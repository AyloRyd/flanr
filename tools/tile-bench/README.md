# Tile stand

A small map page and a measurement script for comparing ways to deliver the city layer: tiles built by PostGIS on request, a pre-built PMTiles archive, and the whole layer as GeoJSON. It is a development tool and not part of the product. It uses MapLibre without a base map, so no map token is needed.

## Run

```bash
pnpm tiles:build                         # builds data/tiles/cities.pmtiles from the database
CORS_ORIGINS=http://localhost:3000,http://localhost:4173 pnpm --filter @flanr/api dev
pnpm --filter @flanr/tile-bench serve    # http://localhost:4173
```

Switch the source with the links on the page or with `?source=mvt`, `?source=pmtiles` or `?source=geojson`. The view can be set with `lng`, `lat` and `zoom`.

## Measure

With both servers running:

```bash
pnpm --filter @flanr/tile-bench measure
```

It prints JSON with the time to get a tile (median and p95 per zoom), tile sizes, the time until the map has drawn a view, the bytes downloaded for it and the file sizes. The results are recorded in `docs/notes/tile-delivery.md`.
