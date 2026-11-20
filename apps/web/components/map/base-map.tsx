'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import type { Map as MapboxMap, MapOptions } from 'mapbox-gl';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { baseStyleNames, type BaseStyleName } from '@/lib/map/base-styles';
import type { Bounds } from '@/lib/map/layers';

/** The public token of the Mapbox account; without it the map is not shown. */
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

/**
 * Mapbox's classic styles (FR-MAP-001). Unlike the Standard style they let Flanr hide the
 * settlement labels alone and keep the countries' (FR-MAP-003); the standard style follows the
 * light or dark theme of the site.
 */
function styleUrl(style: BaseStyleName, dark: boolean): string {
  if (style === 'satellite') return 'mapbox://styles/mapbox/satellite-streets-v12';
  return dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
}

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
  onStyleLoad: (map: MapboxMap, context: { dark: boolean }) => void;
  /** Called once the map exists, and with null when it is gone. */
  onMap?: (map: MapboxMap | null) => void;
  /** The base style chosen outside; without it the map shows its own switch. */
  baseStyle?: BaseStyleName;
  /** Scrolling the page over the map does not zoom it; for maps inside a longer page. */
  cooperativeGestures?: boolean;
  className?: string | undefined;
}

/**
 * A Mapbox map with a standard and a satellite style and a globe at low zoom
 * (FR-MAP-001, FR-MAP-002). It keeps the attribution of Mapbox and OpenStreetMap and adds the
 * one of Flanr's city data (NFR-LIC-001). Without a Mapbox token or WebGL it shows a note
 * instead, and the rest of the page keeps working.
 */
export function BaseMap({
  label,
  initialView,
  onStyleLoad,
  onMap,
  baseStyle,
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
  const latest = useRef({ onStyleLoad, onMap, dark });
  useEffect(() => {
    latest.current = { onStyleLoad, onMap, dark };
  });

  // The map is created once; the initial view and the options are read only then.
  const created = useRef({
    initialView,
    cooperativeGestures,
    attribution: t('attribution'),
    style,
  });

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
          style: styleUrl(created.current.style, latest.current.dark),
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
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('style.load', () => {
        latest.current.onStyleLoad(map, { dark: latest.current.dark });
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

  // A new style, or the light one for the dark one; Flanr's layers come back on style.load.
  const shownUrl = useRef<string | null>(null);
  useEffect(() => {
    const url = styleUrl(style, dark);
    if (shownUrl.current === null) {
      shownUrl.current = url;
      return;
    }
    if (url === shownUrl.current) return;
    shownUrl.current = url;
    // The cast: the types of mapbox-gl 3.34 wrongly require the two font options.
    const options = { diff: false } as Parameters<MapboxMap['setStyle']>[1];
    mapRef.current?.setStyle(url, options);
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
    <div
      role="group"
      aria-label={t('style.label')}
      className={cn('flex rounded-lg border bg-background/90 p-0.5 text-sm shadow-sm', className)}
    >
      {baseStyleNames.map((style) => (
        <button
          key={style}
          type="button"
          aria-pressed={value === style}
          onClick={() => onChange(style)}
          className={cn(
            'rounded-md px-2.5 py-1',
            value === style ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )}
        >
          {t(`style.${style}`)}
        </button>
      ))}
    </div>
  );
}
