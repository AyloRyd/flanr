import { ratingColor, type VisitedMapCity } from '@flanr/shared';
import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json' with { type: 'json' };
import { boundaryZoom, boundsOf, ownMapData, plannedLayer, visitedLayer } from './layers.ts';
import {
  legendFor,
  mapModes,
  markerClass,
  markerValue,
  neutralColor,
  populationClass,
  plannedStyle,
  textColorOn,
} from './markers.ts';
import { mapViewQuery, readMapView } from './view-state.ts';

const city = (cityId: number, own: Partial<VisitedMapCity> = {}): VisitedMapCity => ({
  cityId,
  name: `City ${cityId}`,
  countryCode: 'DE',
  longitude: 7,
  latitude: 51,
  settlementType: 'city',
  population: null,
  visitCount: 1,
  livedIn: false,
  rating: null,
  ...own,
});

describe('visits mode (FR-MAP-005)', () => {
  it('draws a city visited ten times larger and in another colour than one visited once', () => {
    const once = markerClass('visits', city(1, { visitCount: 1 }));
    const tenTimes = markerClass('visits', city(2, { visitCount: 10 }));

    expect(tenTimes.style.radius).toBeGreaterThan(once.style.radius);
    expect(tenTimes.style.color).not.toBe(once.style.color);
  });

  it('never makes a marker smaller for more visits', () => {
    const radii = [1, 2, 4, 5, 9, 10, 50].map(
      (visitCount) => markerClass('visits', city(1, { visitCount })).style.radius,
    );

    expect(radii).toEqual(radii.toSorted((a, b) => a - b));
  });

  it('gives a lived-in city a marker of its own above any number of visits (BR-016)', () => {
    const lived = markerClass('visits', city(1, { livedIn: true, visitCount: 0 }));
    const livedAndVisited = markerClass('visits', city(2, { livedIn: true, visitCount: 3 }));
    const often = markerClass('visits', city(3, { visitCount: 100 }));

    expect(livedAndVisited).toEqual(lived);
    expect(lived.key).toBe('lived');
    expect(lived.rank).toBeGreaterThan(often.rank);
    expect(lived.style.radius).toBeGreaterThan(often.style.radius);
    expect(lived.style.color).not.toBe(often.style.color);
    expect(lived.style.symbol).toBe('house');
  });

  it('explains lived-in cities in the legend and counts the cities of each class', () => {
    const legend = legendFor('visits', [
      city(1, { visitCount: 1 }),
      city(2, { visitCount: 1 }),
      city(3, { visitCount: 12 }),
      city(4, { livedIn: true, visitCount: 0 }),
    ]);

    expect(legend.map(({ key, count }) => [key, count])).toEqual([
      ['lived', 1],
      ['visits10', 1],
      ['visits5', 0],
      ['visits2', 0],
      ['visits1', 2],
    ]);
  });
});

describe('rating mode (FR-MAP-005)', () => {
  it('colours a rated city with the rating scale of appendix C', () => {
    expect(markerClass('rating', city(1, { rating: 7.5 })).style.color).toBe(ratingColor(7.5));
  });

  it('shows unrated cities in a neutral colour that the legend explains', () => {
    const unrated = markerClass('rating', city(1));
    const legend = legendFor('rating', [city(1), city(2, { rating: 8 })]);

    expect(unrated.style.color).toBe(neutralColor);
    expect(legend).toEqual([
      expect.objectContaining({ key: 'rated', count: 1, scale: expect.any(Array) }),
      expect.objectContaining({ key: 'unrated', count: 1, style: unrated.style }),
    ]);
  });

  it('draws better ratings above worse ones and unrated cities below all', () => {
    const ranks = [null, 1, 5.5, 10].map(
      (rating) => markerClass('rating', city(1, { rating })).rank,
    );

    expect(ranks).toEqual(ranks.toSorted((a, b) => a - b));
  });
});

describe('population mode (FR-MAP-005)', () => {
  it('grows marker size with the population and shows an unknown one in a neutral colour', () => {
    const [unknown, small, large] = [null, 5_000, 2_000_000].map((population) =>
      markerClass('population', city(1, { population })),
    );

    expect(unknown?.style.color).toBe(neutralColor);
    expect(large?.style.radius).toBeGreaterThan(small?.style.radius ?? Infinity);
    expect(large?.style.color).not.toBe(small?.style.color);
  });

  it('counts the cities of each population class in the legend', () => {
    const legend = legendFor('population', [
      city(1, { population: 1_000_000 }),
      city(2, { population: 99_999 }),
      city(3),
    ]);

    expect(legend.map(({ key, count }) => [key, count])).toEqual([
      ['population1m', 1],
      ['population100k', 0],
      ['population10k', 1],
      ['population5k', 0],
      ['population0', 0],
      ['populationUnknown', 1],
    ]);
  });

  it('shows places under 5,000 people near white and the next class in colour', () => {
    const [tiny, small] = [4_999, 5_000].map((population) =>
      populationClass(city(1, { population })),
    );

    expect(tiny?.key).toBe('population0');
    expect(small?.key).toBe('population5k');
    expect(textColorOn(tiny?.style.color ?? '')).toBe('#111827');
  });
});

