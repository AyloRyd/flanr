import {
  citySearchQuerySchema,
  listSearchQuerySchema,
  planCitySearch,
  type CitySearchProblem,
} from '@flanr/shared';

/** The search parameters of a page, as Next.js passes them. */
export type SearchParams = Record<string, string | string[] | undefined>;

/** The fields of the city search form, as text, so that the form shows what was sent. */
export interface CitySearchFields {
  q: string;
  country: string;
  regionId: string;
  settlementType: string[];
  populationMin: string;
  populationMax: string;
  minRating: string;
  minRatings: string;
  sort: string;
  order: string;
  cursor: string;
}

const singleFields = [
  'q',
  'country',
  'regionId',
  'populationMin',
  'populationMax',
  'minRating',
  'minRatings',
  'sort',
  'order',
  'cursor',
] as const;

/** Optional fields may be missing but not undefined, as the API client's types ask. */
type WithoutUndefined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

function withoutUndefined<T extends object>(value: T): WithoutUndefined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as WithoutUndefined<T>;
}

/** The first value of a parameter, trimmed; a GET form sends empty fields as empty strings. */
function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/** Reads the city search form from the URL. Settlement types come as one parameter per type. */
export function readCitySearchFields(params: SearchParams): CitySearchFields {
  const raw = params.settlementType;
  const types = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((value) => value.split(','));
  const fields = Object.fromEntries(
    singleFields.map((name) => [name, single(params[name])]),
  ) as Omit<CitySearchFields, 'settlementType'>;
  return { ...fields, settlementType: types.filter(Boolean) };
}

/** Why a city search cannot be sent: a field the API would refuse, or a rule of FR-SRCH-003. */
export type CitySearchFormProblem = 'invalid' | CitySearchProblem;

/** The query for GET /v1/cities, checked with the API's own schema and rules. */
export function toCitySearchQuery(fields: CitySearchFields) {
  const given = Object.fromEntries(
    Object.entries({ ...fields, settlementType: fields.settlementType.join(',') }).filter(
      ([, value]) => value !== '',
    ),
  );
  const parsed = citySearchQuerySchema.safeParse(given);
  if (!parsed.success) return { problem: 'invalid' as const };
  const plan = planCitySearch(parsed.data);
  if ('problem' in plan) return { problem: plan.problem };
  return {
    query: withoutUndefined({
      ...parsed.data,
      settlementType: parsed.data.settlementType?.join(','),
    }),
  };
}

/** Whether any filter or sorting is set, so the filter panel opens. */
export function hasCityFilters(fields: CitySearchFields): boolean {
  return Object.entries(fields).some(
    ([name, value]) => name !== 'q' && name !== 'cursor' && value.length > 0,
  );
}

/** The query for GET /v1/public-lists, or null if there is no usable search text. */
export function toListSearchQuery(params: SearchParams) {
  const q = single(params.q);
  const cursor = single(params.cursor);
  const parsed = listSearchQuerySchema.safeParse({ q, ...(cursor ? { cursor } : {}) });
  return parsed.success ? { ...withoutUndefined(parsed.data), q: parsed.data.q } : null;
}

/** The URL of the same search with another cursor: the next page. */
export function withCursor(path: string, params: SearchParams, cursor: string): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === 'cursor' || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== '') search.append(name, item);
    }
  }
  search.set('cursor', cursor);
  return `${path}?${search.toString()}`;
}
