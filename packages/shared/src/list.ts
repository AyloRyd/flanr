import { z } from 'zod';
import { paginated } from './pagination.ts';

export const maxListTitleLength = 100;
export const maxListDescriptionLength = 2000;
export const maxListNoteLength = 500;

export const listVisibilities = ['public', 'private'] as const;
export const listVisibilitySchema = z.enum(listVisibilities);

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
