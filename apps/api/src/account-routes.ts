import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { dataExportSchema, type DataExport } from '@flanr/shared';
import type { AccountStore } from './accounts.ts';
import type { AuthEnv } from './auth.ts';
import type { DefaultListStore } from './default-lists.ts';
import type { ListStore } from './lists.ts';
import type { LivedCityStore } from './lived-cities.ts';
import { problem } from './problem.ts';
import type { RatingStore } from './ratings.ts';
import { bearerSecurity, commonErrors, json, problemResponse } from './route-helpers.ts';
import type { VisitStore } from './visits.ts';

const exportRoute = createRoute({
  method: 'get',
  path: '/v1/me/export',
  summary: 'Everything Flanr stores about the signed-in user, as JSON (NFR-GDPR-003)',
  security: bearerSecurity,
  responses: {
    200: { description: 'The data export', ...json(dataExportSchema) },
    ...commonErrors,
  },
});

const deleteAccountRoute = createRoute({
  method: 'delete',
  path: '/v1/me',
  summary: 'Delete the account of the signed-in user with all its data (FR-AUTH-009)',
  description:
    'Cannot be undone. The account is deleted at the sign-in provider too, so the user can no longer sign in.',
  security: bearerSecurity,
  request: {
    query: z.object({
      /** Guards against a request that was not meant: the deletion needs `confirm=true`. */
      confirm: z.literal('true'),
    }),
  },
  responses: {
    204: { description: 'Deleted' },
    ...commonErrors,
    502: problemResponse('The sign-in provider did not delete the account; nothing was deleted'),
  },
});

export interface AccountRouteStores {
  accounts: AccountStore;
  visits: VisitStore;
  livedCities: LivedCityStore;
  defaultLists: DefaultListStore;
  ratings: RatingStore;
  lists: ListStore;
}

const exportPageSize = 500;

/** Reads a whole list through its pages. `nextPage` gets the last item of the page before. */
async function readAll<Item>(
  nextPage: (last: Item | undefined, limit: number) => Promise<Item[]>,
): Promise<Item[]> {
  const items: Item[] = [];
  for (;;) {
    const page = await nextPage(items.at(-1), exportPageSize);
    items.push(...page);
    if (page.length < exportPageSize) return items;
  }
}

export function registerAccountRoutes(
  app: OpenAPIHono<AuthEnv>,
  { accounts, visits, livedCities, defaultLists, ratings, lists }: AccountRouteStores,
  now: () => Date,
): void {
  app.openapi(exportRoute, async (c) => {
    const user = c.get('user');
    const [allVisits, lived, planned, allRatings, ownLists] = await Promise.all([
      readAll((last: DataExport['visits'][number] | undefined, limit) =>
        visits.list(user.id, { beforeId: last?.id, limit }),
      ),
      readAll((last: DataExport['livedCities'][number] | undefined, limit) =>
        livedCities.list(user.id, { afterCityId: last?.cityId, limit }),
      ),
      readAll((last: DataExport['plannedCities'][number] | undefined, limit) =>
        defaultLists.listPlanned(user.id, { afterCityId: last?.cityId, limit }),
      ),
      readAll((last: DataExport['ratings'][number] | undefined, limit) =>
        ratings.list(user.id, { afterCityId: last?.cityId, limit }),
      ),
      readAll((last: Omit<DataExport['lists'][number], 'entries'> | undefined, limit) =>
        lists.list(user.id, { beforeId: last?.id, limit }),
      ),
    ]);
    const listsWithEntries = await Promise.all(
      ownLists.map(async (list) => ({
        ...list,
        entries: await readAll(
          async (last: DataExport['lists'][number]['entries'][number] | undefined, limit) =>
            (await lists.listEntries(user.id, list.id, { afterPosition: last?.position, limit })) ??
            [],
        ),
      })),
    );

    const cityIds = new Set([
      ...allVisits.map((visit) => visit.cityId),
      ...lived.map((city) => city.cityId),
      ...planned.map((city) => city.cityId),
      ...allRatings.map((rating) => rating.cityId),
      ...listsWithEntries.flatMap((list) => list.entries.map((entry) => entry.cityId)),
    ]);

    const body: DataExport = {
      exportedAt: now().toISOString(),
      profile: user,
      visits: allVisits,
      livedCities: lived,
      plannedCities: planned,
      ratings: allRatings,
      lists: listsWithEntries,
      cities: await accounts.describeCities([...cityIds]),
    };
    c.header('Content-Disposition', 'attachment; filename="flanr-export.json"');
    return c.json(body, 200);
  });

  app.openapi(deleteAccountRoute, async (c) => {
    const result = await accounts.remove(c.get('user').id);
    if (result === 'provider_failed') {
      return problem(
        c,
        502,
        'Account not deleted',
        'The sign-in provider did not delete the account. Nothing was deleted; try again later.',
      ) as never;
    }
    return c.body(null, 204);
  });
}