describe('map layers', () => {
  const map = {
    visited: [
      city(1, { visitCount: 2, rating: 8, longitude: 6.95, latitude: 50.94 }),
      city(2, { visitCount: 0, livedIn: true }),
    ],
    planned: [
      {
        cityId: 3,
        name: 'Berlin',
        countryCode: 'DE',
        longitude: 13.4,
        latitude: 52.5,
        settlementType: 'city' as const,
        population: null,
      },
    ],
  };

  it('carries the Flanr ID and the style of the mode on every marker (FR-MAP-003)', () => {
    const layer = visitedLayer('rating', map.visited);

    expect(layer.features[0]).toEqual({
      type: 'Feature',
      id: 1,
      geometry: { type: 'Point', coordinates: [6.95, 50.94] },
      properties: expect.objectContaining({
        cityId: 1,
        color: ratingColor(8),
        settlementType: 'city',
      }),
    });
  });

  it('draws planned cities in a style of their own (FR-MAP-006)', () => {
    const [planned] = plannedLayer(map.planned).features;

    expect(planned?.properties).toMatchObject(plannedStyle);
  });

  it('gives the preview the user’s own data of a city (FR-MAP-004)', () => {
    expect(ownMapData(map, 1)).toEqual({
      kind: 'visited',
      visitCount: 2,
      livedIn: false,
      rating: 8,
    });
    expect(ownMapData(map, 3)).toEqual({ kind: 'planned' });
    expect(ownMapData(map, 4)).toEqual({ kind: 'none' });
  });

  it('zooms in to where the tiles have the boundary of the selected city', () => {
    expect(boundaryZoom('city')).toBe(9);
    expect(boundaryZoom('village')).toBe(11);
    expect(boundaryZoom('hamlet')).toBe(12);
  });

  it('finds the box around the cities', () => {
    expect(
      boundsOf([
        [6.95, 50.94],
        [13.4, 52.5],
        [7, 51],
      ]),
    ).toEqual([
      [6.95, 50.94],
      [13.4, 52.5],
    ]);
    expect(boundsOf([])).toBeNull();
  });
});

describe('map view in the URL', () => {
  it('reads the mode, the planned cities and the selected city', () => {
    expect(readMapView({ mode: 'rating', planned: '1', city: '42' })).toEqual({
      mode: 'rating',
      planned: true,
      cityId: 42,
    });
  });

  it('falls back to the defaults for values it does not understand', () => {
    expect(readMapView({ mode: 'heat', planned: 'yes', city: '-3' })).toEqual({
      mode: 'visits',
      planned: false,
      cityId: null,
    });
  });

  it('writes only what differs from the default', () => {
    expect(mapViewQuery({ mode: 'visits', planned: false, cityId: null })).toBe('');
    expect(mapViewQuery({ mode: 'population', planned: true, cityId: 7 })).toBe(
      '?mode=population&planned=1&city=7',
    );
  });
});

describe('legend', () => {
  it('has a label for every entry of every mode', () => {
    const keys = mapModes.flatMap((mode) => legendFor(mode, []).map((entry) => entry.key));

    expect(Object.keys(en.map.legend)).toEqual(expect.arrayContaining(keys));
  });
});

describe('values inside the markers (FR-MAP-005)', () => {
  it('shows the rating, the number of visits or the population of the mode', () => {
    const rated = city(1, { rating: 7.5, visitCount: 3, population: 355_100 });

    expect(markerValue('rating', rated)).toBe('7.5');
    expect(markerValue('visits', rated)).toBe('3');
    expect(markerValue('population', rated)).toBe('360K');
    expect(markerValue('rating', city(2))).toBe('');
  });

  it('puts the value into every marker and keeps their order of size', () => {
    const cities = [city(1, { population: 5_000 }), city(2, { population: 2_000_000 })];

    const [small, large] = visitedLayer('population', cities, { values: true }).features;

    expect(large?.properties.value).toBe('2M');
    expect(large?.properties.radius).toBeGreaterThan(small?.properties.radius ?? Infinity);
    expect(large?.properties.sortKey).toBeGreaterThan(small?.properties.sortKey ?? Infinity);
  });

  it('keeps the size of the markers without values and gives them another image', () => {
    const cities = [city(1, { population: 2_000_000 })];

    const [plain] = visitedLayer('population', cities).features;
    const [withValue] = visitedLayer('population', cities, { values: true }).features;

    expect(plain?.properties.value).toBe('');
    expect(plain?.properties.radius).toBe(withValue?.properties.radius);
    expect(plain?.properties.image).not.toBe(withValue?.properties.image);
  });

  it('shows the house of a lived-in city in place of its number of visits (BR-016)', () => {
    const cities = [city(1, { livedIn: true, visitCount: 4 })];

    const [lived] = visitedLayer('visits', cities, { values: true }).features;

    expect(lived?.properties.symbol).toBe('house');
    expect(lived?.properties.value).toBe('');
  });

  it('writes dark on light markers and white on dark ones', () => {
    expect(textColorOn('#f4cf3f')).toBe('#111827');
    expect(textColorOn('#172554')).toBe('#ffffff');
  });
});
