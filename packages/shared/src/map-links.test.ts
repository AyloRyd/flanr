import { describe, expect, it } from 'vitest';
import { cityMapLinks, mapServices, type MapLinkCity } from './map-links.ts';

const cologne: MapLinkCity = {
  name: 'Köln',
  region: 'Nordrhein-Westfalen',
  country: 'Deutschland',
  latitude: 50.938361,
  longitude: 6.959974,
  osmType: 'node',
  osmId: 20953083,
};

function linkFor(serviceId: string, city: MapLinkCity = cologne) {
  return cityMapLinks(city).find((link) => link.serviceId === serviceId)?.url;
}

describe('cityMapLinks (FR-CITY-009)', () => {
  it('offers OpenStreetMap, Google Maps and Apple Maps', () => {
    expect(cityMapLinks(cologne).map((link) => link.serviceId)).toEqual([
      'openstreetmap',
      'google-maps',
      'apple-maps',
    ]);
  });

  it('links to the OpenStreetMap object the city was imported from', () => {
    expect(linkFor('openstreetmap')).toBe('https://www.openstreetmap.org/node/20953083');
  });

  it('searches Google Maps for the name with its region and country', () => {
    const url = new URL(linkFor('google-maps') ?? '');

    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('Köln, Nordrhein-Westfalen, Deutschland');
  });

  it('leaves out a missing region or country', () => {
    const withoutRegion: MapLinkCity = { ...cologne };
    delete withoutRegion.region;
    const url = new URL(linkFor('google-maps', withoutRegion) ?? '');

    expect(url.searchParams.get('query')).toBe('Köln, Deutschland');
  });

  it('opens Apple Maps at the coordinates with the name as the search', () => {
    const url = new URL(linkFor('apple-maps') ?? '');

    expect(url.origin + url.pathname).toBe('https://maps.apple.com/');
    expect(url.searchParams.get('q')).toBe('Köln');
    expect(url.searchParams.get('ll')).toBe('50.938361,6.959974');
  });

  it('builds links for an added service without changes to city data', () => {
    const services = [...mapServices, { id: 'example', buildUrl: () => 'https://example.org/' }];

    expect(cityMapLinks(cologne, services)).toContainEqual({
      serviceId: 'example',
      url: 'https://example.org/',
    });
  });
});
