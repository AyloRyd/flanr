/** Per-country import settings. Admin levels follow the OSM wiki table for each country. */
export interface CountryConfig {
  code: string;
  /** Used when the extract has no usable country boundary and it is built from the regions. */
  name: string;
  nameEn: string;
  /** OSM admin_level of first-level regions (states). */
  region1Level: number;
  /** OSM admin_level of second-level regions (districts), if any. */
  region2Level: number | null;
  /**
   * OSM admin levels that can be a municipality, most specific first. A boundary of a less
   * specific level counts only if it contains no boundary of a more specific one: in Germany a
   * district-free city (level 6) or a city-state (level 4) is its own municipality.
   */
  municipalityLevels: number[];
  /**
   * Endings that a municipality's name has on top of its main settlement's name, longest first.
   * "Københavns Kommune" is the municipality of København, so the endings are "s Kommune" and
   * " Kommune". Used to recognise a settlement as its municipality when their names differ only
   * by such an ending.
   */
  municipalityNameEndings?: string[];
  /** Local languages, used for alternative names and as a fallback for Wikipedia links. */
  languages: string[];
}

const countries: Record<string, CountryConfig> = {
  // Länder, Kreise, Gemeinden. District-free cities and city-states have no Gemeinde level.
  DE: {
    code: 'DE',
    name: 'Deutschland',
    nameEn: 'Germany',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [8, 6, 4],
    languages: ['de'],
  },
  // Regioner, kommuner. Towns have no boundary of their own in OSM.
  DK: {
    code: 'DK',
    name: 'Danmark',
    nameEn: 'Denmark',
    region1Level: 4,
    region2Level: null,
    municipalityLevels: [7],
    municipalityNameEndings: ['s Kommune', ' Kommune'],
    languages: ['da'],
  },
  // Regioni, province and metropolitan cities, comuni.
  IT: {
    code: 'IT',
    name: 'Italia',
    nameEn: 'Italy',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [8],
    languages: ['it'],
  },
  // Provincies, gemeenten. Settlements (woonplaatsen) have their own boundaries at level 10.
  NL: {
    code: 'NL',
    name: 'Nederland',
    nameEn: 'Netherlands',
    region1Level: 4,
    region2Level: null,
    municipalityLevels: [8],
    languages: ['nl'],
  },
};

export function countryConfig(code: string): CountryConfig {
  const config = countries[code.toUpperCase()];
  if (!config) {
    throw new Error(
      `No import settings for country ${code}. Known: ${Object.keys(countries).join(', ')}`,
    );
  }
  return config;
}
