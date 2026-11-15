import { z } from 'zod';
import { settlementTypeSchema } from './city-search.ts';

export const capitalStatuses = ['national', 'regional', 'none'] as const;
export const capitalStatusSchema = z.enum(capitalStatuses);
export type CapitalStatus = z.infer<typeof capitalStatusSchema>;

/** A GeoJSON MultiPolygon in WGS 84: polygons of rings of [longitude, latitude] positions. */
export const multiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(z.array(z.array(z.number())))),
});

export type MultiPolygon = z.infer<typeof multiPolygonSchema>;

/** Everything the city page shows about a city (FR-CITY-001, FR-CITY-002). */
export const cityDetailsSchema = z.object({
  id: z.number().int(),
  /** The local name. */
  name: z.string(),
  /** The English name; the local name where there is none. */
  nameEn: z.string(),
  settlementType: settlementTypeSchema,
  capitalStatus: capitalStatusSchema,
  country: z.object({ code: z.string(), name: z.string() }),
  /** The first-level region. Null in countries without regions. */
  region: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  /** The municipality, when the city is a part of one and not the municipality itself (BR-017). */
  municipality: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  centre: z.object({ latitude: z.number(), longitude: z.number() }),
  /** Simplified for display. Null for a city that is mapped as a point only (OI-003). */
  boundary: multiPolygonSchema.nullable(),
  /** The OpenStreetMap object the city was imported from. */
  osm: z.object({ type: z.enum(['node', 'way', 'relation']), id: z.number().int() }),
  /** For a city that is its municipality, the population of the whole municipality (BR-017). */
  population: z.number().int().nullable(),
  populationYear: z.number().int().nullable(),
  areaKm2: z.number().nullable(),
  elevationM: z.number().int().nullable(),
  /** Year of founding or first mention. */
  founded: z.number().int().nullable(),
  wikipediaUrl: z.string().nullable(),
  website: z.string().nullable(),
});

export type CityDetails = z.infer<typeof cityDetailsSchema>;
