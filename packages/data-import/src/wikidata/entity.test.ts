import { describe, expect, it } from 'vitest';
import { parseWikidataCity, type WikidataEntityJson } from './entity.ts';

const unit = (id: string) => `http://www.wikidata.org/entity/${id}`;

function quantity(amount: string, unitId = '1') {
  return {
    snaktype: 'value',
    datavalue: { value: { amount, unit: unitId === '1' ? '1' : unit(unitId) } },
  };
}

function time(value: string, precision = 11) {
  return { snaktype: 'value', datavalue: { value: { time: value, precision } } };
}

function population(
  amount: string,
  date?: string,
  rank: 'preferred' | 'normal' | 'deprecated' = 'normal',
) {
  return {
    mainsnak: quantity(amount),
    rank,
    ...(date ? { qualifiers: { P585: [time(date)] } } : {}),
  };
}

function entity(claims: WikidataEntityJson['claims'], rest: Partial<WikidataEntityJson> = {}) {
  return parseWikidataCity({ id: 'Q1', ...(claims ? { claims } : {}), ...rest });
}

describe('parseWikidataCity', () => {
  it('reads labels, aliases and Wikipedia links', () => {
    const city = parseWikidataCity({
      id: 'Q365',
      labels: { en: { value: 'Cologne' }, de: { value: 'Köln' } },
      aliases: { en: [{ value: 'Koeln' }], de: [{ value: 'Cöln' }, { value: 'Kölle' }] },
      sitelinks: { enwiki: { title: 'Cologne' }, dewiki: { title: 'Körbecke (Möhnesee)' } },
    });

    expect(city).toMatchObject({
      id: 'Q365',
      labelEn: 'Cologne',
      aliases: { en: ['Koeln'], de: ['Cöln', 'Kölle'] },
      wikipediaUrls: {
        enwiki: 'https://en.wikipedia.org/wiki/Cologne',
        dewiki: 'https://de.wikipedia.org/wiki/K%C3%B6rbecke_(M%C3%B6hnesee)',
      },
    });
  });

  it('returns nulls for an item without statements', () => {
    expect(entity(undefined)).toMatchObject({
      labelEn: null,
      population: null,
      populationYear: null,
      areaKm2: null,
      elevationM: null,
      website: null,
      founded: null,
    });
  });

  describe('population', () => {
    it('takes the most recent figure with its year', () => {
      const city = entity({
        P1082: [
          population('+1000', '+2011-05-09T00:00:00Z'),
          population('+1200', '+2023-12-31T00:00:00Z'),
          population('+1100', '+2019-12-31T00:00:00Z'),
        ],
      });

      expect(city).toMatchObject({ population: 1200, populationYear: 2023 });
    });

    it('uses a preferred figure even when a newer normal one exists', () => {
      const city = entity({
        P1082: [
          population('+1000', '+2011-05-09T00:00:00Z', 'preferred'),
          population('+1200', '+2023-12-31T00:00:00Z'),
        ],
      });

      expect(city).toMatchObject({ population: 1000, populationYear: 2011 });
    });

    it('ignores deprecated figures', () => {
      const city = entity({
        P1082: [population('+9999', '+2024-01-01T00:00:00Z', 'deprecated'), population('+500')],
      });

      expect(city).toMatchObject({ population: 500, populationYear: null });
    });

    it('prefers a dated figure over an undated one', () => {
      const city = entity({
        P1082: [population('+700'), population('+650', '+2005-01-01T00:00:00Z')],
      });

      expect(city).toMatchObject({ population: 650, populationYear: 2005 });
    });
  });

  it.each([
    ['Q712226', '+15.02', 15.02],
    ['Q35852', '+1502', 15.02],
    ['Q25343', '+15020000', 15.02],
  ])('converts an area in unit %s to square kilometres', (unitId, amount, expected) => {
    const city = entity({ P2046: [{ mainsnak: quantity(amount, unitId), rank: 'normal' }] });

    expect(city.areaKm2).toBeCloseTo(expected, 5);
  });

  it('ignores an area in an unknown unit', () => {
    const city = entity({ P2046: [{ mainsnak: quantity('+5', 'Q999999'), rank: 'normal' }] });

    expect(city.areaKm2).toBeNull();
  });

  it('converts elevation to whole metres', () => {
    expect(
      entity({ P2044: [{ mainsnak: quantity('+234', 'Q11573'), rank: 'normal' }] }).elevationM,
    ).toBe(234);
    expect(
      entity({ P2044: [{ mainsnak: quantity('+1000', 'Q3710'), rank: 'normal' }] }).elevationM,
    ).toBe(305);
  });

  it('reads the website only if it is an http(s) URL', () => {
    const website = (url: string) =>
      entity({
        P856: [{ mainsnak: { snaktype: 'value', datavalue: { value: url } }, rank: 'normal' }],
      }).website;

    expect(website('https://www.stadt-koeln.de/')).toBe('https://www.stadt-koeln.de/');
    expect(website('javascript:alert(1)')).toBeNull();
  });

  it('reads the founding year when it is exact to the year', () => {
    const founded = (value: string, precision: number) =>
      entity({ P571: [{ mainsnak: time(value, precision), rank: 'normal' }] }).founded;

    expect(founded('+1180-00-00T00:00:00Z', 9)).toBe(1180);
    expect(founded('-0038-00-00T00:00:00Z', 9)).toBe(-38);
    // Precision 7 is a century: too vague to show as a year.
    expect(founded('+1200-00-00T00:00:00Z', 7)).toBeNull();
  });
});
