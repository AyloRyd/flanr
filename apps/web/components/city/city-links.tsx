import { cityMapLinks, type CityDetails } from '@flanr/shared';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** The map services that have a name in the messages; any other is shown by its ID. */
const namedServices = ['openstreetmap', 'google-maps', 'apple-maps'] as const;
type NamedService = (typeof namedServices)[number];
const isNamed = (id: string): id is NamedService =>
  (namedServices as readonly string[]).includes(id);

/** Wikipedia, the official website and the city in external map services (FR-CITY-009). */
export function CityLinks({ city }: { city: CityDetails }) {
  const t = useTranslations('city');
  const mapLinks = cityMapLinks({
    name: city.name,
    ...(city.region ? { region: city.region.name } : {}),
    country: city.country.name,
    latitude: city.centre.latitude,
    longitude: city.centre.longitude,
    osmType: city.osm.type,
    osmId: city.osm.id,
  });

  const links = [
    ...(city.wikipediaUrl
      ? [{ key: 'wikipedia', label: t('wikipedia'), url: city.wikipediaUrl }]
      : []),
    ...(city.website ? [{ key: 'website', label: t('website'), url: city.website }] : []),
    ...mapLinks.map((link) => ({
      key: link.serviceId,
      label: t('openIn', {
        service: isNamed(link.serviceId) ? t(`mapService.${link.serviceId}`) : link.serviceId,
      }),
      url: link.url,
    })),
  ];

  return (
    <section aria-labelledby="links" className="rounded-2xl border p-6">
      <h2 id="links" className="text-lg font-semibold">
        {t('links')}
      </h2>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.key}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
            >
              {link.label}
              <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
