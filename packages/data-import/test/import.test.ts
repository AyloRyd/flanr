import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { countryConfig } from '../src/countries.ts';
import { applyCities } from '../src/pipeline/apply.ts';
import { loadBoundaryLinks, loadFeatures } from '../src/pipeline/load.ts';
import { matchCities } from '../src/pipeline/match.ts';
import { importCities } from '../src/pipeline/run.ts';
import { createStaging, dropStaging } from '../src/pipeline/staging.ts';
import { connectTestDatabase } from './database.ts';
import { baseFeatures, baseRelations, node, writeFixture, type FixtureFeature } from './fixture.ts';

const sql = connectTestDatabase();
const country = countryConfig('DE');

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await sql`TRUNCATE city_tile_shapes, city_names, cities, regions, countries, import_runs RESTART IDENTITY CASCADE`;
});

async function runImport(features: FixtureFeature[] = baseFeatures()) {
  const files = await writeFixture(features, baseRelations());
  return importCities(sql, {
    country,
    ...files,
    sourceTimestamp: new Date('2026-11-08T21:21:00Z'),
  });
}

async function city(name: string) {
  const [row] = await sql`
    SELECT c.id, c.osm_type, c.osm_id, c.settlement_type, c.name_en, c.population, c.population_year,
           c.capital_status, c.wikipedia_url, c.in_source, c.boundary IS NOT NULL AS has_boundary,
           c.boundary_osm_id, c.boundary_match, r1.name_local AS region_1, r2.name_local AS region_2
    FROM cities c
    JOIN regions r1 ON r1.id = c.region_1_id
    LEFT JOIN regions r2 ON r2.id = c.region_2_id
    WHERE c.name_local = ${name}
  `;
  return row;
}

async function cityNames() {
  const rows = await sql<
    { name: string }[]
  >`SELECT name_local AS name FROM cities ORDER BY name_local`;
  return rows.map((row) => row.name);
}

describe('OSM city import', () => {
  it('imports cities, towns, villages and hamlets inside the country only (BR-001, FR-CITY-005)', async () => {
    const result = await runImport();

    expect(result.ok).toBe(true);
    expect(await cityNames()).toEqual(['Dorf', 'Großstadt', 'Kleinstadt', 'Weiler']);
  });

  it('does not import suburbs as cities (BR-001)', async () => {
    await runImport();

    expect(await city('Großstadt-Nord')).toBeUndefined();
  });

  it('stores source IDs and fields from OSM tags (FR-CITY-005)', async () => {
    await runImport();

    expect(await city('Großstadt')).toMatchObject({
      osm_type: 'node',
      osm_id: '10',
      settlement_type: 'city',
      name_en: 'Bigcity',
      population: 500000,
      population_year: 2023,
      capital_status: 'regional',
      wikipedia_url: 'https://de.wikipedia.org/wiki/Gro%C3%9Fstadt',
      region_1: 'West',
      region_2: 'Großstadt',
    });
  });

  it('links boundaries by label, by name and location, and merges a settlement mapped twice', async () => {
    await runImport();

    expect(await city('Großstadt')).toMatchObject({
      has_boundary: true,
      boundary_osm_id: '100',
      boundary_match: 'label',
    });
    expect(await city('Dorf')).toMatchObject({
      has_boundary: true,
      boundary_osm_id: '101',
      boundary_match: 'name_and_location',
    });
    expect(await city('Kleinstadt')).toMatchObject({
      osm_type: 'node',
      has_boundary: true,
      boundary_osm_id: '102',
    });
  });

  it('imports a settlement without a boundary as a point (OI-003)', async () => {
    await runImport();

    expect(await city('Weiler')).toMatchObject({
      has_boundary: false,
      region_1: 'Ost',
      region_2: null,
    });
  });

  it('stores all names for search (FR-SRCH-001)', async () => {
    await runImport();

    const names = await sql`
      SELECT n.name, n.lang, n.kind FROM city_names n JOIN cities c ON c.id = n.city_id
      WHERE c.name_local = 'Dorf' ORDER BY n.kind, n.name COLLATE "C"
    `;
    expect(names.map((n) => ({ ...n }))).toEqual([
      { name: 'Dorpe', lang: null, kind: 'alt_name' },
      { name: 'Dörp', lang: null, kind: 'alt_name' },
      { name: 'Dorf', lang: null, kind: 'name' },
    ]);
  });

  it('builds simplified boundaries for the zoom ranges where the settlement type is shown', async () => {
    await runImport();

    const shapes = await sql`
      SELECT c.name_local AS name, s.min_zoom, ST_SRID(s.geom) AS srid
      FROM city_tile_shapes s JOIN cities c ON c.id = s.city_id
      ORDER BY c.name_local, s.min_zoom
    `;
    expect(shapes.map((s) => `${s.name} z${s.min_zoom}+`)).toEqual([
      'Dorf z8+',
      'Dorf z11+',
      'Großstadt z0+',
      'Großstadt z8+',
      'Großstadt z11+',
      'Kleinstadt z8+',
      'Kleinstadt z11+',
    ]);
    expect(new Set(shapes.map((s) => s.srid))).toEqual(new Set([3857]));
  });

  it('records the run with its source timestamp and statistics', async () => {
    await runImport();

    const [run] = await sql`SELECT status, source_timestamp, stats FROM import_runs`;
    expect(run?.status).toBe('succeeded');
    expect(run?.source_timestamp).toEqual(new Date('2026-11-08T21:21:00Z'));
    expect(run?.stats).toMatchObject({ cities: 4, withBoundary: 3, placesWithoutName: 1 });
  });
});

