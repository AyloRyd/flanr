/**
 * Rules of the city vector tiles, shared by the API endpoint, the PMTiles build and the map.
 * The tiles have two layers: one point per city, and city boundaries.
 */
export const cityTileLayers = {
  points: 'city_points',
  boundaries: 'city_boundaries',
} as const;

export const cityTileMaxZoom = 12;

export type SettlementType = 'city' | 'town' | 'village' | 'hamlet';

/** Lowest zoom at which a settlement's point is in the tiles. Smaller settlements appear later. */
export const pointMinZoom: Record<SettlementType, number> = {
  city: 0,
  town: 7,
  village: 9,
  hamlet: 11,
};

/** Lowest zoom at which a settlement's boundary is in the tiles. */
export const boundaryMinZoom: Record<SettlementType, number> = {
  city: 5,
  town: 8,
  village: 10,
  hamlet: 11,
};

/**
 * Boundaries are simplified once per zoom range instead of on every tile request.
 * The tolerance is in Web Mercator metres, about one screen pixel at the top zoom of the range.
 */
export const boundaryDetailLevels = [
  { minZoom: 0, maxZoom: 7, toleranceMetres: 600 },
  { minZoom: 8, maxZoom: 10, toleranceMetres: 75 },
  { minZoom: 11, maxZoom: cityTileMaxZoom, toleranceMetres: 10 },
] as const;
