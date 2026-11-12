/** Per-country import settings. Admin levels follow the OSM wiki table for each country. */
export interface CountryConfig {
  code: string;
  /** Used when the extract has no usable country boundary and it is built from the regions. */
  name: string;
  nameEn: string;
  /** OSM admin_level of first-level regions (states). Null for countries without regions. */
  region1Level: number | null;
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
  // Bundesländer, Bezirke, Gemeinden. Vienna is a state and a municipality at once.
  AT: {
    code: 'AT',
    name: 'Österreich',
    nameEn: 'Austria',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [8, 6, 4],
    languages: ['de'],
  },
  // Gewesten, provincies, gemeenten. Brussels has no province.
  BE: {
    code: 'BE',
    name: 'België / Belgique / Belgien',
    nameEn: 'Belgium',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [8],
    languages: ['nl', 'fr', 'de'],
  },
  // Kantone, Bezirke, Gemeinden.
  CH: {
    code: 'CH',
    name: 'Schweiz / Suisse / Svizzera / Svizra',
    nameEn: 'Switzerland',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [8],
    languages: ['de', 'fr', 'it', 'rm'],
  },
  // Kraje, okresy, obce. Prague is a region and a municipality at once.
  CZ: {
    code: 'CZ',
    name: 'Česko',
    nameEn: 'Czechia',
    region1Level: 4,
    region2Level: 5,
    municipalityLevels: [8, 4],
    languages: ['cs'],
  },
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
  // Régions, départements, communes. Metropolitan France only: the extract has no country
  // boundary, because the relation of France also covers the overseas territories.
  FR: {
    code: 'FR',
    name: 'France',
    nameEn: 'France',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [8],
    languages: ['fr'],
  },
  // Megyék (and Budapest), járások, települések.
  HU: {
    code: 'HU',
    name: 'Magyarország',
    nameEn: 'Hungary',
    region1Level: 6,
    region2Level: 7,
    municipalityLevels: [8],
    languages: ['hu'],
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
  // Gemeinden only. The two electoral districts are not regions.
  LI: {
    code: 'LI',
    name: 'Liechtenstein',
    nameEn: 'Liechtenstein',
    region1Level: null,
    region2Level: null,
    municipalityLevels: [8],
    languages: ['de'],
  },
  // Cantons, communes.
  LU: {
    code: 'LU',
    name: 'Lëtzebuerg',
    nameEn: 'Luxembourg',
    region1Level: 6,
    region2Level: null,
    municipalityLevels: [8],
    languages: ['lb', 'fr', 'de'],
  },
  // One commune that covers the whole country.
  MC: {
    code: 'MC',
    name: 'Monaco',
    nameEn: 'Monaco',
    region1Level: null,
    region2Level: null,
    municipalityLevels: [8],
    languages: ['fr'],
  },
  // Local councils only.
  MT: {
    code: 'MT',
    name: 'Malta',
    nameEn: 'Malta',
    region1Level: null,
    region2Level: null,
    municipalityLevels: [8],
    languages: ['mt', 'en'],
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
  // Kraje, okresy, obce. Bratislava and Košice are cities at level 5, made of boroughs.
  SK: {
    code: 'SK',
    name: 'Slovensko',
    nameEn: 'Slovakia',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [8, 5],
    languages: ['sk'],
  },
  // Län, kommuner. Most towns have no boundary of their own in OSM.
  SE: {
    code: 'SE',
    name: 'Sverige',
    nameEn: 'Sweden',
    region1Level: 4,
    region2Level: null,
    municipalityLevels: [7],
    // Most are "Malmö kommun" or "Stockholms kommun"; a few call themselves "Göteborgs Stad".
    municipalityNameEndings: ['s kommun', ' kommun', 's Stad', ' Stad', 's stad', ' stad'],
    languages: ['sv'],
  },
  // Województwa, powiaty, gminy. Settlements have their own boundaries at level 8.
  PL: {
    code: 'PL',
    name: 'Polska',
    nameEn: 'Poland',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [7],
    languages: ['pl'],
  },
  // Castelli. Imported from the Italy extract.
  SM: {
    code: 'SM',
    name: 'San Marino',
    nameEn: 'San Marino',
    region1Level: null,
    region2Level: null,
    municipalityLevels: [8],
    languages: ['it'],
  },
  // Oblasts, raions, hromadas. Kyiv and Sevastopol are regions without hromadas.
  UA: {
    code: 'UA',
    name: 'Україна',
    nameEn: 'Ukraine',
    region1Level: 4,
    region2Level: 6,
    municipalityLevels: [7, 4],
    languages: ['uk'],
  },
  // No subdivisions. Imported from the Italy extract.
  VA: {
    code: 'VA',
    name: 'Civitas Vaticana',
    nameEn: 'Vatican City',
    region1Level: null,
    region2Level: null,
    municipalityLevels: [],
    languages: ['it', 'la'],
  },
  // Seven parishes, which are both the regions and the municipalities.
  AD: {
    code: 'AD',
    name: 'Andorra',
    nameEn: 'Andorra',
    region1Level: 7,
    region2Level: null,
    municipalityLevels: [7],
    languages: ['ca'],
  },
  // Qarqe (counties) and bashki (municipalities).
  AL: {
    code: 'AL',
    name: 'Shqipëria',
    nameEn: 'Albania',
    region1Level: 6,
    region2Level: null,
    municipalityLevels: [7],
    languages: ['sq'],
  },
  // Districts and municipalities. The districts in the north have no ISO code and are not imported as regions.
  CY: {
    code: 'CY',
    name: 'Κύπρος',
    nameEn: 'Cyprus',
    region1Level: 5,
    region2Level: null,
    municipalityLevels: [6],
    languages: ['el', 'tr'],
  },
  // Maakonnad (counties) and vallad or linnad (municipalities).
  EE: {
    code: 'EE',
    name: 'Eesti',
    nameEn: 'Estonia',
    region1Level: 6,
    region2Level: null,
    municipalityLevels: [7],
    languages: ['et'],
  },
  // The sýslur have no ISO code, so there are no regions; kommunur are the municipalities.
  FO: {
    code: 'FO',
    name: 'Føroyar',
    nameEn: 'Faroe Islands',
    region1Level: null,
    region2Level: null,
    municipalityLevels: [7],
    languages: ['fo', 'da'],
  },
  // The sheadings have no ISO code, so there are no regions; parishes and towns are the municipalities.
  IM: {
    code: 'IM',
    name: 'Isle of Man',
    nameEn: 'Isle of Man',
    region1Level: null,
    region2Level: null,
    municipalityLevels: [8],
    languages: ['en', 'gv'],
  },
  // Regions and sveitarfélög (municipalities).
  IS: {
    code: 'IS',
    name: 'Ísland',
    nameEn: 'Iceland',
    region1Level: 5,
    region2Level: null,
    municipalityLevels: [6],
    languages: ['is'],
  },
  // Apskritys (counties) and savivaldybės (municipalities).
  LT: {
    code: 'LT',
    name: 'Lietuva',
    nameEn: 'Lithuania',
    region1Level: 4,
    region2Level: 5,
    municipalityLevels: [5],
    languages: ['lt'],
  },
  // Novadi and state cities, which are both the regions and the municipalities.
  LV: {
    code: 'LV',
    name: 'Latvija',
    nameEn: 'Latvia',
    region1Level: 5,
    region2Level: null,
    municipalityLevels: [5],
    languages: ['lv'],
  },
  // Raioane and municipii as regions, communes and towns as municipalities.
  MD: {
    code: 'MD',
    name: 'Moldova',
    nameEn: 'Moldova',
    region1Level: 4,
    region2Level: null,
    municipalityLevels: [8],
    languages: ['ro', 'ru'],
  },
  // Opštine, which are both the regions and the municipalities.
  ME: {
    code: 'ME',
    name: 'Crna Gora',
    nameEn: 'Montenegro',
    region1Level: 6,
    region2Level: null,
    municipalityLevels: [6],
    languages: ['sr'],
  },
  // Opštini, which are both the regions and the municipalities.
  MK: {
    code: 'MK',
    name: 'Северна Македонија',
    nameEn: 'North Macedonia',
    region1Level: 7,
    region2Level: null,
    municipalityLevels: [7],
    languages: ['mk', 'sq'],
  },
  // The districts have no ISO code, so there are no regions; komuna are the municipalities.
  XK: {
    code: 'XK',
    name: 'Kosova',
    nameEn: 'Kosovo',
    region1Level: null,
    region2Level: null,
    municipalityLevels: [6],
    languages: ['sq', 'sr'],
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
