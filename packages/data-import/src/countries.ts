/** Per-country import settings. Admin levels follow the OSM wiki table for each country. */
export interface CountryConfig {
  code: string;
  /** OSM admin_level of first-level regions (states). */
  region1Level: number;
  /** OSM admin_level of second-level regions (districts), if any. */
  region2Level: number | null;
}

const countries: Record<string, CountryConfig> = {
  DE: { code: 'DE', region1Level: 4, region2Level: 6 },
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
