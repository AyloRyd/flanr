import { describe, expect, it } from 'vitest';
import { citySearchQuerySchema, defaultMinRatings, planCitySearch } from './city-search.ts';

const plan = (request: Record<string, string>) =>
  planCitySearch(citySearchQuerySchema.parse(request));

describe('planCitySearch: sorting (FR-SRCH-003)', () => {
  it('sorts a name search by relevance', () => {
    expect(plan({ q: 'Köln' })).toMatchObject({ sort: 'relevance' });
  });

  it('sorts a list without a search text by population, largest first', () => {
    expect(plan({ country: 'de' })).toMatchObject({ sort: 'population', descending: true });
  });

  it('sorts by name from A to Z and the others from the top, unless asked otherwise', () => {
    expect(plan({ sort: 'name' })).toMatchObject({ descending: false });
    expect(plan({ sort: 'ratings' })).toMatchObject({ descending: true });
    expect(plan({ sort: 'name', order: 'desc' })).toMatchObject({ descending: true });
    expect(plan({ sort: 'population', order: 'asc' })).toMatchObject({ descending: false });
  });

  it('cannot sort by relevance without a search text', () => {
    expect(plan({ sort: 'relevance' })).toEqual({ problem: 'relevance_needs_query' });
  });

  it('lets a name search be sorted by something else', () => {
    expect(plan({ q: 'Frankfurt', sort: 'population' })).toMatchObject({
      query: 'Frankfurt',
      sort: 'population',
    });
  });
});

describe('planCitySearch: minimum number of ratings (FR-SRCH-003, OI-011)', () => {
  it(`is ${defaultMinRatings} when sorting by community rating`, () => {
    expect(plan({ sort: 'rating' })).toMatchObject({ minRatings: 10 });
  });

  it(`is ${defaultMinRatings} when filtering by a minimum community rating`, () => {
    expect(plan({ minRating: '8', sort: 'name' })).toMatchObject({ minRatings: 10, minRating: 8 });
  });

  it('is what the user sets, also below the default', () => {
    expect(plan({ sort: 'rating', minRatings: '1' })).toMatchObject({ minRatings: 1 });
    expect(plan({ sort: 'rating', minRatings: '0' })).toMatchObject({ minRatings: 0 });
    expect(plan({ sort: 'rating', minRatings: '100' })).toMatchObject({ minRatings: 100 });
  });

  it('is none for other sortings, unless the user sets one', () => {
    expect(plan({ sort: 'population' })).toMatchObject({ minRatings: 0 });
    expect(plan({ sort: 'ratings' })).toMatchObject({ minRatings: 0 });
    expect(plan({ q: 'Köln' })).toMatchObject({ minRatings: 0 });
    expect(plan({ sort: 'population', minRatings: '5' })).toMatchObject({ minRatings: 5 });
  });
});

describe('citySearchQuerySchema: filters (FR-SRCH-003)', () => {
  it('reads the country code in any letter case', () => {
    expect(plan({ country: 'de' })).toMatchObject({ country: 'DE' });
  });

  it('reads one settlement type or several', () => {
    expect(plan({ settlementType: 'city' })).toMatchObject({ settlementTypes: ['city'] });
    expect(plan({ settlementType: 'city,town' })).toMatchObject({
      settlementTypes: ['city', 'town'],
    });
  });

  it.each([
    { country: 'Germany' },
    { settlementType: 'suburb' },
    { settlementType: 'city,' },
    { populationMin: '-1' },
    { populationMin: 'many' },
    { minRating: '0' },
    { minRating: '11' },
    { minRatings: '-1' },
    { regionId: '0' },
    { sort: 'size' },
    { order: 'up' },
  ])('rejects %j', (request) => {
    expect(citySearchQuerySchema.safeParse(request).success).toBe(false);
  });

  it('rejects a population range that ends below its start', () => {
    expect(plan({ populationMin: '5000', populationMax: '1000' })).toEqual({
      problem: 'population_range',
    });
    expect(plan({ populationMin: '1000', populationMax: '1000' })).toMatchObject({
      populationMin: 1000,
      populationMax: 1000,
    });
  });

  it('allows no search text at all', () => {
    expect(citySearchQuerySchema.safeParse({}).success).toBe(true);
  });
});
