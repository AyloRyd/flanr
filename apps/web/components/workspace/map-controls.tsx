'use client';

import type { UserMap } from '@flanr/shared';
import { Map as MapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ToggleGroup } from 'radix-ui';
import { useMemo } from 'react';
import { BaseStyleSwitch } from '@/components/map/base-map';
import { MapLegend } from '@/components/map/map-legend';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Segmented } from '@/components/ui/segmented';
import { projectionNames } from '@/lib/map/base-styles';
import { legendFor, mapModes, type MapMode } from '@/lib/map/markers';
import type { MapPrefs } from '@/lib/map/view-prefs';
import { cn } from '@/lib/utils';

interface MapControlsProps {
  /** The signed-in user's cities; null for a guest, who has no modes. */
  data: UserMap | null;
  prefs: MapPrefs;
  onChange: (change: Partial<MapPrefs>) => void;
  className?: string;
}

/**
 * How the map shows things, behind a small button at the corner of the map: the mode with its
 * legend (FR-MAP-005), the planned cities (FR-MAP-006), values inside markers, markers for all
 * cities (FR-MAP-003), the base style (FR-MAP-001) and the projection (FR-MAP-002).
 */
export function MapControls({ data, prefs, onChange, className }: MapControlsProps) {
  const t = useTranslations('map');
  const tw = useTranslations('workspace');
  const legend = useMemo(() => legendFor(prefs.mode, data?.visited ?? []), [prefs.mode, data]);

  const toggle = (key: 'planned' | 'values' | 'cityMarkers' | 'boundaries', label: string) => (
    <Label className="font-normal">
      <Checkbox
        checked={prefs[key]}
        onCheckedChange={(checked) => onChange({ [key]: checked === true })}
      />
      {label}
    </Label>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={tw('controls')}
          title={tw('controls')}
          // Opaque in both themes: the outline button is see-through in the dark one.
          className={cn(
            'size-10 rounded-xl bg-background shadow-md dark:bg-background dark:hover:bg-muted dark:aria-expanded:bg-muted',
            className,
          )}
        >
          <MapIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={tw('controls')}
        className="flex w-72 flex-col divide-y text-sm"
      >
        {data && (
          <div className="flex flex-col gap-2 p-3">
            <p id="map-mode" className="text-xs font-medium text-muted-foreground">
              {t('mode.label')}
            </p>
            <ToggleGroup.Root
              type="single"
              value={prefs.mode}
              // Choosing the chosen mode again keeps it rather than leaving none.
              onValueChange={(mode) => mode && onChange({ mode: mode as MapMode })}
              aria-labelledby="map-mode"
              className="grid grid-cols-3 rounded-lg bg-muted p-0.5"
            >
              {mapModes.map((mode) => (
                <ToggleGroup.Item
                  key={mode}
                  value={mode}
                  aria-label={t(`mode.${mode}`)}
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                >
                  {tw(`modes.${mode}`)}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </div>
        )}
        <div className="flex flex-col gap-3 p-3">
          {data && toggle('values', tw('values'))}
          {data && toggle('planned', t('showPlanned'))}
          {data && toggle('boundaries', tw('boundaries'))}
          {toggle('cityMarkers', tw('cityMarkers'))}
        </div>
        <div className="flex flex-col gap-2 p-3">
          <p className="text-xs font-medium text-muted-foreground">{t('style.label')}</p>
          <BaseStyleSwitch
            value={prefs.baseStyle}
            onChange={(baseStyle) => onChange({ baseStyle })}
          />
          <p className="mt-1 text-xs font-medium text-muted-foreground">{t('projection.label')}</p>
          <Segmented
            label={t('projection.label')}
            options={projectionNames}
            value={prefs.projection}
            onChange={(projection) => onChange({ projection })}
            optionLabel={(projection) => t(`projection.${projection}`)}
          />
        </div>
        {data && (
          <div className="p-3">
            <MapLegend entries={legend} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
