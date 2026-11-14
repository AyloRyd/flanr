import { z } from 'zod';
import { paginated, paginationQuerySchema } from './pagination.ts';
import { visibilitySchema } from './user.ts';

export const maxListTitleLength = 100;
export const maxListDescriptionLength = 2000;
export const maxListNoteLength = 500;

/** A list is public unless its owner makes it private (FR-LIST-005). */
export const listVisibilitySchema = visibilitySchema;

const titleSchema = z.string().trim().min(1).max(maxListTitleLength);

/** Optional text: empty or blank text is stored as no text. */
const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .transform((text) => text || null);

/** A custom list (FR-LIST-003). */
export const listSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  /** Public unless the owner makes it private (FR-LIST-005). */
  visibility: listVisibilitySchema,
  entryCount: z.number().int().min(0),
  createdAt: z.string(),
});

export type List = z.infer<typeof listSchema>;

export const listPageSchema = paginated(listSchema);

export const createListSchema = z.object({
  title: titleSchema,
  description: optionalText(maxListDescriptionLength).default(null),
  visibility: listVisibilitySchema.default('public'),
});

export type CreateList = z.infer<typeof createListSchema>;

/** Only the fields that are given change. */
export const updateListSchema = z.object({
  title: titleSchema.optional(),
  description: optionalText(maxListDescriptionLength).optional(),
  visibility: listVisibilitySchema.optional(),
});

export type UpdateList = z.infer<typeof updateListSchema>;

/** A city in a custom list (FR-LIST-004). */
export const listEntrySchema = z.object({
  cityId: z.number().int(),
  /** The place in the list, counted from 1. */
  position: z.number().int().min(1),
  note: z.string().nullable(),
});

export type ListEntry = z.infer<typeof listEntrySchema>;

export const listEntryPageSchema = paginated(listEntrySchema);

/** A new entry goes to the end of the list. */
export const addListEntrySchema = z.object({
  cityId: z.number().int().positive(),
  note: optionalText(maxListNoteLength).default(null),
});

export type AddListEntry = z.infer<typeof addListEntrySchema>;

/** Changes the note, moves the entry to another place in the list, or both. */
export const updateListEntrySchema = z.object({
  note: optionalText(maxListNoteLength).optional(),
  position: z.number().int().min(1).optional(),
});

export type UpdateListEntry = z.infer<typeof updateListEntrySchema>;

export const maxListSearchQueryLength = 100;

/**
 * The words of a list search: runs of letters and digits. Everything else separates words,
 * so "half-timbered" looks for "half" and "timbered", and the query can never carry a pattern
 * character such as `%` into the search.
 */
export function listSearchWords(query: string): string[] {
  return query.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);
}

/** Query of the search over public custom lists (FR-SRCH-004). */
export const listSearchQuerySchema = paginationQuerySchema.extend({
  /** Words of the title or the description of a list. */
  q: z
    .string()
    .trim()
    .min(1)
    .max(maxListSearchQueryLength)
    .refine((query) => listSearchWords(query).length > 0, {
      message: 'The query needs at least one letter or digit.',
    }),
});

/** Who a found list belongs to, so that it can be opened through the user's lists. */
export const listOwnerSchema = z.object({
  username: z.string(),
  displayName: z.string(),
});

/** A public custom list that the search found (FR-LIST-006). */
export const listSearchResultSchema = listSchema.extend({ owner: listOwnerSchema });

export type ListSearchResult = z.infer<typeof listSearchResultSchema>;

export const listSearchPageSchema = paginated(listSearchResultSchema);
