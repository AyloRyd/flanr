/**
 * Links that open a city in external map services (FR-CITY-009). They are built from data every
 * city has, so nothing is stored per city: to add a service, add an entry to `mapServices`.
 */

export interface MapLinkCity {
  /** Name to search for, in the local language. */
  name: string;
  /** Region and country, to tell apart places with the same name. */
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
}

export interface MapService {
  id: string;
  buildUrl: (city: MapLinkCity) => string;
}

export interface MapLink {
  serviceId: string;
  url: string;
}

const coordinates = (city: MapLinkCity) =>
  `${city.latitude.toFixed(6)},${city.longitude.toFixed(6)}`;

const fullName = (city: MapLinkCity) =>
  [city.name, city.region, city.country].filter(Boolean).join(', ');

export const mapServices: MapService[] = [
  {
    // The exact object the city was imported from.
    id: 'openstreetmap',
    buildUrl: (city) => `https://www.openstreetmap.org/${city.osmType}/${city.osmId}`,
  },
  {
    // Google's documented search link. A name search opens the place card; coordinates alone
    // would only drop a pin.
    id: 'google-maps',
    buildUrl: (city) =>
      `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: fullName(city) })}`,
  },
  {
    // Apple's documented map link: search for the name around the city's coordinates.
    id: 'apple-maps',
    buildUrl: (city) =>
      `https://maps.apple.com/?${new URLSearchParams({ q: city.name, ll: coordinates(city) })}`,
  },
];

export function cityMapLinks(city: MapLinkCity, services: MapService[] = mapServices): MapLink[] {
  return services.map((service) => ({ serviceId: service.id, url: service.buildUrl(city) }));
}
