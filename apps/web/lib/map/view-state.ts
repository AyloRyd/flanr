import type { SearchParams } from '../search-params';
import { mapModes, type MapMode } from './markers';

/**
 * What the map shows, kept in the URL so that a reload or a shared link shows the same:
 * `?mode=rating&planned=1&city=123`.
 */
export interface MapView {
  mode: MapMode;
  /** Whether the planned cities are shown (FR-MAP-006). */
  planned: boolean;
  /** The selected city (FR-MAP-004). */
  cityId: number | null;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the view from the URL; values that are not understood fall back to the defaults. */
export function readMapView(params: SearchParams): MapView {
  const mode = first(params.mode);
  const city = first(params.city) ?? '';
  return {
    mode: mapModes.find((known) => known === mode) ?? 'visits',
    planned: first(params.planned) === '1',
    cityId: /^[1-9]\d{0,8}$/.test(city) ? Number(city) : null,
  };
}

/** The query string of a view, without the defaults; empty for the default view. */
export function mapViewQuery({ mode, planned, cityId }: MapView): string {
  const query = new URLSearchParams();
  if (mode !== 'visits') query.set('mode', mode);
  if (planned) query.set('planned', '1');
  if (cityId !== null) query.set('city', String(cityId));
  const text = query.toString();
  return text ? `?${text}` : '';
}
