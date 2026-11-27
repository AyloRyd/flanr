import { House } from 'lucide-react';
import { useTranslations, type Messages } from 'next-intl';
import type { LegendEntry, MarkerStyle } from '@/lib/map/markers';
import { textColorOn } from '@/lib/map/markers';

/** The keys of the legend entries are the message keys of their labels. */
type LegendKey = Exclude<keyof Messages['map']['legend'], 'title'>;

/** A marker as the map draws it, at a smaller scale that keeps the order of the sizes. */
function Swatch({ style }: { style: MarkerStyle }) {
  const size = Math.round(style.radius * 1.2);
  return (
    <span className="grid size-6 shrink-0 place-items-center" aria-hidden>
      <span
        className="flex flex-none items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: style.color,
          boxShadow: `0 0 0 ${style.strokeWidth}px var(--border)`,
        }}
      >
        {style.symbol === 'house' && (
          <House className="size-3" strokeWidth={2.5} color={textColorOn(style.color)} />
        )}
      </span>
    </span>
  );
}

/** The rating colours from 1 to 10 as a bar across the legend, with its ends labelled. */
function RatingScale({ colors }: { colors: readonly string[] }) {
  return (
    <span className="flex flex-col gap-1" aria-hidden>
      <span className="grid grid-flow-col gap-0.5">
        {colors.map((color) => (
          <span
            key={color}
            className="h-2.5 first:rounded-l-full last:rounded-r-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
      <span
        className="grid text-[0.6875rem] leading-none text-muted-foreground tabular-nums"
        style={{ gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))` }}
      >
        <span className="text-center">1</span>
        <span className="text-center" style={{ gridColumn: colors.length }}>
          {colors.length}
        </span>
      </span>
    </span>
  );
}

interface MapLegendProps {
  entries: LegendEntry[];
}

/** What the markers of the current mode mean, with the number of cities of each (FR-MAP-005). */
export function MapLegend({ entries }: MapLegendProps) {
  const t = useTranslations('map.legend');

  return (
    <section aria-labelledby="map-legend" className="flex flex-col gap-2">
      <h2 id="map-legend" className="sr-only">
        {t('title')}
      </h2>
      <ul aria-labelledby="map-legend" className="flex flex-col gap-1.5 text-sm">
        {entries.map((entry) => (
          <li key={entry.key} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              {/* The rating's bar below stands for its colours. */}
              {!entry.scale && <Swatch style={entry.style} />}
              <span className="flex-1">{t(entry.key as LegendKey)}</span>
              <span className="text-muted-foreground tabular-nums">{entry.count}</span>
            </span>
            {entry.scale && <RatingScale colors={entry.scale} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
