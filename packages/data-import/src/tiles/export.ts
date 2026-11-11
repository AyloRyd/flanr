import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { boundaryMinZoom, pointMinZoom } from '@flanr/shared';
import type { Sql } from 'postgres';

/**
 * Writes the city layer as newline-delimited GeoJSON for tippecanoe: one file with a point per
 * city and one with the boundaries. Each feature carries the zoom from which it is shown, the
 * same rules that the API tile endpoint applies.
 */
export async function exportCityFeatures(
  sql: Sql,
  files: { points: string; boundaries: string },
): Promise<{ points: number; boundaries: number }> {
  const minZoomOf = (zooms: Record<string, number>) => sql.json(zooms);

  const points = await writeRows(
    files.points,
    sql<{ feature: string }[]>`
      SELECT json_build_object(
        'type', 'Feature',
        'tippecanoe', json_build_object('minzoom', (${minZoomOf(pointMinZoom)}::jsonb ->> c.settlement_type::text)::int),
        'properties', json_strip_nulls(json_build_object(
          'id', c.id, 'name', c.name_local, 'name_en', c.name_en,
          'type', c.settlement_type, 'population', c.population)),
        'geometry', ST_AsGeoJSON(c.centre, 6)::json
      )::text AS feature
      FROM cities c
      WHERE c.in_source
    `.cursor(2000),
  );

  const boundaries = await writeRows(
    files.boundaries,
    sql<{ feature: string }[]>`
      SELECT json_build_object(
        'type', 'Feature',
        'tippecanoe', json_build_object('minzoom', (${minZoomOf(boundaryMinZoom)}::jsonb ->> c.settlement_type::text)::int),
        'properties', json_build_object('id', c.id, 'type', c.settlement_type),
        'geometry', ST_AsGeoJSON(c.boundary, 6)::json
      )::text AS feature
      FROM cities c
      WHERE c.in_source AND c.boundary IS NOT NULL
    `.cursor(500),
  );

  return { points, boundaries };
}

async function writeRows(
  path: string,
  batches: AsyncIterable<{ feature: string }[]>,
): Promise<number> {
  const out = createWriteStream(path, 'utf8');
  let count = 0;
  for await (const rows of batches) {
    for (const row of rows) {
      count++;
      if (!out.write(`${row.feature}\n`)) await once(out, 'drain');
    }
  }
  out.end();
  await once(out, 'finish');
  return count;
}
