import { boundaryDetailLevels, boundaryMinZoom, type SettlementType } from '@flanr/shared';
import type { TransactionSql } from 'postgres';

/**
 * Rebuilds the simplified boundaries used by vector tiles for one country.
 * A level is skipped for settlement types whose boundary is not shown at any zoom of that level.
 *
 * Each boundary is simplified on its own, so neighbouring boundaries may no longer meet exactly
 * at low zooms. That is not visible at the zooms where the level is used.
 */
export async function rebuildTileShapes(tx: TransactionSql, countryCode: string): Promise<void> {
  await tx`
    DELETE FROM city_tile_shapes s USING cities c
    WHERE s.city_id = c.id AND c.country_code = ${countryCode}
  `;

  for (const level of boundaryDetailLevels) {
    const types = (Object.keys(boundaryMinZoom) as SettlementType[]).filter(
      (type) => boundaryMinZoom[type] <= level.maxZoom,
    );
    await tx`
      INSERT INTO city_tile_shapes (city_id, min_zoom, max_zoom, geom)
      SELECT id, ${level.minZoom}, ${level.maxZoom}, geom
      FROM (
        SELECT c.id,
               ST_Multi(ST_CollectionExtract(ST_MakeValid(
                 ST_SimplifyPreserveTopology(ST_Transform(c.boundary, 3857), ${level.toleranceMetres})
               ), 3)) AS geom
        FROM cities c
        WHERE c.country_code = ${countryCode}
          AND c.boundary IS NOT NULL
          AND c.settlement_type::text IN ${tx(types)}
      ) simplified
      WHERE NOT ST_IsEmpty(geom)
    `;
  }
  await tx`ANALYZE city_tile_shapes`;
}
