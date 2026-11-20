'use client';

import type { SettlementType } from '@flanr/shared';
import { useEffect } from 'react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import type { Bounds } from '@/lib/map/layers';

interface MapSelectionProps {
  city: {
    id: number;
    position: [number, number];
    settlementType: SettlementType;
    bounds: Bounds | null;
  } | null;
}

/**
 * Tells the map which city the page shows, so that it highlights the city and, when the city was
 * opened by its URL, moves to it (FR-MAP-004). Without a city it clears the selection.
 */
export function MapSelection({ city }: MapSelectionProps) {
  const { select } = useWorkspace();
  const id = city?.id ?? null;
  const [longitude, latitude] = city?.position ?? [0, 0];
  const type = city?.settlementType ?? null;
  const bounds = city?.bounds ? JSON.stringify(city.bounds) : null;

  useEffect(() => {
    if (id === null || type === null) {
      select(null);
      return;
    }
    select({
      cityId: id,
      position: [longitude, latitude],
      settlementType: type,
      bounds: bounds ? (JSON.parse(bounds) as Bounds) : null,
      move: true,
    });
  }, [select, id, longitude, latitude, type, bounds]);

  return null;
}
