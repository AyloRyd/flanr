import type {
  AddListEntry,
  CreateList,
  List,
  ListEntry,
  UpdateList,
  UpdateListEntry,
} from '@flanr/shared';
import type { TransactionSql } from 'postgres';
import { cityExists } from './cities.ts';
import type { Sql } from './db.ts';

export type AddEntryResult =
  { entry: ListEntry } | { problem: 'list_not_found' | 'city_not_found' | 'already_in_list' };

export type UpdateEntryResult =
  { entry: ListEntry } | { problem: 'not_found' | 'position_out_of_range' };

/**
 * Who a read is for. The owner sees all their lists; everyone else only the public ones, and
 * a private list looks to them as if it did not exist (FR-LIST-005).
 */
export type Audience = 'owner' | 'others';

interface ListOptions {
  limit: number;
  /** The owner unless said otherwise. */
  audience?: Audience | undefined;
}

/**
 * Reads and changes custom lists (FR-LIST-003, FR-LIST-004). Every method takes the user and
 * only ever touches that user's lists, so a handler cannot reach someone else's by ID
 * (NFR-SEC-003).
 */
export interface ListStore {
  create(userId: number, input: CreateList): Promise<List>;
  /** Newest first. `beforeId` starts the next page. */
  list(userId: number, options: ListOptions & { beforeId?: number | undefined }): Promise<List[]>;
  find(userId: number, listId: number, audience?: Audience): Promise<List | null>;
  update(userId: number, listId: number, changes: UpdateList): Promise<List | null>;
  remove(userId: number, listId: number): Promise<boolean>;

  /** In list order. Null if the user has no such list. */
  listEntries(
    userId: number,
    listId: number,
    options: ListOptions & { afterPosition?: number | undefined },
  ): Promise<ListEntry[] | null>;
  /** Adds the city at the end of the list. */
  addEntry(userId: number, listId: number, input: AddListEntry): Promise<AddEntryResult>;
  updateEntry(
    userId: number,
    listId: number,
    cityId: number,
    changes: UpdateListEntry,
  ): Promise<UpdateEntryResult>;
  removeEntry(userId: number, listId: number, cityId: number): Promise<boolean>;
}

interface ListRow {
  id: number;
  title: string;
  description: string | null;
  visibility: List['visibility'];
  entry_count: number;
  created_at: Date;
}

const toList = (row: ListRow): List => ({
  id: row.id,
  title: row.title,
  description: row.description,
  visibility: row.visibility,
  entryCount: row.entry_count,
  createdAt: row.created_at.toISOString(),
});

interface EntryRow {
  city_id: number;
  position: number;
  note: string | null;
}

const toEntry = (row: EntryRow): ListEntry => ({
  cityId: row.city_id,
  position: row.position,
  note: row.note,
});

