import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countryConfig } from '../src/countries.ts';
import { importCities } from '../src/pipeline/run.ts';
import { connectTestDatabase } from './database.ts';
import {
  baseFeatures,
  baseRelations,
  node,
  relationArea,
  writeFixture,
  type FixtureRelation,
} from './fixture.ts';

const sql = connectTestDatabase();

const boundary = { boundary: 'administrative' };

// On the map of fixture.ts: state West is x 0..5, Landkreis Nord x 0..5, y 4..10.
const features = [
  ...baseFeatures(),

  // Hamlets that are called like the state and the district they lie in (like the hamlet
  // Bayern in Bavaria).
  node(30, 1, 8, { place: 'hamlet', name: 'West' }),
  node(31, 2, 9, { place: 'hamlet', name: 'Landkreis Nord' }),

  // A district-free town without any link to its boundary: a district-level boundary that
  // is also its municipality.
  node(32, 6.5, 1.5, { place: 'town', name: 'Freistadt' }),
  relationArea(110, [6, 1, 7, 2], { ...boundary, admin_level: '6', name: 'Freistadt' }),

  // A municipality whose seat has another name, and a hamlet called like the municipality
  // (like the municipality of Time with its seat in Bryne).
  relationArea(111, [8.2, 4.2, 9.8, 5.8], { ...boundary, admin_level: '8', name: 'Zeit' }),
  node(33, 9, 5, { place: 'village', name: 'Brune' }),
  node(34, 8.5, 4.5, { place: 'hamlet', name: 'Zeit' }),

  // A municipality and three settlements that all carry its Wikidata item (like
  // Treillières and the hamlets around it). The first one is not the one with its name.
  relationArea(112, [0.1, 0.2, 0.9, 3.9], {
    ...boundary,
    admin_level: '8',
    name: 'Trell',
    wikidata: 'Q50',
  }),
  node(35, 0.5, 3, { place: 'village', name: 'Menard', wikidata: 'Q50' }),
  node(36, 0.5, 1, { place: 'village', name: 'Trell', wikidata: 'Q50' }),
  node(37, 0.5, 2, { place: 'hamlet', name: 'Hof', wikidata: 'Q50' }),

  // Two villages with the same item and nothing that says whose it is.
  node(38, 3.5, 0.5, { place: 'village', name: 'Alpha', wikidata: 'Q60' }),
  node(39, 4.5, 0.5, { place: 'village', name: 'Beta', wikidata: 'Q60' }),
];

const relations: FixtureRelation[] = [
  ...baseRelations(),
  {
    id: 111,
    tags: { ...boundary, admin_level: '8', name: 'Zeit' },
    members: [
      { ref: 'w11', role: 'outer' },
      { ref: 'n33', role: 'admin_centre' },
    ],
  },
];

afterAll(async () => {
  await sql.end();
});

beforeAll(async () => {
  await sql`TRUNCATE wikidata_entities, city_tile_shapes, city_names, cities, municipalities, regions, countries, import_runs RESTART IDENTITY CASCADE`;
  const files = await writeFixture(features, relations);
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

describe('A name alone does not make a region the boundary of a settlement (BR-001)', () => {
  it('leaves a hamlet that is called like its state without a boundary', async () => {
    expect(await city('West')).toMatchObject({ boundary_osm_id: null, boundary_match: null });
  });

  it('leaves a hamlet that is called like its district without a boundary', async () => {
    expect(await city('Landkreis Nord')).toMatchObject({ boundary_osm_id: null });
  });

  it('still gives a district-free town its boundary, which is a municipality too', async () => {
    expect(await city('Freistadt')).toMatchObject({
      boundary_osm_id: '110',
      boundary_match: 'name_and_location',
      represents_municipality: true,
    });
  });

  it('still gives a district-free city its district-level boundary through the Wikidata ID', async () => {
    expect(await city('Großstadt')).toMatchObject({ boundary_osm_id: '100' });
  });
});

describe('A boundary that names its centre belongs to that centre (BR-017)', () => {
  it('does not give a municipality to a hamlet of the same name when its seat is elsewhere', async () => {
    expect(await city('Zeit')).toMatchObject({
      boundary_osm_id: null,
      municipality: 'Zeit',
      represents_municipality: false,
    });
  });

  it('does not give it to the seat either, whose name differs', async () => {
    expect(await city('Brune')).toMatchObject({
      boundary_osm_id: null,
      municipality: 'Zeit',
      represents_municipality: false,
    });
  });

  it('still gives a boundary without a named centre to the settlement of the same name', async () => {
    expect(await city('Dorf')).toMatchObject({
      boundary_osm_id: '101',
      boundary_match: 'name_and_location',
    });
  });
});

describe('A Wikidata item belongs to one city (FR-CITY-002)', () => {
  it('gives the boundary to the settlement with its name among those that share its item', async () => {
    expect(await city('Trell')).toMatchObject({
      wikidata_id: 'Q50',
      boundary_osm_id: '112',
      boundary_match: 'wikidata',
      represents_municipality: true,
    });
  });

  it('takes the item from the other settlements that carry it', async () => {
    expect(await city('Menard')).toMatchObject({ wikidata_id: null, boundary_osm_id: null });
    expect(await city('Hof')).toMatchObject({ wikidata_id: null, boundary_osm_id: null });
  });

  it('keeps them as cities of their own, as parts of the municipality', async () => {
    expect(await city('Menard')).toMatchObject({
      municipality: 'Trell',
      represents_municipality: false,
    });
  });

  it('gives the item to nobody when nothing says whose it is', async () => {
    expect(await city('Alpha')).toMatchObject({ wikidata_id: null });
    expect(await city('Beta')).toMatchObject({ wikidata_id: null });
  });

  it('keeps an item that only one city has', async () => {
    expect(await city('Großstadt')).toMatchObject({ wikidata_id: 'Q10' });
  });
});
