import type { LayerSpecification, SourceSpecification, StyleSpecification } from 'mapbox-gl';

/** The two base map styles (FR-MAP-001). */
export const baseStyleNames = ['standard', 'satellite'] as const;
export type BaseStyleName = (typeof baseStyleNames)[number];

export const standardStyleUrl = 'mapbox://styles/mapbox/standard';

/** The ID of Mapbox's Standard style inside Flanr's style, for its configuration. */
export const basemapId = 'basemap';

/** The settlement labels of the Standard style; those of countries and regions stay. */
const settlementLabels = new Set([
  'settlement-major-label',
  'settlement-minor-label',
  'settlement-subdivision-label',
]);

/**
 * The Standard style without its names of settlements, so that Flanr's names are the only ones
 * (FR-MAP-003). Its configuration can hide place labels only all together, countries included,
 * so the layers are hidden in the style itself.
 */
export function withoutSettlementLabels(standard: StyleSpecification): StyleSpecification {
  return {
    ...standard,
    layers: standard.layers.map((layer) =>
      settlementLabels.has(layer.id)
        ? ({ ...layer, layout: { ...layer.layout, visibility: 'none' } } as LayerSpecification)
        : layer,
    ),
  };
}

/**
 * Free satellite imagery until the Mapbox account has its own (FR-MAP-001): Sentinel-2
 * cloudless 2016 by EOX, under CC BY 4.0. The later years are licensed for non-commercial use
 * only. The imagery has a resolution of 10 m, so it gets blurry from about zoom 14 on.
 */
const satellite = {
  sourceId: 'flanr-satellite',
  tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'],
  maxzoom: 14,
  attribution:
    '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)',
};

/** The configuration of the Standard style for a base style and theme. */
export function basemapConfig(name: BaseStyleName, dark: boolean) {
  const imagery = name === 'satellite';
  return {
    lightPreset: dark && !imagery ? 'night' : 'day',
    // Buildings in 3D would hide the imagery.
    show3dObjects: !imagery,
  };
}

export const satelliteSourceId = satellite.sourceId;

export const satelliteSource: SourceSpecification = {
  type: 'raster',
  tiles: satellite.tiles,
  tileSize: 256,
  maxzoom: satellite.maxzoom,
  attribution: satellite.attribution,
};

export const satelliteLayer: LayerSpecification = {
  id: satellite.sourceId,
  type: 'raster',
  source: satellite.sourceId,
  // Above the land and water of the Standard style, below its roads and labels.
  slot: 'bottom',
  paint: { 'raster-emissive-strength': 1 },
};

/**
 * Flanr's base map (FR-MAP-001): Mapbox's Standard style at day or night by the site's theme,
 * and for satellite the imagery under its roads and labels. `standard` is the Standard style as
 * Flanr shows it; without it, the map loads the style as Mapbox has it.
 */
export function mapStyle(
  name: BaseStyleName,
  dark: boolean,
  standard: StyleSpecification | null,
): StyleSpecification {
  const imagery = name === 'satellite';
  return {
    version: 8,
    // Flanr's own labels need the fonts too.
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    imports: [
      {
        id: basemapId,
        url: standardStyleUrl,
        ...(standard ? { data: standard } : {}),
        config: basemapConfig(name, dark),
      },
    ],
    sources: imagery ? { [satelliteSourceId]: satelliteSource } : {},
    layers: imagery ? [satelliteLayer] : [],
  };
}
