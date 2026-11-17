'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import type { Map as MapboxMap, MapOptions } from 'mapbox-gl';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Bounds } from '@/lib/map/layers';

/** The public token of the Mapbox account; without it the map is not shown. */
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

/** The two base map styles (FR-MAP-001). Both have labels; satellite shows imagery. */
const baseStyles = {
  standard: 'mapbox://styles/mapbox/standard',
  satellite: 'mapbox://styles/mapbox/standard-satellite',
} as const;
type BaseStyle = keyof typeof baseStyles;

export type InitialView =
  { bounds: Bounds; maxZoom: number } | { center: [number, number]; zoom: number };

interface BaseMapProps {
  /** The accessible name of the map. */
  label: string;
  initialView: InitialView;
  /**
   * Adds the page's own sources and layers. A change of the base style removes them, so it is
   * called again after every one.
   */
  onStyleLoad: (map: MapboxMap) => void;
  /** Called once the map exists, and with null when it is gone. */
  onMap?: (map: MapboxMap | null) => void;
  /** Scrolling the page over the map does not zoom it; for maps inside a longer page. */
  cooperativeGestures?: boolean;
  className?: string;
}

/**
 * A Mapbox map with the standard and the satellite style and a globe at low zoom
 * (FR-MAP-001, FR-MAP-002). It keeps the attribution of Mapbox and OpenStreetMap and adds the
 * one of Flanr's city data (NFR-LIC-001). Without a Mapbox token or WebGL it shows a note
 * instead, and the rest of the page keeps working.
 */
export function BaseMap({
  label,
  initialView,
  onStyleLoad,
  onMap,
  cooperativeGestures = false,
  className,
}: BaseMapProps) {
  const t = useTranslations('map');
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [baseStyle, setBaseStyle] = useState<BaseStyle>('standard');
  const [failed, setFailed] = useState(!mapboxToken);

  // The callbacks and the theme change while the map lives; the map reads the newest ones.
  const latest = useRef({ onStyleLoad, onMap, dark: resolvedTheme === 'dark' });
  useEffect(() => {
    latest.current = { onStyleLoad, onMap, dark: resolvedTheme === 'dark' };
  });

  // The map is created once; the initial view and the options are read only then.
  const created = useRef({ initialView, cooperativeGestures, attribution: t('attribution') });

  useEffect(() => {
    if (!mapboxToken || !container.current) return;
    let removed = false;
    const element = container.current;

    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (removed) return;
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
          style: baseStyles.standard,
          projection: 'globe',
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
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('style.load', () => {
        applyLightPreset(map, latest.current.dark);
        latest.current.onStyleLoad(map);
      });
      mapRef.current = map;
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
    if (map?.isStyleLoaded()) applyLightPreset(map, resolvedTheme === 'dark');
  }, [resolvedTheme]);

  function switchStyle(next: BaseStyle) {
    setBaseStyle(next);
    // The two styles differ too much for a diff; Flanr's layers come back on style.load.
    // The cast: the types of mapbox-gl 3.34 wrongly require the two font options.
    const options = { diff: false } as Parameters<MapboxMap['setStyle']>[1];
    mapRef.current?.setStyle(baseStyles[next], options);
  }

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl border bg-muted p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        {t('unavailable')}
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border', className)}>
      {/* Mapbox makes its container position: relative, so it takes the full size this way. */}
      <div ref={container} role="region" aria-label={label} className="size-full" />
      <div
        role="group"
        aria-label={t('style.label')}
        className="absolute top-2 left-2 flex rounded-lg border bg-background/90 p-0.5 text-sm shadow-sm"
      >
        {(Object.keys(baseStyles) as BaseStyle[]).map((style) => (
          <button
            key={style}
            type="button"
            aria-pressed={baseStyle === style}
            onClick={() => switchStyle(style)}
            className={cn(
              'rounded-md px-2.5 py-1',
              baseStyle === style ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {t(`style.${style}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The light of the base map follows the theme of the site. */
function applyLightPreset(map: MapboxMap, dark: boolean): void {
  try {
    map.setConfigProperty('basemap', 'lightPreset', dark ? 'night' : 'day');
  } catch {
    // A style without the basemap import has no light presets.
  }
}
