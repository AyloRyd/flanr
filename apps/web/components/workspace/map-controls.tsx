'use client';

import type { UserMap } from '@flanr/shared';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { BaseStyleSwitch } from '@/components/map/base-map';
import { MapLegend } from '@/components/map/map-legend';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
 * How the map shows things: the mode with its legend (FR-MAP-005), the planned cities
 * (FR-MAP-006), values inside markers, markers for all cities (FR-MAP-003) and the base style
 * (FR-MAP-001).
 */
export function MapControls({ data, prefs, onChange, className }: MapControlsProps) {
  const t = useTranslations('map');
  const tw = useTranslations('workspace');
  const [open, setOpen] = useState(true);
  const legend = useMemo(() => legendFor(prefs.mode, data?.visited ?? []), [prefs.mode, data]);

  const toggle = (key: 'planned' | 'values' | 'cityMarkers', label: string) => (
    <Label className="font-normal">
      <Checkbox
        checked={prefs[key]}
        onCheckedChange={(checked) => onChange({ [key]: checked === true })}
      />
      {label}
    </Label>
  );

  return (
    <section
      aria-label={tw('controls')}
      className={cn('w-64 rounded-xl border bg-background/95 shadow-md backdrop-blur', className)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
      >
        {tw('controls')}
        <ChevronDown
          aria-hidden
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="flex max-h-[50svh] flex-col gap-4 overflow-y-auto px-3 pb-3">
          {data && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm text-muted-foreground">{t('mode.label')}</legend>
              <RadioGroup
                value={prefs.mode}
                onValueChange={(mode) => onChange({ mode: mode as MapMode })}
              >
                {mapModes.map((mode) => (
                  <Label key={mode} className="font-normal">
                    <RadioGroupItem value={mode} />
                    {t(`mode.${mode}`)}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          )}
          <div className="flex flex-col gap-3">
            {data && toggle('values', tw('values'))}
            {data && toggle('planned', t('showPlanned'))}
            {toggle('cityMarkers', tw('cityMarkers'))}
          </div>
          <BaseStyleSwitch
            value={prefs.baseStyle}
            onChange={(baseStyle) => onChange({ baseStyle })}
            className="self-start"
          />
          {data && (
            <MapLegend entries={legend} plannedCount={prefs.planned ? data.planned.length : null} />
          )}
        </div>
      )}
    </section>
  );
}
