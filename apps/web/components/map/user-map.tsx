'use client';

import type { CitySummary, SettlementType, UserMap } from '@flanr/shared';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CityPreview } from '@/components/map/city-preview';
import { BaseMap, type InitialView } from '@/components/map/base-map';
import {
  addCityTiles,
  addPlannedLayer,
  addSelectionLayer,
  addVisitedLayer,
  clickableLayers,
  layerIds,
  selectBoundary,
} from '@/components/map/flanr-layers';
import { MapLegend } from '@/components/map/map-legend';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { loadCityPreview } from '@/lib/fresh-actions';
import {
  boundaryZoom,
  boundsOf,
  ownMapData,
  plannedLayer,
  positionOf,
  visitedLayer,
} from '@/lib/map/layers';
import { legendFor, mapModes, type MapMode } from '@/lib/map/markers';
import { mapViewQuery, type MapView } from '@/lib/map/view-state';

interface UserMapViewProps {
  data: UserMap;
  /** Null on the user's own map, else the display name of the profile. */
  ownerName: string | null;
  initialView: MapView;
}

/** A city the user picked on the map, with where it is when the map knows it. */
interface Picked {
  cityId: number;
  position: [number, number] | null;
}

const worldView: InitialView = { center: [10, 35], zoom: 1.2 };

/**
 * A user's map (FR-MAP-005…007): the visited cities in one of three modes with a legend, the
 * planned cities on request, and the preview of a selected city (FR-MAP-004). What it shows is
 * kept in the URL.
 */
export function UserMapView({ data, ownerName, initialView }: UserMapViewProps) {
  const t = useTranslations('map');
  const [view, setView] = useState(initialView);
  const [map, setMap] = useState<MapboxMap | null>(null);
  const [picked, setPicked] = useState<Picked | null>(() =>
    initialView.cityId === null ? null : { cityId: initialView.cityId, position: null },
  );

  const visited = useMemo(() => visitedLayer(view.mode, data.visited), [view.mode, data.visited]);
  const planned = useMemo(() => plannedLayer(data.planned), [data.planned]);
  const legend = useMemo(() => legendFor(view.mode, data.visited), [view.mode, data.visited]);
  const selectedPosition = useMemo(() => {
    if (!picked) return null;
    const own = [...data.visited, ...data.planned].find((city) => city.cityId === picked.cityId);
    return own ? positionOf(own) : picked.position;
  }, [picked, data]);

  // The map adds its layers again after every change of style, from the newest data.
  const current = useRef({ visited, planned, view, selectedPosition, picked });
  useEffect(() => {
    current.current = { visited, planned, view, selectedPosition, picked };
  });
  const onStyleLoad = useCallback((target: MapboxMap) => {
    const now = current.current;
    addCityTiles(target);
    addPlannedLayer(target, now.planned, now.view.planned);
    addVisitedLayer(target, now.visited);
    addSelectionLayer(target, now.selectedPosition);
    selectBoundary(target, now.picked?.cityId ?? null, null);
  }, []);

  // The view goes into the URL without a new request to the server.
  useEffect(() => {
    const query = mapViewQuery({ ...view, cityId: picked?.cityId ?? null });
    if (query !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${query}`);
    }
  }, [view, picked]);

  useEffect(() => {
    if (map?.getSource(layerIds.visited)) addVisitedLayer(map, visited);
  }, [map, visited]);

  useEffect(() => {
    if (map?.getSource(layerIds.planned)) addPlannedLayer(map, planned, view.planned);
  }, [map, planned, view.planned]);

  const selectedId = picked?.cityId ?? null;
  const previousSelected = useRef<number | null>(null);
  useEffect(() => {
    if (map?.getSource(layerIds.selection)) {
      addSelectionLayer(map, selectedPosition);
      selectBoundary(map, selectedId, previousSelected.current);
    }
    previousSelected.current = selectedId;
  }, [map, selectedId, selectedPosition]);

  // A click selects the topmost city under it, from any of Flanr's layers (FR-MAP-003).
  useEffect(() => {
    if (!map) return;
    const near = ({ point }: MapMouseEvent) => {
      const layers = clickableLayers.filter((id) => map.getLayer(id));
      const box: [[number, number], [number, number]] = [
        [point.x - 6, point.y - 6],
        [point.x + 6, point.y + 6],
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
      setPicked({ cityId, position });
      // The tiles have boundaries only from a zoom on, so the map zooms in to show it.
      const type = (properties.settlementType ?? properties.type) as SettlementType | undefined;
      if (position && type && map.getZoom() < boundaryZoom(type)) {
        map.easeTo({ center: position, zoom: boundaryZoom(type) });
      }
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
  }, [map]);

  const preview = useCityPreview(selectedId);

  const mapInitialView = useMemo((): InitialView => {
    const own = [...data.visited, ...data.planned].find((city) => city.cityId === selectedId);
    if (own) return { center: positionOf(own), zoom: boundaryZoom(own.settlementType) };
    const bounds = boundsOf(data.visited.map(positionOf));
    return bounds ? { bounds, maxZoom: 5 } : worldView;
    // Only the first view counts; the map is not moved when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <BaseMap
        label={t('label')}
        initialView={mapInitialView}
        onStyleLoad={onStyleLoad}
        onMap={setMap}
        className="h-[60vh] min-h-80"
      />
      <div className="flex flex-col gap-5">
        {picked && (
          <CityPreview
            key={picked.cityId}
            cityId={picked.cityId}
            city={preview}
            own={ownMapData(data, picked.cityId)}
            ownerName={ownerName}
            onClose={() => setPicked(null)}
          />
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t('mode.label')}</legend>
          <RadioGroup
            value={view.mode}
            onValueChange={(mode) => setView((before) => ({ ...before, mode: mode as MapMode }))}
          >
            {mapModes.map((mode) => (
              <Label key={mode} className="font-normal">
                <RadioGroupItem value={mode} />
                {t(`mode.${mode}`)}
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
        <Label className="font-normal">
          <Checkbox
            checked={view.planned}
            onCheckedChange={(checked) =>
              setView((before) => ({ ...before, planned: checked === true }))
            }
          />
          {t('showPlanned')}
        </Label>
        <MapLegend entries={legend} plannedCount={view.planned ? data.planned.length : null} />
      </div>
    </div>
  );
}

/** The summary of the selected city: undefined while it loads, null if there is none. */
function useCityPreview(cityId: number | null): CitySummary | null | undefined {
  const [loaded, setLoaded] = useState<{ cityId: number; city: CitySummary | null } | null>(null);

  useEffect(() => {
    if (cityId === null) return;
    let stale = false;
    loadCityPreview(cityId)
      .then((city) => {
        if (!stale) setLoaded({ cityId, city });
      })
      .catch(() => {
        if (!stale) setLoaded({ cityId, city: null });
      });
    return () => {
      stale = true;
    };
  }, [cityId]);

  return loaded?.cityId === cityId ? loaded.city : undefined;
}
