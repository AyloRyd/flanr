'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import type { Map as MapboxMap, MapOptions, StyleSpecification } from 'mapbox-gl';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import {
  basemapConfig,
  basemapId,
  baseStyleNames,
  mapStyle,
  satelliteLayer,
  satelliteSource,
  satelliteSourceId,
  withDarkerSpace,
  withoutSettlementLabels,
  type BaseStyleName,
  type ProjectionName,
} from '@/lib/map/base-styles';
import type { Bounds } from '@/lib/map/layers';

/** The public token of the Mapbox account; without it the map is not shown. */
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

/** Mapbox's Standard style, loaded once for all maps of the page. */
let standardStyle: Promise<StyleSpecification | null> | null = null;

/**
 * Loads Mapbox's Standard style, so that a map can hide its settlement labels (FR-MAP-003).
 * Without it the map still works, with Mapbox's names next to Flanr's.
 */
function loadStandardStyle(): Promise<StyleSpecification | null> {
  standardStyle ??= fetch(
    `https://api.mapbox.com/styles/v1/mapbox/standard?access_token=${mapboxToken}`,
  )
    .then((response) => (response.ok ? (response.json() as Promise<StyleSpecification>) : null))
    .catch((error: unknown) => {
      console.warn('The Standard style could not be loaded', error);
      return null;
    });
  return standardStyle;
}

export type InitialView =
  { bounds: Bounds; maxZoom: number } | { center: [number, number]; zoom: number };

interface BaseMapProps {
  /** The accessible name of the map. */
  label: string;
  initialView: InitialView;
  /**
   * Adds the page's own sources and layers, once the style has loaded.
   */
  onStyleLoad: (map: MapboxMap, context: { dark: boolean }) => void;
  /** Called when the site's theme changes, for the page's layers with colours of their own. */
  onThemeChange?: (map: MapboxMap, dark: boolean) => void;
  /** Called once the map exists, and with null when it is gone. */
  onMap?: (map: MapboxMap | null) => void;
  /** The base style chosen outside; without it the map shows its own switch. */
  baseStyle?: BaseStyleName;
  /** The globe, by default, or the flat map (FR-MAP-002). */
  projection?: ProjectionName;
  /** Hides the base map's names of settlements, for a map that draws Flanr's (FR-MAP-003). */
  ownCityNames?: boolean;
  /** Scrolling the page over the map does not zoom it; for maps inside a longer page. */
  cooperativeGestures?: boolean;
  className?: string | undefined;
}

/**
 * A Mapbox map with a standard and a satellite style and a globe at low zoom
 * (FR-MAP-001, FR-MAP-002). It keeps the attribution of Mapbox, OpenStreetMap and the imagery
 * and adds the one of Flanr's city data (NFR-LIC-001). Without a Mapbox token or WebGL it shows a note
 * instead, and the rest of the page keeps working.
 */
export function BaseMap({
  label,
  initialView,
  onStyleLoad,
  onThemeChange,
  onMap,
  baseStyle,
  projection = 'globe',
  ownCityNames = false,
  cooperativeGestures = false,
  className,
}: BaseMapProps) {
  const t = useTranslations('map');
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [ownStyle, setOwnStyle] = useState<BaseStyleName>('standard');
  const style = baseStyle ?? ownStyle;
  const [failed, setFailed] = useState(!mapboxToken);

  // The callbacks change while the map lives; the map reads the newest ones.
  const latest = useRef({ onStyleLoad, onThemeChange, onMap, dark, style, projection });
  useEffect(() => {
    latest.current = { onStyleLoad, onThemeChange, onMap, dark, style, projection };
  });
  /** The style and theme the map shows, so that it changes only when one of them does. */
  const shown = useRef<string | null>(null);

  // The map is created once; the initial view and the options are read only then.
  const created = useRef({
    initialView,
    cooperativeGestures,
    attribution: t('attribution'),
    ownCityNames,
  });

  useEffect(() => {
    if (!mapboxToken || !container.current) return;
    let removed = false;
    const element = container.current;

    void Promise.all([import('mapbox-gl'), loadStandardStyle()]).then(([module, standard]) => {
      if (removed) return;
      const mapboxgl = module.default;
      const darker = standard && withDarkerSpace(standard);
      const basemap =
        darker && created.current.ownCityNames ? withoutSettlementLabels(darker) : darker;
      const { initialView: view, cooperativeGestures: cooperative, attribution } = created.current;
      const viewOptions: Partial<MapOptions> =
        'bounds' in view
          ? { bounds: view.bounds, fitBoundsOptions: { padding: 48, maxZoom: view.maxZoom } }
          : { center: view.center, zoom: view.zoom };
      let map: MapboxMap;
      try {
        map = new mapboxgl.Map({
          container: element,
          accessToken: mapboxToken,
          // The newest style and theme: the stored ones may have come while the map loaded.
          style: mapStyle(latest.current.style, latest.current.dark, basemap),
          projection: latest.current.projection,
          customAttribution: attribution,
          cooperativeGestures: cooperative,
          ...viewOptions,
        });
      } catch (error) {
        // Mostly a browser without WebGL.
        console.warn('The map could not be created', error);
        setFailed(true);
        return;
      }
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('style.load', () => {
        latest.current.onStyleLoad(map, { dark: latest.current.dark });
      });
      mapRef.current = map;
      shown.current = `${latest.current.style}-${latest.current.dark}`;
      latest.current.onMap?.(map);
    });

    return () => {
      removed = true;
      latest.current.onMap?.(null);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && map.getProjection().name !== projection) map.setProjection(projection);
  }, [projection]);

  // Another base style or theme changes the map in place; a new style would also remove
  // Flanr's layers, and Mapbox loses the labels when it replaces the style this way.
  useEffect(() => {
    const map = mapRef.current;
    const key = `${style}-${dark}`;
    if (!map || key === shown.current) return;
    const darkBefore = shown.current?.endsWith('-true') ?? dark;
    shown.current = key;
    const apply = () => {
      for (const [name, value] of Object.entries(basemapConfig(style, dark))) {
        map.setConfigProperty(basemapId, name, value);
      }
      const imagery = Boolean(map.getLayer(satelliteSourceId));
      if (style === 'satellite' && !imagery) {
        map.addSource(satelliteSourceId, satelliteSource);
        map.addLayer(satelliteLayer);
      } else if (style !== 'satellite' && imagery) {
        map.removeLayer(satelliteSourceId);
        map.removeSource(satelliteSourceId);
      }
      if (dark !== darkBefore) latest.current.onThemeChange?.(map, dark);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('style.load', apply);
  }, [style, dark]);

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        {t('unavailable')}
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Mapbox makes its container position: relative, so it takes the full size this way. */}
      <div ref={container} role="region" aria-label={label} className="size-full" />
      {baseStyle === undefined && (
        <BaseStyleSwitch
          value={ownStyle}
          onChange={setOwnStyle}
          className="absolute top-2 left-2"
        />
      )}
    </div>
  );
}

/** Standard or satellite (FR-MAP-001). */
export function BaseStyleSwitch({
  value,
  onChange,
  className,
}: {
  value: BaseStyleName;
  onChange: (style: BaseStyleName) => void;
  className?: string;
}) {
  const t = useTranslations('map');
  return (
    <Segmented
      label={t('style.label')}
      options={baseStyleNames}
      value={value}
      onChange={onChange}
      optionLabel={(style) => t(`style.${style}`)}
      className={className}
    />
  );
}
