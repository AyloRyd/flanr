import {
  boundaryMinZoom,
  cityTileMaxZoom,
  type MapCity,
  type SettlementType,
  type UserMap,
  type VisitedMapCity,
} from '@flanr/shared';
import {
  markerClass,
  markerValue,
  markerImageId,
  plannedStyle,
  type MapMode,
  type MarkerImage,
  type MarkerStyle,
} from './markers';

/** What every marker of the user's layers carries; the map draws its image from it. */
export interface MarkerProperties extends MarkerImage {
  cityId: number;
  settlementType: SettlementType;
  /** Higher keys are drawn above lower ones. */
  sortKey: number;
  /** The name of the marker's image on the map (markerImageId). */
  image: string;
}

export type MarkerCollection = GeoJSON.FeatureCollection<GeoJSON.Point, MarkerProperties>;

function feature(
  city: MapCity,
  style: MarkerStyle,
  sortKey: number,
  value = '',
): GeoJSON.Feature<GeoJSON.Point, MarkerProperties> {
  return {
    type: 'Feature',
    id: city.cityId,
    geometry: { type: 'Point', coordinates: [city.longitude, city.latitude] },
    properties: {
      cityId: city.cityId,
      settlementType: city.settlementType,
      sortKey,
      image: markerImageId({ ...style, value }),
      value,
      ...style,
    },
  };
}

/**
 * The visited cities of a user, styled for the mode (FR-MAP-005). A higher class is drawn
 * above a lower one: in the population mode larger markers cover smaller ones. With `values`,
 * every marker shows the value of the mode inside, at the same size.
 */
export function visitedLayer(
  mode: MapMode,
  cities: VisitedMapCity[],
  { values = false }: { values?: boolean } = {},
): MarkerCollection {
  return {
    type: 'FeatureCollection',
    features: cities.map((city) => {
      const { style, rank } = markerClass(mode, city);
      // A sign such as the house of a lived-in city stays in place of the value.
      const value = values && !style.symbol ? markerValue(mode, city) : '';
      return feature(city, style, rank, value);
    }),
  };
}

/** The planned cities of a user, in a style of their own (FR-MAP-006). */
export function plannedLayer(cities: MapCity[]): MarkerCollection {
  return {
    type: 'FeatureCollection',
    features: cities.map((city) => feature(city, plannedStyle, 0)),
  };
}

/** The user's data for one city of the map, for the preview (FR-MAP-004). */
export type OwnMapData =
  | { kind: 'visited'; visitCount: number; livedIn: boolean; rating: number | null }
  | { kind: 'planned' }
  | { kind: 'none' };

export function ownMapData(map: UserMap, cityId: number): OwnMapData {
  const visited = map.visited.find((city) => city.cityId === cityId);
  if (visited) {
    const { visitCount, livedIn, rating } = visited;
    return { kind: 'visited', visitCount, livedIn, rating };
  }
  if (map.planned.some((city) => city.cityId === cityId)) return { kind: 'planned' };
  return { kind: 'none' };
}

/** Below this zoom even the boundary of a large city is too small to see. */
const minSelectionZoom = 9;

/**
 * The zoom the map moves to when a city is selected further out, so that its highlighted
 * boundary can be seen (FR-MAP-004). The tiles carry boundaries only from a zoom on (FR-MAP-003).
 */
export function boundaryZoom(type: SettlementType): number {
  return Math.min(Math.max(boundaryMinZoom[type] + 1, minSelectionZoom), cityTileMaxZoom);
}

export type Bounds = [[number, number], [number, number]];

/** The box around the positions, given as [longitude, latitude]; null without positions. */
export function boundsOf(positions: readonly (readonly number[])[]): Bounds | null {
  if (positions.length === 0) return null;
  let [west, south, east, north] = [180, 90, -180, -90];
  for (const [longitude = 0, latitude = 0] of positions) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  return [
    [west, south],
    [east, north],
  ];
}

export const positionOf = (city: MapCity): [number, number] => [city.longitude, city.latitude];

/** What the map of a city page draws: the boundary, or the centre for a city without one. */
export interface CityShape {
  features: GeoJSON.FeatureCollection;
  view: { bounds: Bounds; maxZoom: number } | { center: [number, number]; zoom: number };
}

/**
 * The shape of a city for the map of its page (FR-CITY-001). A city mapped as a point only is
 * shown as a point (OI-003).
 */
export function cityShape(city: {
  centre: { longitude: number; latitude: number };
  boundary: GeoJSON.MultiPolygon | null;
}): CityShape {
  const centre: [number, number] = [city.centre.longitude, city.centre.latitude];
  const bounds = city.boundary ? boundsOf(city.boundary.coordinates.flat(2)) : null;
  if (!city.boundary || !bounds) {
    return {
      features: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: centre }, properties: {} },
        ],
      },
      view: { center: centre, zoom: 11 },
    };
  }
  return {
    features: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: city.boundary, properties: {} }],
    },
    view: { bounds, maxZoom: 13 },
  };
}
