import { z } from 'zod';
import { plannedCitySchema } from './default-lists.ts';
import { listEntrySchema, listSchema } from './list.ts';
import { livedCitySchema } from './lived-city.ts';
import { cityRatingSchema } from './rating.ts';
import { currentUserSchema } from './user.ts';
import { visitSchema } from './visit.ts';

/** What tells a person, or another program, which city an ID in the export stands for. */
export const exportedCitySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  countryCode: z.string(),
  /** The OpenStreetMap object of the city, for example "node/240109189". */
  osm: z.string(),
  wikidataId: z.string().nullable(),
});

export type ExportedCity = z.infer<typeof exportedCitySchema>;

/** Everything Flanr stores about a user, in one JSON document (NFR-GDPR-003). */
export const dataExportSchema = z.object({
  exportedAt: z.string(),
  profile: currentUserSchema,
  visits: z.array(visitSchema),
  livedCities: z.array(livedCitySchema),
  plannedCities: z.array(plannedCitySchema),
  ratings: z.array(cityRatingSchema),
  lists: z.array(listSchema.extend({ entries: z.array(listEntrySchema) })),
  /** The cities that the IDs above refer to. */
  cities: z.array(exportedCitySchema),
});

export type DataExport = z.infer<typeof dataExportSchema>;
