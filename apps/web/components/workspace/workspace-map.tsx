'use client';

import type { SettlementType, UserMap } from '@flanr/shared';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BaseMap, type InitialView } from '@/components/map/base-map';
import {
  addCityLabels,
  addCityTiles,
  addPlannedLayer,
  addSelectionLayer,
  addVisitedLayer,
  clickableLayers,
  layerIds,
  outlineBoundaries,
  selectBoundary,
  setLabelTheme,
  setMarkedCities,
  showCityMarkers,
} from '@/components/map/flanr-layers';
import { useWorkspace } from '@/components/workspace/workspace-context';
import {
  boundaryZoom,
  boundsOf,
  plannedLayer,
  positionOf,
  visitedLayer,
  type Bounds,
} from '@/lib/map/layers';
import type { MapPrefs } from '@/lib/map/view-prefs';

interface WorkspaceMapProps {
  /** The signed-in user's cities; null for a guest. */
  data: UserMap | null;
  prefs: MapPrefs;
  className?: string;
}

const worldView: InitialView = { center: [10, 35], zoom: 1.5 };

/** Room around a city the map moves to: for the city panel on the right of wide screens. */
function panelPadding() {
  return window.innerWidth >= 640 ? { top: 80, bottom: 80, left: 80, right: 480 } : 40;
}

/**
 * Moves the map to a city, close enough to see its boundary (FR-MAP-004): the tiles have
 * boundaries only from a zoom on (FR-MAP-003). A map closer in keeps its zoom.
 */
function flyToCity(map: MapboxMap, position: [number, number], type: SettlementType) {
  map.flyTo({
    center: position,
    zoom: Math.max(map.getZoom(), boundaryZoom(type)),
    // Half the city panel to the left; a padding here would stay on the map for good.
    offset: window.innerWidth >= 640 ? [-214, 0] : [0, 0],
  });
}

/**
 * Fits a city's boundary beside the city panel. The camera is worked out first, because
 * fitBounds would keep the padding on the map, and the globe would stay off centre after the
 * panel closes.
 */
function fitCity(map: MapboxMap, bounds: Bounds) {
  const camera = map.cameraForBounds(bounds, { padding: panelPadding(), maxZoom: 12 });
  if (camera?.center && camera.zoom !== undefined) {
    map.flyTo({ center: camera.center, zoom: camera.zoom });
  }
}

/**
 * The map of the workspace (FR-MAP-008): Flanr's city names to click (FR-MAP-003), the user's
 * cities in the chosen mode (FR-MAP-005, FR-MAP-006) and the selected city (FR-MAP-004).
 */
