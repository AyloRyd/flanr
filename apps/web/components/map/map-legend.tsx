import { useTranslations, type Messages } from 'next-intl';
import type { LegendEntry, MarkerStyle } from '@/lib/map/markers';
import { plannedStyle } from '@/lib/map/markers';

/** The keys of the legend entries are the message keys of their labels. */
type LegendKey = Exclude<keyof Messages['map']['legend'], 'title' | 'planned'>;

/** A marker as the map draws it, for the legend. */
function Swatch({ style, hollow = false }: { style: MarkerStyle; hollow?: boolean }) {
  const size = style.radius * 2;
  return (
    <span className="flex w-6 shrink-0 justify-center" aria-hidden>
      <span
        className="rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: hollow ? 'transparent' : style.color,
          boxShadow: `0 0 0 ${style.strokeWidth}px ${hollow ? style.color : 'var(--border)'}`,
        }}
      />
    </span>
  );
}

function RatingScale({ colors }: { colors: readonly string[] }) {
  return (
    <span className="flex shrink-0 flex-col gap-0.5" aria-hidden>
      <span className="flex">
        {colors.map((color) => (
          <span key={color} className="size-3" style={{ backgroundColor: color }} />
        ))}
      </span>
      <span className="flex justify-between text-[0.625rem] leading-none text-muted-foreground">
        <span>1</span>
        <span>10</span>
      </span>
    </span>
  );
}

interface MapLegendProps {
  entries: LegendEntry[];
  /** The number of planned cities when they are shown (FR-MAP-006), else null. */
  plannedCount: number | null;
}

/** What the markers of the current mode mean, with the number of cities of each (FR-MAP-005). */
export function MapLegend({ entries, plannedCount }: MapLegendProps) {
  const t = useTranslations('map.legend');

  return (
    <section aria-labelledby="map-legend" className="flex flex-col gap-2">
      <h2 id="map-legend" className="text-sm font-medium">
        {t('title')}
      </h2>
      <ul aria-labelledby="map-legend" className="flex flex-col gap-1.5 text-sm">
        {entries.map((entry) => (
          <li key={entry.key} className="flex items-center gap-2">
            {entry.scale ? <RatingScale colors={entry.scale} /> : <Swatch style={entry.style} />}
            <span className="flex-1">{t(entry.key as LegendKey)}</span>
            <span className="text-muted-foreground tabular-nums">{entry.count}</span>
          </li>
        ))}
        {plannedCount !== null && (
          <li className="flex items-center gap-2">
            <Swatch style={plannedStyle} hollow />
            <span className="flex-1">{t('planned')}</span>
            <span className="text-muted-foreground tabular-nums">{plannedCount}</span>
          </li>
        )}
      </ul>
    </section>
  );
}
