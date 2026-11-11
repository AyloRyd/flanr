import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { countryConfig, type CountryConfig } from '../src/countries.ts';
import { importCities } from '../src/pipeline/run.ts';
import { connectTestDatabase } from './database.ts';
import {
  baseFeatures,
  baseRelations,
  node,
  relationArea,
  writeFixture,
  type FixtureFeature,
  type FixtureRelation,
} from './fixture.ts';

const sql = connectTestDatabase();
const germany = countryConfig('DE');

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await sql`TRUNCATE wikidata_entities, city_tile_shapes, city_names, cities, municipalities, regions, countries, import_runs RESTART IDENTITY CASCADE`;
});

async function runImport(
  features: FixtureFeature[],
  relations: FixtureRelation[] = baseRelations(),
  country: CountryConfig = germany,
) {
  const files = await writeFixture(features, relations);
  return importCities(sql, { country, ...files, sourceTimestamp: null });
}

async function city(name: string) {
  const [row] = await sql`
    SELECT c.boundary_osm_id, c.boundary_match, c.represents_municipality,
           m.name_local AS municipality, r1.name_local AS region_1
    FROM cities c
    JOIN regions r1 ON r1.id = c.region_1_id
    LEFT JOIN municipalities m ON m.id = c.municipality_id
    WHERE c.name_local = ${name}
  `;
  return row;
}

describe('Country boundary', () => {
  it('is built from the first-level regions when the extract has no country boundary', async () => {
    // As in the Netherlands extract, where the country relation is cut off.
    const withoutCountry = baseFeatures().filter((f) => f.tags.admin_level !== '2');

    const result = await runImport(withoutCountry);

    expect(result.ok).toBe(true);
    const [country] = await sql`
      SELECT name_local, name_en, osm_id, ST_Area(boundary) AS area FROM countries WHERE code = 'DE'
    `;
    expect(country).toMatchObject({ name_local: 'Deutschland', name_en: 'Germany', osm_id: null });
    // The two states together cover the 10 × 10 country.
    expect(country?.area).toBeCloseTo(100, 5);
    expect(await sql`SELECT count(*)::int AS n FROM cities`).toEqual([{ n: 4 }]);
  });
});

describe('First-level regions', () => {
  it('ignores a boundary of the same level that has no ISO 3166-2 code', async () => {
    // Italy has small islands mapped at the level of its regions.
    const island = relationArea(7, [7.5, 1, 9, 3], {
      boundary: 'administrative',
      admin_level: '4',
      name: 'Insel',
    });

    await runImport([...baseFeatures(), island]);

    expect(await sql`SELECT count(*)::int AS n FROM regions WHERE name_local = 'Insel'`).toEqual([
      { n: 0 },
    ]);
    // Weiler lies inside the island's boundary and still belongs to the real state.
    expect(await city('Weiler')).toMatchObject({ region_1: 'Ost' });
  });
});

describe('Country without regions', () => {
  // Like Monaco or Vatican City: no first-level regions and no municipalities.
  const microstate: CountryConfig = {
    ...germany,
    region1Level: null,
    region2Level: null,
    municipalityLevels: [],
  };

  it('imports its cities without a region or a municipality', async () => {
    const result = await runImport(baseFeatures(), baseRelations(), microstate);

    expect(result.ok).toBe(true);
    const cities = await sql`
      SELECT name_local, region_1_id, region_2_id, municipality_id FROM cities ORDER BY name_local
    `;
    expect(cities.map((c) => c.name_local)).toEqual(['Dorf', 'Großstadt', 'Kleinstadt', 'Weiler']);
    for (const row of cities) {
      expect(row).toMatchObject({ region_1_id: null, region_2_id: null, municipality_id: null });
    }
  });

  it('still rejects cities without a region in a country that has regions', async () => {
    // Without the states, no city of the base fixture has a region.
    const withoutStates = baseFeatures().filter((f) => f.tags.admin_level !== '4');

    const result = await runImport(withoutStates);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/have no first-level region/);
  });
});

describe('Municipality names with an ending (Denmark)', () => {
  const danishStyle: CountryConfig = {
    ...germany,
    municipalityLevels: [7],
    municipalityNameEndings: ['s Kommune', ' Kommune'],
  };
  const boundary = { boundary: 'administrative', admin_level: '7' };

  function features() {
    return [
      ...baseFeatures(),
      // Like Københavns Kommune and København: the seat has no boundary of its own.
      relationArea(107, [7.6, 0.5, 9.5, 4], { ...boundary, name: 'Weilers Kommune' }),
      node(19, 9, 3, { place: 'village', name: 'Hafen' }),
      // Like Lyngby-Taarbæk Kommune and Kongens Lyngby: the seat has another name.
      relationArea(108, [5.5, 4.5, 9.5, 9.8], { ...boundary, name: 'Nord-Ost Kommune' }),
    ];
  }

  function relations(): FixtureRelation[] {
    const seat = (id: number, ref: string) => ({
      id,
      tags: { ...boundary, name: 'x' },
      members: [
        { ref: 'w9', role: 'outer' },
        { ref, role: 'admin_centre' },
      ],
    });
    return [...baseRelations(), seat(107, 'n14'), seat(108, 'n12')];
  }

  it('gives the seat the municipality boundary when the names differ only by the ending', async () => {
    await runImport(features(), relations(), danishStyle);

    expect(await city('Weiler')).toMatchObject({
      boundary_osm_id: '107',
      boundary_match: 'admin_centre',
      municipality: 'Weilers Kommune',
      represents_municipality: true,
    });
  });

  it('links another settlement of that municipality as a part of it', async () => {
    await runImport(features(), relations(), danishStyle);

    expect(await city('Hafen')).toMatchObject({
      boundary_osm_id: null,
      municipality: 'Weilers Kommune',
      represents_municipality: false,
    });
  });

  it('does not give the boundary to a seat with a different name', async () => {
    await runImport(features(), relations(), danishStyle);

    expect(await city('Dorf')).toMatchObject({
      boundary_osm_id: '101',
      municipality: 'Nord-Ost Kommune',
      represents_municipality: false,
    });
  });
});
