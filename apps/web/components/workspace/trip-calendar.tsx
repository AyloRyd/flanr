'use client';

import type { TripCalendar } from '@flanr/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { calendarYears, yearGrid, type CalendarDay } from '@/lib/calendar-grid';
import { cn } from '@/lib/utils';

const levelColors = [
  'bg-muted',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-400 dark:bg-emerald-700',
  'bg-emerald-600 dark:bg-emerald-500',
  'bg-emerald-800 dark:bg-emerald-300',
] as const;

const cellSize = 'size-[11px] rounded-[2px]';
/** A cell and the gap after it, in pixels. */
const weekWidth = 14;

interface TripCalendarViewProps {
  calendar: TripCalendar;
  /** Names of the user's cities by ID. */
  names: Map<number, string>;
  onSelectCity: (cityId: number) => void;
}

/**
 * The trip calendar (FR-STAT-003, FR-STAT-004): the days of a year coloured by their visits, as
 * the GitHub contribution graph does, with the period it covers and the visits before it.
 */
export function TripCalendarView({ calendar, names, onSelectCity }: TripCalendarViewProps) {
  const t = useTranslations('workspace.calendar');
  const format = useFormatter();
  const years = calendarYears(calendar);
  const [year, setYear] = useState(years[0] ?? 0);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const grid = useMemo(() => yearGrid(calendar, year), [calendar, year]);
  const scroller = useRef<HTMLDivElement>(null);

  // The panel first shows the weeks up to the end of the period, today in the current year.
  const lastWeek = grid.weeks.findLastIndex((week) => week.some((day) => day?.inPeriod));
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    element.scrollTo({ left: Math.max(0, (lastWeek + 1) * weekWidth - element.clientWidth + 40) });
  }, [lastWeek]);

  const at = (value: string) => new Date(`${value}T00:00:00Z`);
  const date = (value: string) =>
    format.dateTime(at(value), { dateStyle: 'medium', timeZone: 'UTC' });
  const describe = (day: CalendarDay) =>
    t('dayLabel', {
      date: date(day.date),
      count: day.cityIds.length,
      cities: day.cityIds.map((id) => names.get(id) ?? '').join(', '),
    });

  if (calendar.from === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('notShown', { count: calendar.visitsBefore })}
      </p>
    );
  }

  const daysOfYear = grid.weeks.flat().filter((day) => day && day.cityIds.length > 0);
  const visitsOfYear = daysOfYear.reduce((sum, day) => sum + (day?.cityIds.length ?? 0), 0);

  return (
    <section aria-label={t('title')} className="flex flex-col gap-3 text-sm">
      <div role="group" aria-label={t('years')} className="flex flex-wrap gap-1">
        {years.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === year}
            onClick={() => {
              setYear(option);
              setSelectedDay(null);
            }}
            className={cn(
              'rounded-md px-2 py-0.5',
              option === year ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <p>{t('summary', { visits: visitsOfYear, days: daysOfYear.length, year })}</p>

      <div ref={scroller} className="overflow-x-auto pb-1">
        <div className="grid w-max grid-cols-[auto_1fr] gap-x-1.5 gap-y-1 text-[10px] text-muted-foreground">
          <span />
          <div className="relative h-3.5">
            {grid.monthStarts.map(({ month, week }) => (
              <span key={month} className="absolute" style={{ left: week * weekWidth }}>
                {format.dateTime(new Date(Date.UTC(year, month, 1)), {
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </span>
            ))}
          </div>
          <div className="grid grid-rows-7 gap-[3px]" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
              <span key={weekday} className="h-[11px] leading-[11px]">
                {weekday % 2 === 0 && weekday < 6
                  ? format.dateTime(at(`2024-01-0${weekday + 1}`), {
                      weekday: 'short',
                      timeZone: 'UTC',
                    })
                  : ''}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {grid.weeks.map((week, index) => (
              <div key={index} className="grid grid-rows-7 gap-[3px]">
                {week.map((day, weekday) => {
                  if (!day) return <span key={weekday} className={cellSize} />;
                  const color = day.inPeriod ? levelColors[day.level] : 'bg-muted/40';
                  if (day.cityIds.length === 0) {
                    return (
                      <span key={weekday} title={date(day.date)} className={cn(cellSize, color)} />
                    );
                  }
                  const label = describe(day);
                  return (
                    <button
                      key={weekday}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={selectedDay?.date === day.date}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        cellSize,
                        color,
                        'outline-offset-1 hover:outline hover:outline-foreground',
                        selectedDay?.date === day.date && 'outline outline-foreground',
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground"
        aria-hidden
      >
        {t('less')}
        {levelColors.map((color) => (
          <span key={color} className={cn(cellSize, color)} />
        ))}
        {t('more')}
      </div>

      {selectedDay && (
        <div className="rounded-lg border p-2">
          <p className="font-medium">
            {format.dateTime(at(selectedDay.date), { dateStyle: 'full', timeZone: 'UTC' })}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1" aria-label={t('citiesOfDay')}>
            {selectedDay.cityIds.map((cityId, index) => (
              <li key={`${cityId}-${index}`}>
                <button
                  type="button"
                  onClick={() => onSelectCity(cityId)}
                  className="rounded-full bg-secondary px-2 py-0.5 hover:bg-muted"
                >
                  {names.get(cityId) ?? cityId}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('period', { from: date(calendar.from) })}
        {calendar.visitsBefore > 0 && ` ${t('before', { count: calendar.visitsBefore })}`}
      </p>
    </section>
  );
}
