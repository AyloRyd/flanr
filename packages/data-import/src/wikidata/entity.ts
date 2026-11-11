/** The part of a Wikidata item that Flanr uses, ready to be stored. */
export interface WikidataCity {
  id: string;
  labelEn: string | null;
  aliases: Record<string, string[]>;
  population: number | null;
  populationYear: number | null;
  areaKm2: number | null;
  elevationM: number | null;
  website: string | null;
  founded: number | null;
  /** Wikipedia article URLs by site, for example enwiki. */
  wikipediaUrls: Record<string, string>;
}

// Shapes of the Wikidata JSON, limited to what is read here.
interface Snak {
  snaktype: string;
  datavalue?: { value: unknown };
}

interface Statement {
  mainsnak: Snak;
  rank: 'preferred' | 'normal' | 'deprecated';
  qualifiers?: Record<string, Snak[]>;
}

export interface WikidataEntityJson {
  id: string;
  missing?: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, Statement[]>;
  sitelinks?: Record<string, { title: string }>;
}

const property = {
  population: 'P1082',
  area: 'P2046',
  elevation: 'P2044',
  website: 'P856',
  inception: 'P571',
  pointInTime: 'P585',
} as const;

const unitPrefix = 'http://www.wikidata.org/entity/';
const squareKilometresPer: Record<string, number> = {
  Q712226: 1, // square kilometre
  Q35852: 0.01, // hectare
  Q25343: 0.000001, // square metre
  Q232291: 2.589988, // square mile
};
const metresPer: Record<string, number> = {
  Q11573: 1, // metre
  Q3710: 0.3048, // foot
};

// Wikidata time precision: 9 is a year, higher values are more exact.
const yearPrecision = 9;

export function parseWikidataCity(entity: WikidataEntityJson): WikidataCity {
  const population = latestPopulation(entity.claims?.[property.population]);
  return {
    id: entity.id,
    labelEn: entity.labels?.en?.value ?? null,
    aliases: Object.fromEntries(
      Object.entries(entity.aliases ?? {}).map(([lang, values]) => [
        lang,
        values.map((v) => v.value),
      ]),
    ),
    population: population?.value ?? null,
    populationYear: population?.year ?? null,
    areaKm2: firstQuantity(entity.claims?.[property.area], squareKilometresPer),
    elevationM: roundOrNull(firstQuantity(entity.claims?.[property.elevation], metresPer)),
    website: firstWebsite(entity.claims?.[property.website]),
    founded: firstYear(entity.claims?.[property.inception]),
    wikipediaUrls: Object.fromEntries(
      Object.entries(entity.sitelinks ?? {})
        .filter(([site]) => site.endsWith('wiki'))
        .map(([site, link]) => [site, articleUrl(site.slice(0, -'wiki'.length), link.title)]),
    ),
  };
}

function articleUrl(language: string, title: string): string {
  return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
}

/**
 * Statements that count as current: deprecated ones are dropped, and if any statement is marked
 * as preferred, only preferred ones are used. This is how Wikidata defines its "best" values.
 */
function bestStatements(statements: Statement[] | undefined): Statement[] {
  const usable = (statements ?? []).filter(
    (s) => s.rank !== 'deprecated' && s.mainsnak.snaktype === 'value',
  );
  const preferred = usable.filter((s) => s.rank === 'preferred');
  return preferred.length > 0 ? preferred : usable;
}

/** The most recent population figure. A figure without a date loses to any dated one. */
function latestPopulation(
  statements: Statement[] | undefined,
): { value: number; year: number | null } | null {
  const figures = bestStatements(statements)
    .map((statement) => ({
      value: quantityAmount(statement.mainsnak),
      year: timeYear(statement.qualifiers?.[property.pointInTime]?.[0]),
    }))
    .filter((figure): figure is { value: number; year: number | null } => isCount(figure.value));
  figures.sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity));
  return figures[0] ?? null;
}

function isCount(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
}

function firstQuantity(
  statements: Statement[] | undefined,
  factors: Record<string, number>,
): number | null {
  for (const statement of bestStatements(statements)) {
    const value = statement.mainsnak.datavalue?.value as { unit?: string } | undefined;
    const factor = factors[value?.unit?.replace(unitPrefix, '') ?? ''];
    const amount = quantityAmount(statement.mainsnak);
    if (factor !== undefined && amount !== null) return amount * factor;
  }
  return null;
}

function quantityAmount(snak: Snak): number | null {
  const amount = Number((snak.datavalue?.value as { amount?: string } | undefined)?.amount);
  return Number.isFinite(amount) ? amount : null;
}

function firstWebsite(statements: Statement[] | undefined): string | null {
  for (const statement of bestStatements(statements)) {
    const url = statement.mainsnak.datavalue?.value;
    if (typeof url === 'string' && /^https?:\/\//.test(url)) return url;
  }
  return null;
}

function firstYear(statements: Statement[] | undefined): number | null {
  for (const statement of bestStatements(statements)) {
    const year = timeYear(statement.mainsnak);
    if (year !== null) return year;
  }
  return null;
}

/** Year of a Wikidata time value such as "+1180-00-00T00:00:00Z", if it is exact to the year. */
function timeYear(snak: Snak | undefined): number | null {
  const value = snak?.datavalue?.value as { time?: string; precision?: number } | undefined;
  const match = value?.time?.match(/^([+-])(\d+)-/);
  if (!match || (value?.precision ?? 0) < yearPrecision) return null;
  const year = Number(match[2]) * (match[1] === '-' ? -1 : 1);
  return Math.abs(year) <= 32767 ? year : null;
}

function roundOrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}
