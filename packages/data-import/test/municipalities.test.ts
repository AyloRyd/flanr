import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countryConfig } from '../src/countries.ts';
import { importCities } from '../src/pipeline/run.ts';
import { connectTestDatabase } from './database.ts';
import {
  baseFeatures,
  baseRelations,
  municipalityFeatures,
  municipalityRelations,
  sharedWikidataFeatures,
  writeFixture,
} from './fixture.ts';

const sql = connectTestDatabase();

afterAll(async () => {
  await sql.end();
});

beforeAll(async () => {
  await sql`TRUNCATE wikidata_entities, city_tile_shapes, city_names, cities, municipalities, regions, countries, import_runs RESTART IDENTITY CASCADE`;
  const files = await writeFixture(
    [...baseFeatures(), ...municipalityFeatures(), ...sharedWikidataFeatures()],
    [...baseRelations(), ...municipalityRelations()],
  );
  await importCities(sql, { country: countryConfig('DE'), ...files, sourceTimestamp: null });
});

async function city(name: string) {
  const [row] = await sql`
    SELECT c.wikidata_id, c.boundary_osm_id, c.boundary_match, c.represents_municipality,
           m.name_local AS municipality
    FROM cities c LEFT JOIN municipalities m ON m.id = c.municipality_id
    WHERE c.name_local = ${name}
  `;
  return row;
}

describe('Cities and municipalities (BR-001, BR-017)', () => {
  it('imports municipalities as reference data, not as cities', async () => {
    const names = await sql<
      { name: string }[]
    >`SELECT name_local AS name FROM municipalities ORDER BY 1`;

    expect(names.map((m) => m.name)).toEqual([
      'Altstadt',
      'Gemeinde Seeland',
      'Großstadt',
      'Kleinstadt',
      'Neustadt',
    ]);
    expect(await city('Gemeinde Seeland')).toBeUndefined();
  });

  it('treats a district-free city as its own municipality', async () => {
    // Großstadt has a district-level boundary with no municipality inside it.
    expect(await city('Großstadt')).toMatchObject({
      municipality: 'Großstadt',
      represents_municipality: true,
    });
  });

  it('does not treat a district or a state as a municipality when it contains municipalities', async () => {
    const [found] = await sql`
      SELECT count(*)::int AS n FROM municipalities WHERE name_local IN ('Landkreis Nord', 'West', 'Ost')
    `;

    expect(found?.n).toBe(0);
  });

  it('keeps a village inside a municipality as a city of its own, linked to the municipality', async () => {
    // Like Körbecke in Möhnesee: its own boundary, and part of a municipality with another name.
    expect(await city('Dorf')).toMatchObject({
      boundary_osm_id: '101',
      municipality: 'Gemeinde Seeland',
      represents_municipality: false,
    });
  });

  it('gives a settlement that is its municipality the municipality boundary, not its core district', async () => {
    // Like Herbstein: the node has the municipality's Wikidata ID and is the label of a core district.
    expect(await city('Altstadt')).toMatchObject({
      boundary_osm_id: '104',
      boundary_match: 'wikidata',
      municipality: 'Altstadt',
      represents_municipality: true,
    });
  });

  it('prefers the municipality boundary when several boundaries share the Wikidata ID', async () => {
    // Like Warsaw, whose gmina and settlement boundary have the same Wikidata ID.
    expect(await city('Neustadt')).toMatchObject({
      boundary_osm_id: '110',
      municipality: 'Neustadt',
      represents_municipality: true,
    });
  });

  it('links another village of the same municipality without making it represent it', async () => {
    expect(await city('Nebendorf')).toMatchObject({
      boundary_osm_id: '106',
      municipality: 'Altstadt',
      represents_municipality: false,
    });
  });

  it('takes the Wikidata ID from the boundary when the settlement has none', async () => {
    expect(await city('Nebendorf')).toMatchObject({ wikidata_id: 'Q18' });
  });

  it('leaves a city outside every municipality without one', async () => {
    expect(await city('Weiler')).toMatchObject({
      municipality: null,
      represents_municipality: false,
    });
  });
});