export function createListStore(sql: Sql): ListStore {
  const listColumns = sql`
    lists.id, lists.title, lists.description, lists.visibility, lists.created_at,
    (SELECT count(*)::int FROM list_entries WHERE list_entries.list_id = lists.id) AS entry_count`;
  const entryColumns = sql`city_id, position, note`;

  const visibleTo = (audience: Audience) =>
    audience === 'owner' ? sql`` : sql`AND visibility = 'public'`;

  async function find(
    db: Sql | TransactionSql,
    userId: number,
    listId: number,
    audience: Audience = 'owner',
  ) {
    const [row] = await db<ListRow[]>`
      SELECT ${listColumns} FROM lists
      WHERE id = ${listId} AND user_id = ${userId} ${visibleTo(audience)}`;
    return row ? toList(row) : null;
  }

  /**
   * Finds the user's list and locks it until the transaction ends, so that two changes of its
   * entries cannot leave a gap or a shared place in the order.
   */
  async function lockList(tx: TransactionSql, userId: number, listId: number): Promise<boolean> {
    const rows = await tx`
      SELECT 1 FROM lists WHERE id = ${listId} AND user_id = ${userId} FOR UPDATE`;
    return rows.length > 0;
  }

  async function countEntries(tx: TransactionSql, listId: number): Promise<number> {
    const [row] = await tx<{ count: number }[]>`
      SELECT count(*)::int AS count FROM list_entries WHERE list_id = ${listId}`;
    return row?.count ?? 0;
  }

  /** Moves the entry and shifts the entries between its old and new place by one. */
  async function moveEntry(
    tx: TransactionSql,
    listId: number,
    cityId: number,
    from: number,
    to: number,
  ) {
    if (to < from) {
      await tx`
        UPDATE list_entries SET position = position + 1
        WHERE list_id = ${listId} AND position >= ${to} AND position < ${from}`;
    } else {
      await tx`
        UPDATE list_entries SET position = position - 1
        WHERE list_id = ${listId} AND position > ${from} AND position <= ${to}`;
    }
    await tx`
      UPDATE list_entries SET position = ${to}
      WHERE list_id = ${listId} AND city_id = ${cityId}`;
  }

  return {
    async create(userId, { title, description, visibility }) {
      const [row] = await sql<ListRow[]>`
        INSERT INTO lists (user_id, title, description, visibility)
        VALUES (${userId}, ${title}, ${description}, ${visibility}::list_visibility)
        RETURNING ${listColumns}`;
      if (!row) throw new Error('List could not be created');
      return toList(row);
    },

    async list(userId, { beforeId, limit, audience = 'owner' }) {
      const rows = await sql<ListRow[]>`
        SELECT ${listColumns} FROM lists
        WHERE user_id = ${userId} ${visibleTo(audience)}
          ${beforeId === undefined ? sql`` : sql`AND id < ${beforeId}`}
        ORDER BY id DESC
        LIMIT ${limit}`;
      return rows.map(toList);
    },

    find: (userId, listId, audience) => find(sql, userId, listId, audience),

    async update(userId, listId, { title, description, visibility }) {
      const [row] = await sql<ListRow[]>`
        UPDATE lists SET
          title = COALESCE(${title ?? null}, title),
          ${description === undefined ? sql`` : sql`description = ${description},`}
          visibility = COALESCE(${visibility ?? null}::list_visibility, visibility)
        WHERE id = ${listId} AND user_id = ${userId}
        RETURNING ${listColumns}`;
      return row ? toList(row) : null;
    },

    async remove(userId, listId) {
      const rows = await sql`
        DELETE FROM lists WHERE id = ${listId} AND user_id = ${userId} RETURNING id`;
      return rows.length > 0;
    },

    async listEntries(userId, listId, { afterPosition, limit, audience }) {
      if (!(await find(sql, userId, listId, audience))) return null;
      const rows = await sql<EntryRow[]>`
        SELECT ${entryColumns} FROM list_entries
        WHERE list_id = ${listId}
          ${afterPosition === undefined ? sql`` : sql`AND position > ${afterPosition}`}
        ORDER BY position
        LIMIT ${limit}`;
      return rows.map(toEntry);
    },

    async addEntry(userId, listId, { cityId, note }) {
      return sql.begin(async (tx): Promise<AddEntryResult> => {
        if (!(await lockList(tx, userId, listId))) return { problem: 'list_not_found' };
        if (!(await cityExists(tx, cityId))) return { problem: 'city_not_found' };

        const position = (await countEntries(tx, listId)) + 1;
        const [row] = await tx<EntryRow[]>`
          INSERT INTO list_entries (list_id, city_id, position, note)
          VALUES (${listId}, ${cityId}, ${position}, ${note})
          ON CONFLICT (list_id, city_id) DO NOTHING
          RETURNING ${entryColumns}`;
        return row ? { entry: toEntry(row) } : { problem: 'already_in_list' };
      });
    },

    async updateEntry(userId, listId, cityId, { note, position }) {
      return sql.begin(async (tx): Promise<UpdateEntryResult> => {
        if (!(await lockList(tx, userId, listId))) return { problem: 'not_found' };
        const [current] = await tx<EntryRow[]>`
          SELECT ${entryColumns} FROM list_entries
          WHERE list_id = ${listId} AND city_id = ${cityId}`;
        if (!current) return { problem: 'not_found' };

        if (position !== undefined && position !== current.position) {
          if (position > (await countEntries(tx, listId))) {
            return { problem: 'position_out_of_range' };
          }
          await moveEntry(tx, listId, cityId, current.position, position);
        }
        if (note !== undefined) {
          await tx`
            UPDATE list_entries SET note = ${note}
            WHERE list_id = ${listId} AND city_id = ${cityId}`;
        }
        return {
          entry: {
            cityId,
            position: position ?? current.position,
            note: note === undefined ? current.note : note,
          },
        };
      });
    },

    async removeEntry(userId, listId, cityId) {
      return sql.begin(async (tx) => {
        if (!(await lockList(tx, userId, listId))) return false;
        const [removed] = await tx<{ position: number }[]>`
          DELETE FROM list_entries WHERE list_id = ${listId} AND city_id = ${cityId}
          RETURNING position`;
        if (!removed) return false;
        // The entries after it move up, so that the places stay without gaps.
        await tx`
          UPDATE list_entries SET position = position - 1
          WHERE list_id = ${listId} AND position > ${removed.position}`;
        return true;
      });
    },
  };
}

/** For places that never reach the lists, such as writing the OpenAPI document. */
export const noListStore = new Proxy({} as ListStore, {
  get: () => () => {
    throw new Error('Lists are not available here');
  },
});
