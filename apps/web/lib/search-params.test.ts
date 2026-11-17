import { describe, expect, it } from 'vitest';
import {
  hasCityFilters,
  readCitySearchFields,
  toCitySearchQuery,
  toListSearchQuery,
  withCursor,
} from './search-params.ts';

describe('city search from the URL (FR-SRCH-001…003)', () => {
  it('drops the empty fields a GET form sends and joins the settlement types', () => {
    const fields = readCitySearchFields({
      q: ' Köln ',
      country: 'de',
      populationMin: '',
      settlementType: ['city', 'town'],
    });
    expect(toCitySearchQuery(fields)).toEqual({
      query: expect.objectContaining({ q: 'Köln', country: 'DE', settlementType: 'city,town' }),
    });
    expect(toCitySearchQuery(fields).query).not.toHaveProperty('populationMin');
  });

  it('refuses a value the API would refuse', () => {
    expect(toCitySearchQuery(readCitySearchFields({ populationMin: 'many' }))).toEqual({
      problem: 'invalid',
    });
    expect(toCitySearchQuery(readCitySearchFields({ settlementType: 'suburb' }))).toEqual({
      problem: 'invalid',
    });
  });

  it('applies the rules of the API: a population range must not be reversed', () => {
    const fields = readCitySearchFields({ populationMin: '5000', populationMax: '100' });
    expect(toCitySearchQuery(fields)).toEqual({ problem: 'population_range' });
  });

  it('opens the filters only when one is set', () => {
    expect(hasCityFilters(readCitySearchFields({ q: 'Bonn', cursor: 'x' }))).toBe(false);
    expect(hasCityFilters(readCitySearchFields({ q: 'Bonn', sort: 'name' }))).toBe(true);
    expect(hasCityFilters(readCitySearchFields({ settlementType: 'town' }))).toBe(true);
  });
});

describe('list search from the URL (FR-SRCH-004)', () => {
  it('needs a search text with a letter or digit', () => {
    expect(toListSearchQuery({})).toBeNull();
    expect(toListSearchQuery({ q: ' -- ' })).toBeNull();
    expect(toListSearchQuery({ q: 'half-timbered' })).toMatchObject({ q: 'half-timbered' });
  });
});

describe('withCursor', () => {
  it('keeps the search and replaces the cursor', () => {
    expect(
      withCursor(
        '/search',
        { q: 'a b', settlementType: ['city', 'town'], cursor: 'old', sort: '' },
        'new',
      ),
    ).toBe('/search?q=a+b&settlementType=city&settlementType=town&cursor=new');
  });
});
