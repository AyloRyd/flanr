import { ratingColor, ratingScaleColors, type MapCity, type VisitedMapCity } from '@flanr/shared';

/** The three modes of a user's map (FR-MAP-005). */
export const mapModes = ['visits', 'rating', 'population'] as const;
export type MapMode = (typeof mapModes)[number];

/**
 * How a marker looks. The radius is in pixels at a middle zoom; the map scales it with zoom. It
 * is the same with and without the value inside, which it is large enough to hold.
 */
export interface MarkerStyle {
  color: string;
  radius: number;
  strokeWidth: number;
  /** A sign inside the marker in place of the value: a house for a lived-in city (BR-016). */
  symbol?: 'house';
}

/**
 * A group of cities that look the same on the map, as the legend lists it. `rank` orders the
 * groups: a higher rank is drawn above a lower one and listed first.
 */
export interface MarkerClass {
  key: string;
  rank: number;
  style: MarkerStyle;
}

/** For cities without a rating or a known population; explained in the legend. */
export const neutralColor = '#9ca3af';

const stroke = 1.5;

/**
 * Visits mode: size and colour grow with the number of visits, in one hue from light to dark.
 * A lived-in city has a marker of its own above any number of visits, with a house (BR-016).
 */
const visitClasses = [
  { key: 'visits1', min: 1, style: { color: '#60a5fa', radius: 10, strokeWidth: stroke } },
  { key: 'visits2', min: 2, style: { color: '#2563eb', radius: 12.5, strokeWidth: stroke } },
  { key: 'visits5', min: 5, style: { color: '#1e40af', radius: 15, strokeWidth: stroke } },
  { key: 'visits10', min: 10, style: { color: '#172554', radius: 17.5, strokeWidth: stroke } },
].map((entry, index) => ({ ...entry, rank: index + 1 }));

const livedClass: MarkerClass = {
  key: 'lived',
  rank: visitClasses.length + 1,
  style: { color: '#e11d48', radius: 18, strokeWidth: stroke, symbol: 'house' },
};

/**
 * Population mode: size grows with the population, and the colour goes from near white for the
 * smallest places through yellow and orange to a dark red for the largest.
 */
const populationClasses = [
  { key: 'population0', min: 0, style: { color: '#f7f3ea', radius: 8, strokeWidth: stroke } },
  {
    key: 'population5k',
    min: 5_000,
    style: { color: '#f4cf3f', radius: 10, strokeWidth: stroke },
  },
  {
    key: 'population10k',
    min: 10_000,
    style: { color: '#f9951f', radius: 12.5, strokeWidth: stroke },
  },
  {
    key: 'population100k',
    min: 100_000,
    style: { color: '#e9493a', radius: 15, strokeWidth: stroke },
  },
  {
    key: 'population1m',
    min: 1_000_000,
    style: { color: '#a44257', radius: 18, strokeWidth: stroke },
  },
].map((entry, index) => ({ ...entry, rank: index + 1 }));

const unknownPopulationClass: MarkerClass = {
  key: 'populationUnknown',
  rank: 0,
  style: { color: neutralColor, radius: 8, strokeWidth: stroke },
};

/** Rating mode: one size, the colour of the rating scale (SRS appendix C). */
const ratedRadius = 13;
const unratedClass: MarkerClass = {
  key: 'unrated',
  rank: 0,
  style: { color: neutralColor, radius: 10, strokeWidth: stroke },
};

/** The group of the highest class whose lower bound the value reaches. */
function classFor<C extends { min: number }>(classes: C[], value: number): C | undefined {
  return classes.findLast((entry) => value >= entry.min);
}

export function visitsClass(city: VisitedMapCity): MarkerClass {
  if (city.livedIn) return livedClass;
  return classFor(visitClasses, city.visitCount) ?? (visitClasses[0] as MarkerClass);
}

export function populationClass(city: MapCity): MarkerClass {
  if (city.population === null) return unknownPopulationClass;
  return classFor(populationClasses, city.population) ?? unknownPopulationClass;
}

/**
 * Ratings form one class per value on the scale, so that the legend can count them, and a
 * better rating is drawn above a worse one.
 */
export function ratingClass(city: VisitedMapCity): MarkerClass {
  if (city.rating === null) return unratedClass;
  return {
    key: `rating${city.rating}`,
    rank: city.rating * 2,
    style: { color: ratingColor(city.rating), radius: ratedRadius, strokeWidth: stroke },
  };
}

export function markerClass(mode: MapMode, city: VisitedMapCity): MarkerClass {
  if (mode === 'visits') return visitsClass(city);
  if (mode === 'rating') return ratingClass(city);
  return populationClass(city);
}

/** One line of a legend, with the number of the user's cities it stands for. */
export interface LegendEntry {
  key: string;
  style: MarkerStyle;
  count: number;
  /** Instead of one marker: the colours of the whole ratings 1 to 10 (SRS appendix C). */
  scale?: readonly string[];
}

/**
 * The legend of a mode (FR-MAP-005). It lists every class of the mode, also those that no city
 * of the user is in, so that the legend explains the scale and not only the data.
 */
export function legendFor(mode: MapMode, cities: VisitedMapCity[]): LegendEntry[] {
  const counts = new Map<string, number>();
  for (const city of cities) {
    const key = markerClass(mode, city).key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entry = (item: MarkerClass): LegendEntry => ({
    key: item.key,
    style: item.style,
    count: counts.get(item.key) ?? 0,
  });

  if (mode === 'rating') {
    const rated = cities.filter((city) => city.rating !== null).length;
    const ratedStyle = { color: ratingColor(10), radius: ratedRadius, strokeWidth: stroke };
    return [
      { key: 'rated', style: ratedStyle, count: rated, scale: ratingScaleColors },
      entry(unratedClass),
    ];
  }
  const classes =
    mode === 'visits'
      ? [livedClass, ...visitClasses.toReversed()]
      : [...populationClasses.toReversed(), unknownPopulationClass];
  return classes.map(entry);
}

/** Planned cities have a hollow marker, apart from the visited ones (FR-MAP-006). */
export const plannedStyle = { color: '#7c3aed', radius: 9, strokeWidth: 2.5 } as const;

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumSignificantDigits: 2,
});

/**
 * The value of the mode for the inside of a city's marker (FR-MAP-005): the number of visits,
 * the rating or the population. Empty when the city has none.
 */
export function markerValue(mode: MapMode, city: VisitedMapCity): string {
  if (mode === 'visits') return city.visitCount > 0 ? String(city.visitCount) : '';
  if (mode === 'rating') return city.rating === null ? '' : String(city.rating);
  return city.population === null ? '' : compactNumber.format(city.population);
}

/** Dark text on light markers, white on dark ones, by the colour's relative luminance. */
export function textColorOn(color: string): string {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(color.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111827' : '#ffffff';
}

/**
 * What a marker shows inside: the value of the mode, a sign or nothing. Markers that look the
 * same share one image on the map.
 */
export interface MarkerImage extends MarkerStyle {
  value: string;
}

/** The name of a marker's image on the map, which tells every image apart. */
export function markerImageId({ color, radius, strokeWidth, symbol, value }: MarkerImage): string {
  return ['flanr-marker', color, radius, strokeWidth, symbol ?? '', value].join('|');
}
