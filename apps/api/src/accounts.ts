import type { ExportedCity } from '@flanr/shared';
import type { Sql } from './db.ts';

/** Deletes the account at the sign-in provider, so that nobody can sign in with it again. */
export type AuthAccountRemover = (authProviderId: string) => Promise<void>;

export interface AccountStore {
  /**
   * Deletes the user's account (FR-AUTH-009): first at the sign-in provider, then everything
   * Flanr stores about the user (SRS 5.4). If the provider fails, nothing is deleted.
   */
  remove(userId: number): Promise<'removed' | 'provider_failed'>;
  /** For the data export: what the given city IDs stand for. */
  describeCities(cityIds: number[]): Promise<ExportedCity[]>;
}

export function createAccountStore(sql: Sql, removeAuthAccount: AuthAccountRemover): AccountStore {
  return {
    async remove(userId) {
      const [user] = await sql<{ auth_provider_id: string }[]>`
        SELECT auth_provider_id FROM users WHERE id = ${userId}`;
      if (!user) return 'removed';

      // The provider goes first. The other way round, a failure there would leave an account
      // that can still sign in and would get a new, empty user on the next request.
      try {
        await removeAuthAccount(user.auth_provider_id);
      } catch (error) {
        console.error(error);
        return 'provider_failed';
      }
      // Visits, lived-in and planned cities, ratings and lists go with the user through
      // their foreign keys.
      await sql`DELETE FROM users WHERE id = ${userId}`;
      return 'removed';
    },

    async describeCities(cityIds) {
      if (cityIds.length === 0) return [];
      return sql<ExportedCity[]>`
        SELECT id, name_local AS name, country_code AS "countryCode",
          osm_type || '/' || osm_id AS osm, wikidata_id AS "wikidataId"
        FROM cities WHERE id IN ${sql(cityIds)}
        ORDER BY id`;
    },
  };
}

/** For places that never reach the accounts, such as writing the OpenAPI document. */
export const noAccountStore = new Proxy({} as AccountStore, {
  get: () => () => {
    throw new Error('Accounts are not available here');
  },
});
