import {
  baseStyleNames,
  projectionNames,
  type BaseStyleName,
  type ProjectionName,
} from './base-styles';
import { mapModes, type MapMode } from './markers';

/** How the user set up the map workspace; remembered in the browser (FR-MAP-008). */
export interface MapPrefs {
  mode: MapMode;
  /** The planned cities as their own layer (FR-MAP-006). */
  planned: boolean;
  /** The value of the mode inside the markers (FR-MAP-005). */
  values: boolean;
  /** A marker for every city of Flanr (FR-MAP-003). */
  cityMarkers: boolean;
  /** The boundaries of all visited cities, shown as the selected one's (FR-MAP-004). */
  boundaries: boolean;
  baseStyle: BaseStyleName;
  /** The globe or the flat map (FR-MAP-002). */
  projection: ProjectionName;
}

export const defaultMapPrefs: MapPrefs = {
  mode: 'visits',
  planned: false,
  values: false,
  cityMarkers: false,
  boundaries: false,
  baseStyle: 'standard',
  projection: 'globe',
};

/** Reads stored preferences; anything missing or not understood keeps its default. */
export function readMapPrefs(stored: string | null): MapPrefs {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    if (parsed && typeof parsed === 'object') raw = parsed as Record<string, unknown>;
  } catch {
    // A broken value is as good as none.
  }
  const flag = (key: keyof MapPrefs) =>
    typeof raw[key] === 'boolean' ? raw[key] : (defaultMapPrefs[key] as boolean);
  return {
    mode: mapModes.find((mode) => mode === raw.mode) ?? defaultMapPrefs.mode,
    planned: flag('planned'),
    values: flag('values'),
    cityMarkers: flag('cityMarkers'),
    boundaries: flag('boundaries'),
    baseStyle: baseStyleNames.find((style) => style === raw.baseStyle) ?? defaultMapPrefs.baseStyle,
    projection:
      projectionNames.find((name) => name === raw.projection) ?? defaultMapPrefs.projection,
  };
}
