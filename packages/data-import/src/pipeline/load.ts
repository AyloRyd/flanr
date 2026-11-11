import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Sql } from 'postgres';
import { decodeOsmiumId, type OsmType } from '../osm/ids.ts';
import { parseOplRelation } from '../osm/opl.ts';
import {
  capitalStatus,
  cityNames,
  englishName,
  parsePopulation,
  parsePopulationYear,
  settlementType,
  wikipediaUrl,
  type Tags,
} from '../osm/tags.ts';

interface Feature {
  id: string;
  properties: Tags;
  geometry: { type: string };
}

interface PlaceRow {
  osm_type: OsmType;
  osm_id: number;
  settlement_type: string;
  name: string;
  name_en: string;
  wikidata_id: string | null;
  population: number | null;
  population_year: number | null;
  capital_status: string;
  wikipedia_url: string | null;
  tags: Tags;
  geom: string;
}

interface BoundaryRow {
  osm_type: OsmType;
  osm_id: number;
  admin_level: number | null;
  name: string | null;
  tags: Tags;
  geom: string;
}

interface NameRow {
  osm_type: OsmType;
  osm_id: number;
  name: string;
  lang: string | null;
  kind: string;
}

const batchSize = 1000;
const recordSeparator = '\x1e';
const linkRoles = new Set(['label', 'admin_centre']);

export interface LoadStats {
  places: number;
  placesWithoutName: number;
  boundaries: number;
  boundaryLinks: number;
}

/**
 * Loads the GeoJSON sequence written by `osmium export` into staging tables.
 * Settlements go to staging.place. Polygons that can serve as a boundary go to staging.boundary:
 * administrative boundaries and settlements that are mapped as areas.
 */
export async function loadFeatures(
  sql: Sql,
  path: string,
): Promise<Omit<LoadStats, 'boundaryLinks'>> {
  const stats = { places: 0, placesWithoutName: 0, boundaries: 0 };
  const places = new Batch<PlaceRow>((rows) => insertPlaces(sql, rows));
  const names = new Batch<NameRow>((rows) => insertNames(sql, rows));
  const boundaries = new Batch<BoundaryRow>((rows) => insertBoundaries(sql, rows));

  for await (const line of readLines(path)) {
    // GeoJSON text sequences start each record with an ASCII record separator.
    const feature = JSON.parse(line.startsWith(recordSeparator) ? line.slice(1) : line) as Feature;
    const { osmType, osmId } = decodeOsmiumId(feature.id);
    const tags = feature.properties;
    const geom = JSON.stringify(feature.geometry);
    const isPolygon =
      feature.geometry.type === 'MultiPolygon' || feature.geometry.type === 'Polygon';
    const type = settlementType(tags);

    if (type) {
      if (!hasName(tags)) {
        stats.placesWithoutName++;
      } else {
        stats.places++;
        await places.add({
          osm_type: osmType,
          osm_id: osmId,
          settlement_type: type,
          ...placeFields(tags),
          tags,
          geom,
        });
        for (const name of cityNames(tags)) {
          await names.add({ osm_type: osmType, osm_id: osmId, ...name });
        }
      }
    }

    if (isPolygon && (tags.boundary === 'administrative' || type)) {
      stats.boundaries++;
      const adminLevel = Number(tags.admin_level);
      await boundaries.add({
        osm_type: osmType,
        osm_id: osmId,
        admin_level:
          tags.boundary === 'administrative' && Number.isInteger(adminLevel) ? adminLevel : null,
        name: tags.name ?? null,
        tags,
        geom,
      });
    }
  }

  await Promise.all([places.flush(), names.flush(), boundaries.flush()]);
  return stats;
}

/** Loads the label and admin_centre members of boundary relations from osmium's OPL output. */
export async function loadBoundaryLinks(sql: Sql, path: string): Promise<number> {
  let count = 0;
  const links = new Batch<{
    boundary_osm_id: number;
    member_type: OsmType;
    member_id: number;
    role: string;
  }>((rows) => sql`INSERT INTO staging.boundary_member ${sql(rows)}`.then(() => undefined));

  for await (const line of readLines(path)) {
    const relation = parseOplRelation(line);
    if (!relation || relation.tags.boundary !== 'administrative') continue;
    for (const member of relation.members) {
      if (!linkRoles.has(member.role)) continue;
      count++;
      await links.add({
        boundary_osm_id: relation.id,
        member_type: member.type,
        member_id: member.id,
        role: member.role,
      });
    }
  }

  await links.flush();
  return count;
}

/** City fields that come straight from the settlement's own tags. */
export function placeFields(tags: Tags & { name: string }) {
  const wikidata = tags.wikidata?.trim();
  const population = parsePopulation(tags.population);
  return {
    name: tags.name,
    name_en: englishName(tags) ?? tags.name,
    wikidata_id: wikidata && /^Q\d+$/.test(wikidata) ? wikidata : null,
    population,
    population_year: population === null ? null : parsePopulationYear(tags),
    capital_status: capitalStatus(tags),
    wikipedia_url: wikipediaUrl(tags.wikipedia),
  };
}

async function insertPlaces(sql: Sql, rows: PlaceRow[]): Promise<void> {
  await sql`
    INSERT INTO staging.place (osm_type, osm_id, settlement_type, name, name_en, wikidata_id,
      population, population_year, capital_status, wikipedia_url, tags, geom)
    SELECT r.osm_type::osm_type, r.osm_id, r.settlement_type::settlement_type, r.name, r.name_en,
           r.wikidata_id, r.population, r.population_year, r.capital_status::capital_status,
           r.wikipedia_url, r.tags, ST_SetSRID(ST_GeomFromGeoJSON(r.geom), 4326)
    FROM jsonb_to_recordset(${sql.json(rows as never)})
      AS r(osm_type text, osm_id bigint, settlement_type text, name text, name_en text,
           wikidata_id text, population integer, population_year smallint, capital_status text,
           wikipedia_url text, tags jsonb, geom text)
    ON CONFLICT DO NOTHING
  `;
}

async function insertBoundaries(sql: Sql, rows: BoundaryRow[]): Promise<void> {
  // ST_MakeValid fixes self-intersections; ST_CollectionExtract keeps only the polygon parts.
  await sql`
    INSERT INTO staging.boundary (osm_type, osm_id, admin_level, name, tags, geom)
    SELECT r.osm_type::osm_type, r.osm_id, r.admin_level, r.name, r.tags,
           ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(r.geom), 4326)), 3))
    FROM jsonb_to_recordset(${sql.json(rows as never)})
      AS r(osm_type text, osm_id bigint, admin_level smallint, name text, tags jsonb, geom text)
    ON CONFLICT DO NOTHING
  `;
}

async function insertNames(sql: Sql, rows: NameRow[]): Promise<void> {
  await sql`INSERT INTO staging.place_name ${sql(rows as never)}`;
}

function readLines(path: string): AsyncIterable<string> {
  const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  return (async function* () {
    for await (const line of lines) {
      if (line.trim()) yield line;
    }
  })();
}

class Batch<T> {
  private rows: T[] = [];

  constructor(private readonly write: (rows: T[]) => Promise<void>) {}

  async add(row: T): Promise<void> {
    this.rows.push(row);
    if (this.rows.length >= batchSize) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.rows.length === 0) return;
    const rows = this.rows;
    this.rows = [];
    await this.write(rows);
  }
}

function hasName(tags: Tags): tags is Tags & { name: string } {
  return Boolean(tags.name?.trim());
}
