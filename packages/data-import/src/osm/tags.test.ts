import { describe, expect, it } from 'vitest';
import {
  capitalStatus,
  cityNames,
  englishName,
  parsePopulation,
  parsePopulationYear,
  settlementType,
  wikipediaUrl,
} from './tags.ts';

describe('settlementType (BR-001)', () => {
  it.each(['city', 'town', 'village', 'hamlet'])('accepts place=%s', (place) => {
    expect(settlementType({ place })).toBe(place);
  });

  it.each(['suburb', 'borough', 'quarter', 'neighbourhood', 'isolated_dwelling', 'locality'])(
    'rejects place=%s, which is not a city',
    (place) => {
      expect(settlementType({ place })).toBeNull();
    },
  );
});

describe('settlementType for capitals', () => {
  it('treats the capital of a country as a city even when it is tagged as a suburb', () => {
    // Vatican City in OSM.
    expect(settlementType({ place: 'suburb', capital: 'yes' })).toBe('city');
  });

  it('keeps the place type of a capital that has one', () => {
    expect(settlementType({ place: 'town', capital: 'yes' })).toBe('town');
  });

  it('does not treat a regional capital or an untyped object as a city', () => {
    expect(settlementType({ place: 'suburb', capital: '4' })).toBeNull();
    expect(settlementType({ capital: 'yes' })).toBeNull();
  });
});

describe('parsePopulation', () => {
  it.each([
    ['4662', 4662],
    ['1069200', 1069200],
    ['1.069.200', 1069200],
    ['1,069,200', 1069200],
    [' 350 ', 350],
  ])('parses %j', (value, expected) => {
    expect(parsePopulation(value)).toBe(expected);
  });

  it.each([undefined, '', 'ca. 300', '~500', '1.5', '12a', '99999999999'])(
    'rejects %j',
    (value) => {
      expect(parsePopulation(value)).toBeNull();
    },
  );
});

describe('parsePopulationYear', () => {
  it('reads population:date', () => {
    expect(parsePopulationYear({ 'population:date': '2023-12-31' })).toBe(2023);
  });

  it('falls back to a year in source:population', () => {
    expect(parsePopulationYear({ 'source:population': 'IT.NRW 2022' })).toBe(2022);
  });

  it('returns null without a year', () => {
    expect(parsePopulationYear({ 'source:population': 'census' })).toBeNull();
  });
});

describe('capitalStatus', () => {
  it.each([
    ['yes', 'national'],
    ['2', 'national'],
    ['4', 'regional'],
    ['6', 'none'],
  ])('maps capital=%s to %s', (capital, expected) => {
    expect(capitalStatus({ capital })).toBe(expected);
  });

  it('defaults to none', () => {
    expect(capitalStatus({})).toBe('none');
  });
});

describe('wikipediaUrl', () => {
  it('builds an encoded URL from lang:title', () => {
    expect(wikipediaUrl('de:Körbecke (Möhnesee)')).toBe(
      'https://de.wikipedia.org/wiki/K%C3%B6rbecke_(M%C3%B6hnesee)',
    );
  });

  it('returns null for a value without a language', () => {
    expect(wikipediaUrl('Köln')).toBeNull();
  });
});

describe('englishName', () => {
  it('prefers name:en and falls back to name', () => {
    expect(englishName({ name: 'Köln', 'name:en': 'Cologne' })).toBe('Cologne');
    expect(englishName({ name: 'Körbecke' })).toBe('Körbecke');
  });
});

describe('cityNames', () => {
  it('collects local, translated, alternative and old names', () => {
    const names = cityNames({
      name: 'Köln',
      'name:en': 'Cologne',
      'name:zh-Hans': '科隆',
      alt_name: 'Koeln;Kölle',
      old_name: 'Cöln',
      'name:prefix': 'Stadt',
      'name:etymology:wikidata': 'Q1',
      place: 'city',
    });

    expect(names).toEqual(
      expect.arrayContaining([
        { name: 'Köln', lang: null, kind: 'name' },
        { name: 'Cologne', lang: 'en', kind: 'name' },
        { name: '科隆', lang: 'zh-Hans', kind: 'name' },
        { name: 'Koeln', lang: null, kind: 'alt_name' },
        { name: 'Kölle', lang: null, kind: 'alt_name' },
        { name: 'Cöln', lang: null, kind: 'old_name' },
      ]),
    );
    expect(names).toHaveLength(6);
  });
});
