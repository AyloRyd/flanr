import { VectorTile } from '@mapbox/vector-tile';
import { cityTileLayers } from '@flanr/shared';
import { PbfReader } from 'pbf';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCityTile } from '../src/city-tiles.ts';
import { createSql } from '../src/db.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);

// Tile 8/134/85 covers about 8.4°–9.8° E and 50.7°–51.6° N. All test cities lie inside it.
const tile = { z: 8, x: 134, y: 85 };

async function insertCity(city: {
  id: number;
  name: string;
  type: string;
  lon: number;
  lat: number;
  withBoundary?: boolean;
  inSource?: boolean;
}) {
  const size = 0.05;
  const boundary = `SRID=4326;MULTIPOLYGON(((${city.lon - size} ${city.lat - size}, ${city.lon + size} ${city.lat - size}, ${city.lon + size} ${city.lat + size}, ${city.lon - size} ${city.lat + size}, ${city.lon - size} ${city.lat - size})))`;
  await sql`
    INSERT INTO cities (id, osm_type, osm_id, name_local, name_en, country_code, region_1_id,
      settlement_type, centre, boundary, population, in_source)
    OVERRIDING SYSTEM VALUE
    VALUES (${city.id}, 'node', ${city.id}, ${city.name}, ${city.name}, 'DE', 1,
      ${city.type}::settlement_type, ST_SetSRID(ST_MakePoint(${city.lon}, ${city.lat}), 4326),
      ${city.withBoundary ? boundary : null}::geometry, 1000, ${city.inSource ?? true})
  `;
  if (city.withBoundary) {
    await sql`
      INSERT INTO city_tile_shapes (city_id, min_zoom, max_zoom, geom)
      SELECT id, 8, 10, ST_Transform(boundary, 3857) FROM cities WHERE id = ${city.id}
    `;
  }
}

async function layerFeatures(coordinates: { z: number; x: number; y: number }, layer: string) {
  const data = await getCityTile(sql, coordinates);
  if (!data) return [];
  const decoded = new VectorTile(new PbfReader(data)).layers[layer];
  if (!decoded) return [];
  return Array.from({ length: decoded.length }, (_, i) => decoded.feature(i)).map((feature) => ({
    id: feature.id,
    ...feature.properties,
  }));
}

beforeAll(async () => {
  await sql`TRUNCATE city_tile_shapes, city_names, cities, municipalities, regions, countries RESTART IDENTITY CASCADE`;
  await sql`INSERT INTO countries (code, name_local, name_en) VALUES ('DE', 'Deutschland', 'Germany')`;
  await sql`
    INSERT INTO regions (osm_type, osm_id, country_code, level, name_local, name_en, boundary)
    VALUES ('relation', 1, 'DE', 1, 'Hessen', 'Hesse',
      ST_Multi(ST_SetSRID(ST_MakeEnvelope(8, 50, 10, 52), 4326)))
  `;
  await insertCity({ id: 1, name: 'Stadt', type: 'city', lon: 9.0, lat: 51.0, withBoundary: true });
  await insertCity({
    id: 2,
    name: 'Kleinstadt',
    type: 'town',
    lon: 9.2,
    lat: 51.2,
    withBoundary: true,
  });
  await insertCity({
    id: 3,
    name: 'Dorf',
    type: 'village',
    lon: 9.4,
    lat: 51.4,
    withBoundary: true,
  });
  await insertCity({ id: 4, name: 'Weiler', type: 'hamlet', lon: 9.1, lat: 51.3 });
  await insertCity({
    id: 5,
    name: 'Verschwunden',
    type: 'city',
    lon: 9.3,
    lat: 51.1,
    inSource: false,
  });
});

afterAll(async () => {
  await sql.end();
});

describe('getCityTile (FR-MAP-003)', () => {
  it('returns city points with their ID and attributes', async () => {
    const points = await layerFeatures(tile, cityTileLayers.points);

    expect(points).toContainEqual({
      id: 1,
      name: 'Stadt',
      name_en: 'Stadt',
      type: 'city',
      population: 1000,
    });
  });

  it('shows smaller settlements only from their minimum zoom', async () => {
    const names = (await layerFeatures(tile, cityTileLayers.points)).map((p) => p.name).sort();

    // At zoom 8 cities and towns are shown; villages start at 9 and hamlets at 11.
    expect(names).toEqual(['Kleinstadt', 'Stadt']);
  });

  it('returns boundaries of the settlement types shown at the zoom', async () => {
    const boundaries = await layerFeatures(tile, cityTileLayers.boundaries);

    expect(boundaries.map((b) => b.id).sort()).toEqual([1, 2]);
  });

  it('leaves out cities that are no longer in the source', async () => {
    const names = (await layerFeatures(tile, cityTileLayers.points)).map((p) => p.name);

    expect(names).not.toContain('Verschwunden');
  });

  it('returns null for a tile without cities', async () => {
    expect(await getCityTile(sql, { z: 8, x: 0, y: 0 })).toBeNull();
  });
});
