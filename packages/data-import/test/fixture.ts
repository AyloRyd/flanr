import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Tags } from '../src/osm/tags.ts';

/**
 * A tiny synthetic OSM extract, written in the formats that osmium produces.
 * Coordinates are plain degrees on a 10 × 10 country so the geometry is easy to follow:
 *
 *   country DE: 0..10 × 0..10, state West: x 0..5, state East: x 5..10,
 *   district Landkreis Nord: x 0..5, y 4..10 (the city in the south-west is district-free)
 */
export interface FixtureFeature {
  id: string;
  tags: Tags;
  geometry:
    | { type: 'Point'; coordinates: [number, number] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface FixtureRelation {
  id: number;
  tags: Tags;
  members: { ref: string; role: string }[];
}

export function node(id: number, x: number, y: number, tags: Tags): FixtureFeature {
  return { id: `n${id}`, tags, geometry: { type: 'Point', coordinates: [x, y] } };
}

/** An area built from relation `id`, as osmium names it (a = 2 * id + 1). */
export function relationArea(
  id: number,
  box: [number, number, number, number],
  tags: Tags,
): FixtureFeature {
  const [x1, y1, x2, y2] = box;
  return {
    id: `a${2 * id + 1}`,
    tags,
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
            [x1, y1],
          ],
        ],
      ],
    },
  };
}

export function baseFeatures(): FixtureFeature[] {
  return [
    relationArea(1, [0, 0, 10, 10], {
      boundary: 'administrative',
      admin_level: '2',
      name: 'Deutschland',
      'name:en': 'Germany',
      'ISO3166-1': 'DE',
    }),
    relationArea(2, [0, 0, 5, 10], {
      boundary: 'administrative',
      admin_level: '4',
      name: 'West',
      'ISO3166-2': 'DE-WW',
    }),
    relationArea(3, [5, 0, 10, 10], {
      boundary: 'administrative',
      admin_level: '4',
      name: 'Ost',
      'name:en': 'East',
      'ISO3166-2': 'DE-OO',
    }),
    relationArea(4, [0, 4, 5, 10], {
      boundary: 'administrative',
      admin_level: '6',
      name: 'Landkreis Nord',
    }),
    // A neighbouring state outside the country, as a strip of it is included in real extracts.
    relationArea(5, [10, 0, 15, 10], {
      boundary: 'administrative',
      admin_level: '4',
      name: 'Nachbarland',
    }),

    // District-free city: its boundary is a district-level one and has the same Wikidata ID.
    node(10, 2, 2, {
      place: 'city',
      name: 'Großstadt',
      'name:en': 'Bigcity',
      population: '500.000',
      'population:date': '2023-12-31',
      capital: '4',
      wikidata: 'Q10',
      wikipedia: 'de:Großstadt',
    }),
    relationArea(100, [1, 1, 3, 3], {
      boundary: 'administrative',
      admin_level: '6',
      name: 'Großstadt',
      wikidata: 'Q10',
    }),

    // A district of the city: not a city (BR-001).
    node(11, 2, 2.5, { place: 'suburb', name: 'Großstadt-Nord' }),

    // Village whose boundary has the same name but no link (like Körbecke).
    node(12, 7, 7, { place: 'village', name: 'Dorf', alt_name: 'Dorpe;Dörp', population: '4662' }),
    relationArea(101, [6.5, 6.5, 7.5, 7.5], {
      boundary: 'administrative',
      admin_level: '10',
      name: 'Dorf',
    }),
    // Municipality around the village with a different name: must not become the village boundary.
    relationArea(103, [6, 6, 9, 9], {
      boundary: 'administrative',
      admin_level: '8',
      name: 'Gemeinde Seeland',
    }),

    // Town mapped twice: as a node and as an area that carries the place tag too.
    node(13, 4, 6.5, { place: 'town', name: 'Kleinstadt' }),
    relationArea(102, [3.5, 6, 4.5, 7], {
      boundary: 'administrative',
      admin_level: '8',
      place: 'town',
      name: 'Kleinstadt',
    }),

    // Hamlet without a mapped boundary: imported as a point (OI-003).
    node(14, 8, 2, { place: 'hamlet', name: 'Weiler' }),

    // Settlement without a name: skipped.
    node(15, 8, 3, { place: 'hamlet' }),

    // Village across the border: not part of this country.
    node(16, 12, 5, { place: 'village', name: 'Fremddorf' }),
  ];
}

