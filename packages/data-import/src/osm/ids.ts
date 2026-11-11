export type OsmType = 'node' | 'way' | 'relation';

export interface OsmRef {
  osmType: OsmType;
  osmId: number;
}

const typeByPrefix: Record<string, OsmType> = { n: 'node', w: 'way', r: 'relation' };

/**
 * Decodes the IDs that `osmium export --add-unique-id=type_id` writes.
 * Areas get an "a" prefix and an encoded ID: ways become 2 * id, relations 2 * id + 1.
 */
export function decodeOsmiumId(id: string): OsmRef {
  const prefix = id[0];
  const value = Number(id.slice(1));
  if (!prefix || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Unexpected osmium ID: ${id}`);
  }
  if (prefix === 'a') {
    return value % 2 === 0
      ? { osmType: 'way', osmId: value / 2 }
      : { osmType: 'relation', osmId: (value - 1) / 2 };
  }
  const osmType = typeByPrefix[prefix];
  if (!osmType) {
    throw new Error(`Unexpected osmium ID: ${id}`);
  }
  return { osmType, osmId: value };
}
