/** Per-country import settings. Admin levels follow the OSM wiki table for each country. */
export interface CountryConfig {
  code: string;
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
  /** Local languages, used for alternative names and as a fallback for Wikipedia links. */
  languages: string[];
}

const countries: Record<string, CountryConfig> = {
  DE: {
    code: 'DE',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [8, 6, 4],
    languages: ['de'],
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