export function baseRelations(): FixtureRelation[] {
  return [
    {
      id: 100,
      tags: { boundary: 'administrative', admin_level: '6', name: 'Großstadt' },
      members: [
        { ref: 'w1', role: 'outer' },
        { ref: 'n10', role: 'label' },
      ],
    },
    {
      id: 102,
      tags: { boundary: 'administrative', admin_level: '8', name: 'Kleinstadt' },
      members: [
        { ref: 'w2', role: 'outer' },
        { ref: 'n13', role: 'admin_centre' },
      ],
    },
    {
      id: 103,
      tags: { boundary: 'administrative', admin_level: '8', name: 'Gemeinde Seeland' },
      members: [
        { ref: 'w3', role: 'outer' },
        { ref: 'n12', role: 'admin_centre' },
      ],
    },
  ];
}

export async function writeFixture(features: FixtureFeature[], relations: FixtureRelation[]) {
  const dir = await mkdtemp(join(tmpdir(), 'flanr-osm-'));
  const featuresPath = join(dir, 'features.geojsonseq');
  const relationsPath = join(dir, 'relations.opl');
  await writeFile(
    featuresPath,
    features
      .map(
        (f) =>
          `\x1e${JSON.stringify({ type: 'Feature', id: f.id, properties: f.tags, geometry: f.geometry })}`,
      )
      .join('\n'),
  );
  await writeFile(relationsPath, relations.map(toOpl).join('\n'));
  return { features: featuresPath, relations: relationsPath };
}

function toOpl(relation: FixtureRelation): string {
  const tags = Object.entries(relation.tags).map(
    ([key, value]) => `${escape(key)}=${escape(value)}`,
  );
  const members = relation.members.map((m) => `${m.ref}@${escape(m.role)}`);
  return `r${relation.id} v1 dV c0 t2026-01-01T00:00:00Z i0 u T${tags.join(',')} M${members.join(',')}`;
}

function escape(value: string): string {
  return [...value]
    .map((char) => (/[A-Za-z0-9_:.-]/.test(char) ? char : `%${char.codePointAt(0)?.toString(16)}%`))
    .join('');
}

/**
 * Extra features for the municipality rules (BR-017), all inside Landkreis Nord:
 * a municipality "Altstadt" whose main settlement has the same name, with a core district of
 * its own, and a second village inside the same municipality.
 */
export function municipalityFeatures(): FixtureFeature[] {
  const boundary = { boundary: 'administrative' };
  return [
    // The municipality, and the smaller core district that carries the label of the village node.
    relationArea(104, [0.5, 7.5, 3, 9.5], {
      ...boundary,
      admin_level: '8',
      name: 'Altstadt',
      wikidata: 'Q17',
    }),
    relationArea(105, [0.8, 7.8, 1.5, 8.5], { ...boundary, admin_level: '9', name: 'Altstadt' }),
    node(17, 1, 8, { place: 'village', name: 'Altstadt', wikidata: 'Q17' }),

    // Another village in the same municipality. Only its boundary has a Wikidata ID.
    relationArea(106, [2.2, 8.8, 2.8, 9.3], {
      ...boundary,
      admin_level: '9',
      name: 'Nebendorf',
      wikidata: 'Q18',
    }),
    node(18, 2.5, 9, { place: 'village', name: 'Nebendorf' }),
  ];
}

export function municipalityRelations(): FixtureRelation[] {
  return [
    {
      id: 105,
      tags: { boundary: 'administrative', admin_level: '9', name: 'Altstadt' },
      members: [
        { ref: 'w5', role: 'outer' },
        { ref: 'n17', role: 'label' },
      ],
    },
  ];
}
