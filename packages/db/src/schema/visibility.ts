import { pgEnum } from 'drizzle-orm/pg-core';

/** Whether a list can be seen by others: a custom list or one of the default lists (FR-LIST-005). */
export const listVisibilityEnum = pgEnum('list_visibility', ['public', 'private']);