describe('Re-running the import (FR-CITY-006)', () => {
  it('updates a city by its source ID and keeps its internal ID (AC 1)', async () => {
    await runImport();
    const before = await city('Dorf');

    const changed = baseFeatures().map((f) =>
      f.id === 'n12' ? node(12, 7, 7, { ...f.tags, population: '5000' }) : f,
    );
    await runImport(changed);

    expect(await city('Dorf')).toMatchObject({ id: before?.id, population: 5000 });
  });

  it('leaves the data unchanged when applying fails halfway (AC 2, NFR-REL-002)', async () => {
    await runImport();
    const before = await sql`SELECT id, population FROM cities ORDER BY id`;

    const changed = baseFeatures().map((f) =>
      f.id === 'n12' ? node(12, 7, 7, { ...f.tags, population: '5000' }) : f,
    );
    const files = await writeFixture(changed, baseRelations());
    await createStaging(sql);
    await loadFeatures(sql, files.features);
    await loadBoundaryLinks(sql, files.relations);
    await matchCities(sql, country);
    // Cities are written before names, so this makes the transaction fail after the cities were updated.
    await sql`DROP TABLE staging.place_name`;

    await expect(applyCities(sql, 'DE')).rejects.toThrow();
    await dropStaging(sql);

    expect(await sql`SELECT id, population FROM cities ORDER BY id`).toEqual(before);
  });

  it('keeps a city that disappeared from the source and marks it (AC 3)', async () => {
    await runImport();
    const before = await city('Weiler');

    // Keep the city count above the validation threshold.
    const withoutWeiler = baseFeatures().filter((f) => f.id !== 'n14');
    const extra = Array.from({ length: 10 }, (_, i) =>
      node(1000 + i, 9, 0.5 + i * 0.5, { place: 'hamlet', name: `Neu ${i}` }),
    );
    await runImport([...withoutWeiler, ...extra]);

    expect(await city('Weiler')).toMatchObject({ id: before?.id, in_source: false });
  });

  it('rejects an import whose city count drops sharply and keeps the current data', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      node(2000 + i, 8, 0.5 + i * 0.4, { place: 'hamlet', name: `Hof ${i}` }),
    );
    await runImport([...baseFeatures(), ...many]);

    const result = await runImport();

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/dropped from 24 to 4/);
    expect(await sql`SELECT count(*)::int AS n FROM cities WHERE in_source`).toEqual([{ n: 24 }]);
    const [run] = await sql`SELECT status, error FROM import_runs ORDER BY id DESC LIMIT 1`;
    expect(run).toMatchObject({ status: 'failed' });
  });
});
