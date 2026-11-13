import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { createTestApi, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const { clientFor } = createTestApi(sql);
const guest = clientFor(null);

const square = 'SRID=4326;MULTIPOLYGON(((7 51, 8 51, 8 52, 7 52, 7 51)))';

interface TestCity {
  id: number;
  name: string;
  nameEn?: string;
  country?: string;
  region?: number;
  type?: 'city' | 'town' | 'village' | 'hamlet';
  population?: number | null;
  /** The municipality the city belongs to, and whether the city is that municipality itself. */
  municipality?: number;
  isMunicipality?: boolean;
  inSource?: boolean;
  /** Further names as [name, kind]. The local and the English name are added as main names. */
  names?: [string, string][];
}

const [nrw, hesse, brandenburg, kyivCity] = [1, 2, 3, 4];
const [cologne, herbstein, gruenberg] = [1, 2, 3];

const cities: TestCity[] = [
  {
    id: 1,
    name: 'Köln',
    nameEn: 'Cologne',
    region: nrw,
    population: 1_025_523,
    municipality: cologne,
    isMunicipality: true,
    names: [
      ['Kölle', 'loc_name'],
      ['Colonia', 'name'],
      ['Кёльн', 'name'],
    ],
  },
  { id: 2, name: 'Cologne', country: 'FR', type: 'village', population: 947 },
  {
    id: 3,
    name: 'Київ',
    nameEn: 'Kyiv',
    country: 'UA',
    region: kyivCity,
    population: 2_952_301,
    names: [
      ['Kiev', 'old_name'],
      ['Kijów', 'name'],
    ],
  },
  { id: 4, name: 'Frankfurt am Main', nameEn: 'Frankfurt', region: hesse, population: 760_656 },
  { id: 5, name: 'Frankfurt (Oder)', region: brandenburg, type: 'town', population: 56_586 },
  {
    id: 6,
    name: 'Stockhausen',
    region: hesse,
    type: 'village',
    population: null,
    municipality: herbstein,
  },
  {
    id: 7,
    name: 'Stockhausen',
    region: hesse,
    type: 'village',
    population: 199,
    municipality: gruenberg,
  },
  { id: 8, name: 'Wuppertal', region: nrw, population: 357_243 },
  {
    id: 9,
    name: 'Berlin',
    population: 3_700_577,
    names: [
      ['Stadt Berlin', 'official_name'],
      ['Spree-Athen', 'wikidata_alias'],
    ],
  },
  { id: 10, name: 'Stuttgart', population: 630_000 },
  { id: 11, name: 'Stade', type: 'town', population: 48_000 },
  { id: 12, name: 'Atlantis', population: 9_000_000, inSource: false },
  { id: 13, name: 'Wörth', type: 'town', population: 18_000 },
];

async function insertFixture() {
  await resetData(sql);
  await sql`INSERT INTO countries (code, name_local, name_en) VALUES
    ('FR', 'France', 'France'), ('UA', 'Україна', 'Ukraine')`;
  await sql`
    INSERT INTO regions (id, osm_type, osm_id, country_code, level, name_local, name_en, boundary)
    OVERRIDING SYSTEM VALUE VALUES
      (${nrw}, 'relation', 101, 'DE', 1, 'Nordrhein-Westfalen', 'North Rhine-Westphalia', ${square}),
      (${hesse}, 'relation', 102, 'DE', 1, 'Hessen', 'Hesse', ${square}),
      (${brandenburg}, 'relation', 103, 'DE', 1, 'Brandenburg', 'Brandenburg', ${square}),
      (${kyivCity}, 'relation', 104, 'UA', 1, 'Київ', 'Kyiv', ${square})`;
  await sql`
    INSERT INTO municipalities (id, osm_type, osm_id, country_code, name_local, name_en, boundary)
    OVERRIDING SYSTEM VALUE VALUES
      (${cologne}, 'relation', 201, 'DE', 'Köln', 'Cologne', ${square}),
      (${herbstein}, 'relation', 202, 'DE', 'Herbstein', 'Herbstein', ${square}),
      (${gruenberg}, 'relation', 203, 'DE', 'Grünberg', 'Grünberg', ${square})`;
  for (const city of cities) {
    const nameEn = city.nameEn ?? city.name;
    await sql`
      INSERT INTO cities (id, osm_type, osm_id, name_local, name_en, country_code, region_1_id,
        municipality_id, represents_municipality, settlement_type, centre, population, in_source)
      OVERRIDING SYSTEM VALUE
      VALUES (${city.id}, 'node', ${city.id}, ${city.name}, ${nameEn}, ${city.country ?? 'DE'},
        ${city.region ?? null}, ${city.municipality ?? null}, ${city.isMunicipality ?? false},
        ${city.type ?? 'city'}::settlement_type, ST_SetSRID(ST_MakePoint(7, 51), 4326),
        ${city.population ?? null}, ${city.inSource ?? true})`;
    const names = new Map<string, string>([
      [city.name, 'name'],
      [nameEn, 'name'],
    ]);
    for (const [name, kind] of city.names ?? []) names.set(name, kind);
    for (const [name, kind] of names) {
      await sql`INSERT INTO city_names (city_id, name, kind) VALUES (${city.id}, ${name}, ${kind})`;
    }
  }
}

const search = (q: string, query: { limit?: number; cursor?: string } = {}) =>
  guest.GET('/v1/cities', { params: { query: { q, ...query } } });
const found = async (q: string) => (await search(q)).data?.items ?? [];
const names = async (q: string) => (await found(q)).map((city) => city.name);

beforeAll(insertFixture);
afterAll(async () => {
  await resetData(sql);
  await sql.end();
});

describe('GET /v1/cities: finding a city by its names (FR-SRCH-001)', () => {
  it('finds Köln for "Cologne", before the village that is called Cologne', async () => {
    expect(await names('Cologne')).toEqual(['Köln', 'Cologne']);
  });

  it('finds Köln for "Koln", without the diacritic', async () => {
    expect(await names('Koln')).toEqual(['Köln']);
  });

  it('finds Kyiv for "Kiev", a former name', async () => {
    expect(await names('Kiev')).toEqual(['Київ']);
  });

  it.each([
    ['the local name', 'Київ'],
    ['the English name', 'Kyiv'],
    ['a name in another language', 'Kijów'],
    ['a name in another script', 'Кёльн'],
    ['upper case', 'KÖLN'],
    ['spaces around the query', '  Köln  '],
  ])('finds the city by %s: %j', async (_case, q) => {
    expect((await names(q)).length).toBe(1);
  });

  it('finds a city by a local nickname only when it is the whole query', async () => {
    expect(await names('Spree-Athen')).toEqual(['Berlin']);
    expect(await names('Spree')).toEqual([]);
  });

  it('tolerates a small typo', async () => {
    expect((await names('Wupertal'))[0]).toBe('Wuppertal');
    expect((await names('Colgne'))[0]).toBe('Köln');
    expect((await names('Stutgart'))[0]).toBe('Stuttgart');
  });

  it('finds cities whose name starts with the query, the largest first', async () => {
    expect(await names('St')).toEqual(['Stuttgart', 'Stade', 'Stockhausen', 'Stockhausen']);
  });

  it('does not find Berlin for "St" through its official name "Stadt Berlin"', async () => {
    expect(await names('St')).not.toContain('Berlin');
    expect(await names('Stadt B')).not.toContain('Berlin');
    expect(await names('Stadt Berlin')).toEqual(['Berlin']);
  });

  it('puts a city with exactly this name before larger cities that start with it', async () => {
    await sql`INSERT INTO cities (id, osm_type, osm_id, name_local, name_en, country_code,
        settlement_type, centre, population)
      OVERRIDING SYSTEM VALUE
      VALUES (50, 'node', 50, 'Stad', 'Stad', 'DE', 'hamlet', ST_SetSRID(ST_MakePoint(7, 51), 4326), 12)`;
    await sql`INSERT INTO city_names (city_id, name, kind) VALUES (50, 'Stad', 'name')`;

    const result = await names('Stad');
    await sql`DELETE FROM cities WHERE id = 50`;

    expect(result).toEqual(['Stad', 'Stade']);
  });

  it('needs the whole name for a single letter', async () => {
    expect(await names('S')).toEqual([]);
  });

  it('finds nothing for a name no city has', async () => {
    const { data, response } = await search('Xqzwvk');

    expect(response.status).toBe(200);
    expect(data).toEqual({ items: [], nextCursor: null });
  });

  it('does not find a city that is no longer in the source data', async () => {
    expect(await names('Atlantis')).toEqual([]);
  });

  it('treats % and _ in the query as text', async () => {
    expect(await names('%')).toEqual([]);
    expect(await names('St%')).toEqual([]);
    expect(await names('S_a')).toEqual([]);
    expect(await names('Sta')).toEqual(['Stade']);
  });

  it('says which name matched when it is neither the local nor the English one', async () => {
    expect((await found('Kiev'))[0]).toMatchObject({ name: 'Київ', matchedName: 'Kiev' });
    expect((await found('Cologne'))[0]).toMatchObject({ name: 'Köln', matchedName: null });
    expect((await found('Koln'))[0]).toMatchObject({ name: 'Köln', matchedName: null });
  });

  it('is open to guests and to signed-in users alike', async () => {
    const { response } = await clientFor('ada-token').GET('/v1/cities', {
      params: { query: { q: 'Köln' } },
    });

    expect(response.status).toBe(200);
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejects the query %j', async (q) => {
    const { response } = await search(q);

    expect(response.status).toBe(400);
  });
});

describe('GET /v1/cities: telling cities apart (FR-SRCH-002)', () => {
  it('shows Frankfurt am Main and Frankfurt (Oder) with their regions', async () => {
    expect(await found('Frankfurt')).toEqual([
      {
        id: 4,
        name: 'Frankfurt am Main',
        nameEn: 'Frankfurt',
        matchedName: null,
        settlementType: 'city',
        population: 760_656,
        country: { code: 'DE', name: 'Germany' },
        region: 'Hesse',
        municipality: null,
        rating: null,
        ratingCount: 0,
      },
      expect.objectContaining({
        name: 'Frankfurt (Oder)',
        settlementType: 'town',
        region: 'Brandenburg',
      }),
    ]);
  });

  it('shows the Stockhausen that is part of Herbstein with that municipality', async () => {
    const result = await found('Stockhausen');

    expect(result.map((city) => city.municipality)).toEqual(['Grünberg', 'Herbstein']);
    expect(result.every((city) => city.settlementType === 'village')).toBe(true);
  });

  it('shows no municipality for a city that is its municipality', async () => {
    expect((await found('Köln'))[0]).toMatchObject({
      municipality: null,
      region: 'North Rhine-Westphalia',
    });
  });

  it('shows the country, and no region where the city has none', async () => {
    expect((await found('Cologne'))[1]).toMatchObject({
      country: { code: 'FR', name: 'France' },
      region: null,
      population: 947,
    });
  });

  it('lists a city without a known population after those with one', async () => {
    expect((await found('Stockhausen')).map((city) => city.population)).toEqual([199, null]);
  });
});

describe('GET /v1/cities: pages (SRS 6.2)', () => {
  it('continues where the page before ended', async () => {
    const first = await search('St', { limit: 3 });
    const second = await search('St', { limit: 3, cursor: first.data?.nextCursor ?? undefined });

    expect(first.data?.items.map((city) => city.name)).toEqual([
      'Stuttgart',
      'Stade',
      'Stockhausen',
    ]);
    expect(second.data?.items.map((city) => city.id)).toEqual([6]);
    expect(second.data?.nextCursor).toBeNull();
  });

  it('rejects a cursor it did not return', async () => {
    const { response } = await search('St', { cursor: 'x' });

    expect(response.status).toBe(400);
  });

  it('ends after the first thousand results', async () => {
    const { data } = await search('St', { cursor: '1000' });

    expect(data).toEqual({ items: [], nextCursor: null });
  });
});
