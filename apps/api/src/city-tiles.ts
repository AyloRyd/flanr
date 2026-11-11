import {
  boundaryMinZoom,
  cityTileLayers,
  cityTileMaxZoom,
  pointMinZoom,
  type SettlementType,
} from '@flanr/shared';
import { z } from 'zod';
import type { Sql } from './db.ts';

export const tileParamsSchema = z
  .object({
    z: z.coerce.number().int().min(0).max(cityTileMaxZoom),
    x: z.coerce.number().int().min(0),
    y: z.coerce.number().int().min(0),
  })
  .refine(({ z, x, y }) => x < 2 ** z && y < 2 ** z, {
    message: 'x and y must be inside the zoom level',
  });

export type TileParams = z.infer<typeof tileParamsSchema>;

const tileExtent = 4096;
// Features are kept a little beyond the tile edge so that markers on the edge are not cut.
const tileBuffer = 64;

/**
 * Builds one vector tile of the city layer straight from PostGIS (FR-MAP-003).
 * Returns null when the tile has no features.
 */
export async function getCityTile(sql: Sql, { z, x, y }: TileParams): Promise<Uint8Array | null> {
  const pointTypes = typesShownAt(pointMinZoom, z);
  const boundaryTypes = typesShownAt(boundaryMinZoom, z);

  const [row] = await sql<{ tile: Uint8Array }[]>`
    WITH bounds AS (SELECT ST_TileEnvelope(${z}, ${x}, ${y}) AS geom),
    points AS (
      SELECT c.id, c.name_local AS name, c.name_en, c.settlement_type::text AS type, c.population,
             ST_AsMVTGeom(ST_Transform(c.centre, 3857), b.geom, ${tileExtent}, ${tileBuffer}) AS geom
      FROM cities c, bounds b
      WHERE c.in_source
        AND ${typeIn(sql, pointTypes)}
        AND c.centre && ST_Transform(ST_Expand(b.geom, ${tileBuffer}::float8 / ${tileExtent} * (ST_XMax(b.geom) - ST_XMin(b.geom))), 4326)
    ),
    boundaries AS (
      SELECT c.id, c.settlement_type::text AS type,
             ST_AsMVTGeom(s.geom, b.geom, ${tileExtent}, ${tileBuffer}) AS geom
      FROM city_tile_shapes s
      JOIN cities c ON c.id = s.city_id, bounds b
      WHERE c.in_source
        AND ${typeIn(sql, boundaryTypes)}
        AND ${z} BETWEEN s.min_zoom AND s.max_zoom
        AND s.geom && b.geom
    )
    SELECT
      coalesce((SELECT ST_AsMVT(points, ${cityTileLayers.points}, ${tileExtent}, 'geom', 'id')
                FROM points WHERE geom IS NOT NULL), ''::bytea) ||
      coalesce((SELECT ST_AsMVT(boundaries, ${cityTileLayers.boundaries}, ${tileExtent}, 'geom', 'id')
                FROM boundaries WHERE geom IS NOT NULL), ''::bytea) AS tile
  `;
  return row && row.tile.length > 0 ? row.tile : null;
}

/**
 * The types are passed as separate enum parameters. An array parameter would need a text-to-enum
 * cast, which PostgreSQL cannot use with the index on settlement_type.
 */
function typeIn(sql: Sql, types: SettlementType[]) {
  return types.length > 0 ? sql`c.settlement_type IN ${sql(types)}` : sql`false`;
}

function typesShownAt(minZoom: Record<SettlementType, number>, zoom: number): SettlementType[] {
  return (Object.keys(minZoom) as SettlementType[]).filter((type) => minZoom[type] <= zoom);
}
