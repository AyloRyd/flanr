export type Tags = Record<string, string>;

export const settlementTypes = ['city', 'town', 'village', 'hamlet'] as const;
export type SettlementType = (typeof settlementTypes)[number];

export type CapitalStatus = 'national' | 'regional' | 'none';

export interface CityName {
  name: string;
  lang: string | null;
  kind: string;
}

/**
 * Settlement type from the OSM place tag. Anything else, such as suburb, borough or
 * neighbourhood, is not a city (BR-001).
 */
export function settlementType(tags: Tags): SettlementType | null {
  const place = tags.place;
  return settlementTypes.find((type) => type === place) ?? null;
}

/** Accepts plain integers and integers with thousands separators ("1.069.200", "1,069,200"). */
export function parsePopulation(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^(\d{1,3}([.,\s]\d{3})+|\d+)$/.test(trimmed)) return null;
  const population = Number(trimmed.replace(/[.,\s]/g, ''));
  return Number.isSafeInteger(population) && population <= 2_147_483_647 ? population : null;
}

/** Year the population refers to, from population:date or, failing that, a year in source:population. */
export function parsePopulationYear(tags: Tags): number | null {
  return findYear(tags['population:date']) ?? findYear(tags['source:population']);
}

function findYear(value: string | undefined): number | null {
  const match = value?.match(/\b(1[89]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

/** capital=yes or 2 marks a national capital, capital=4 the capital of a first-level region. */
export function capitalStatus(tags: Tags): CapitalStatus {
  if (tags.capital === 'yes' || tags.capital === '2') return 'national';
  if (tags.capital === '4') return 'regional';
  return 'none';
}

/** Turns an OSM wikipedia tag ("de:Köln") into a URL. */
export function wikipediaUrl(value: string | undefined): string | null {
  const match = value?.match(/^([a-z][a-z-]*):(.+)$/);
  if (!match) return null;
  const [, lang, title] = match as unknown as [string, string, string];
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.trim().replaceAll(' ', '_'))}`;
}

export function englishName(tags: Tags): string | null {
  return tags['name:en'] ?? tags.name ?? null;
}

const nameKinds = [
  'name',
  'alt_name',
  'old_name',
  'official_name',
  'short_name',
  'loc_name',
  'int_name',
];

/**
 * All names of a settlement for search: the local name, names in other languages,
 * alternative, historical, official and short names. Values separated by ";" are split.
 */
export function cityNames(tags: Tags): CityName[] {
  const names = new Map<string, CityName>();
  for (const [key, value] of Object.entries(tags)) {
    const parsed = parseNameKey(key);
    if (!parsed) continue;
    for (const part of value.split(';')) {
      const name = part.trim();
      if (!name) continue;
      const entry = { name, ...parsed };
      names.set(`${entry.kind}|${entry.lang ?? ''}|${name}`, entry);
    }
  }
  return [...names.values()];
}

function parseNameKey(key: string): { kind: string; lang: string | null } | null {
  const [kind, lang, ...rest] = key.split(':');
  if (!kind || !nameKinds.includes(kind) || rest.length > 0) return null;
  // Keys such as name:prefix or name:etymology are not names.
  if (lang !== undefined && !/^[a-z]{2,3}(-[A-Za-z]{2,8})?$/.test(lang)) return null;
  return { kind, lang: lang ?? null };
}