export function WorkspaceMap({ data, prefs, className }: WorkspaceMapProps) {
  const t = useTranslations('map');
  const router = useRouter();
  const { selection, select } = useWorkspace();
  const [map, setMap] = useState<MapboxMap | null>(null);

  const visited = useMemo(
    () => visitedLayer(prefs.mode, data?.visited ?? [], { values: prefs.values }),
    [prefs.mode, prefs.values, data],
  );
  const planned = useMemo(() => plannedLayer(data?.planned ?? []), [data]);
  const marked = useMemo(
    () =>
      [...(data?.visited ?? []), ...(prefs.planned ? (data?.planned ?? []) : [])].map(
        (c) => c.cityId,
      ),
    [data, prefs.planned],
  );
  const outlined = useMemo(
    () => (prefs.boundaries ? (data?.visited ?? []).map((city) => city.cityId) : []),
    [data, prefs.boundaries],
  );
  const selectedPosition = selection?.position ?? null;
  const selectedId = selection?.cityId ?? null;

  /**
   * The boundaries the map shows now: the selected one and the outlined ones. Kept apart from
   * the state, so that the map clears exactly what it highlighted, also when the highlight came
   * with the style.
   */
  const highlighted = useRef<{ selected: number | null; outlined: number[] }>({
    selected: null,
    outlined: [],
  });

  const current = useRef({
    visited,
    planned,
    marked,
    outlined,
    prefs,
    selectedPosition,
    selectedId,
  });
  useEffect(() => {
    current.current = { visited, planned, marked, outlined, prefs, selectedPosition, selectedId };
  });
  const onStyleLoad = useCallback((target: MapboxMap, { dark }: { dark: boolean }) => {
    const now = current.current;
    addCityTiles(target);
    showCityMarkers(target, now.prefs.cityMarkers);
    addPlannedLayer(target, now.planned, now.prefs.planned);
    addVisitedLayer(target, now.visited);
    addCityLabels(target, dark, now.marked);
    addSelectionLayer(target, now.selectedPosition);
    // A new style starts without any highlight.
    selectBoundary(target, now.selectedId, null);
    outlineBoundaries(target, now.outlined, []);
    highlighted.current = { selected: now.selectedId, outlined: now.outlined };
  }, []);

  useEffect(() => {
    if (!map?.getSource(layerIds.visited)) return;
    addVisitedLayer(map, visited);
  }, [map, visited]);

  useEffect(() => {
    if (map?.getSource(layerIds.planned)) addPlannedLayer(map, planned, prefs.planned);
  }, [map, planned, prefs.planned]);

  useEffect(() => {
    if (map) setMarkedCities(map, marked);
  }, [map, marked]);

  useEffect(() => {
    if (map) showCityMarkers(map, prefs.cityMarkers);
  }, [map, prefs.cityMarkers]);

  // Before the style has loaded there is nothing to change; onStyleLoad starts from the state.
  useEffect(() => {
    if (!map?.getSource(layerIds.selection)) return;
    addSelectionLayer(map, selectedPosition);
    selectBoundary(map, selectedId, highlighted.current.selected);
    highlighted.current.selected = selectedId;
  }, [map, selectedId, selectedPosition]);

  useEffect(() => {
    if (!map?.getSource(layerIds.selection)) return;
    outlineBoundaries(map, outlined, highlighted.current.outlined);
    highlighted.current.outlined = outlined;
  }, [map, outlined]);

  // The map moves to a selected city once, and fits its boundary when the panel has it.
  const moved = useRef<{ cityId: number; fitted: boolean } | null>(null);
  useEffect(() => {
    if (!map) return;
    if (!selection) {
      moved.current = null;
      return;
    }
    const { cityId, bounds, position, settlementType } = selection;
    const done = moved.current?.cityId === cityId ? moved.current : null;
    if (bounds) {
      if (done?.fitted) return;
      fitCity(map, bounds);
      moved.current = { cityId, fitted: true };
    } else if (!done && position && settlementType) {
      flyToCity(map, position, settlementType);
      moved.current = { cityId, fitted: false };
    }
  }, [map, selection]);

  // A click selects the topmost city under it, from any of Flanr's layers (FR-MAP-003).
  useEffect(() => {
    if (!map) return;
    const near = ({ point }: MapMouseEvent) => {
      const layers = clickableLayers.filter((id) => map.getLayer(id));
      const box: [[number, number], [number, number]] = [
        [point.x - 4, point.y - 4],
        [point.x + 4, point.y + 4],
      ];
      return layers.length > 0 ? map.queryRenderedFeatures(box, { layers }) : [];
    };
    const onClick = (event: MapMouseEvent) => {
      const [feature] = near(event);
      const properties = feature?.properties ?? {};
      const cityId = Number(properties.cityId ?? feature?.id);
      if (!feature || !Number.isSafeInteger(cityId)) return;
      const position =
        feature.geometry.type === 'Point'
          ? (feature.geometry.coordinates.slice(0, 2) as [number, number])
          : null;
      const settlementType = (properties.settlementType ??
        properties.type ??
        null) as SettlementType | null;
      // A click moves the map again, also to the city already selected.
      moved.current = null;
      if (!position && settlementType) {
        // A click inside a boundary: the map heads there until the panel has the boundary.
        flyToCity(map, [event.lngLat.lng, event.lngLat.lat], settlementType);
        moved.current = { cityId, fitted: false };
      }
      select({ cityId, position, settlementType, bounds: null });
      router.push(`/map/cities/${cityId}`);
    };
    const onMove = (event: MapMouseEvent) => {
      map.getCanvas().style.cursor = near(event).length > 0 ? 'pointer' : '';
    };
    map.on('click', onClick);
    map.on('mousemove', onMove);
    return () => {
      map.off('click', onClick);
      map.off('mousemove', onMove);
    };
  }, [map, router, select]);

  const initialView = useMemo((): InitialView => {
    const bounds = boundsOf((data?.visited ?? []).map(positionOf));
    return bounds ? { bounds, maxZoom: 5 } : worldView;
    // Only the first view counts; the map does not jump when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BaseMap
      label={t('label')}
      initialView={initialView}
      onStyleLoad={onStyleLoad}
      onThemeChange={setLabelTheme}
      onMap={setMap}
      baseStyle={prefs.baseStyle}
      projection={prefs.projection}
      ownCityNames
      className={className}
    />
  );
}
