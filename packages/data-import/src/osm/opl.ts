import type { OsmType } from './ids.ts';
import type { Tags } from './tags.ts';

export interface RelationMember {
  type: OsmType;
  id: number;
  role: string;
}

export interface OplRelation {
  id: number;
  tags: Tags;
  members: RelationMember[];
}

const memberTypes: Record<string, OsmType> = { n: 'node', w: 'way', r: 'relation' };

/** Parses one relation line of osmium's OPL format: "r123 v1 ... Tkey=value,... Mn1@role,...". */
export function parseOplRelation(line: string): OplRelation | null {
  const fields = line.trim().split(' ');
  const head = fields[0];
  if (!head?.startsWith('r')) return null;

  const tagField = fields.find((field) => field.startsWith('T'))?.slice(1) ?? '';
  const memberField = fields.find((field) => field.startsWith('M'))?.slice(1) ?? '';

  return {
    id: Number(head.slice(1)),
    tags: parseTags(tagField),
    members: memberField ? memberField.split(',').map(parseMember) : [],
  };
}

function parseTags(field: string): Tags {
  const tags: Tags = {};
  if (!field) return tags;
  for (const pair of field.split(',')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    tags[unescapeOpl(pair.slice(0, separator))] = unescapeOpl(pair.slice(separator + 1));
  }
  return tags;
}

function parseMember(field: string): RelationMember {
  const separator = field.indexOf('@');
  const ref = field.slice(0, separator);
  const type = memberTypes[ref[0] ?? ''];
  if (!type || separator < 0) {
    throw new Error(`Unexpected OPL member: ${field}`);
  }
  return { type, id: Number(ref.slice(1)), role: unescapeOpl(field.slice(separator + 1)) };
}

/** OPL escapes special characters as %hex%, where hex is the Unicode code point. */
export function unescapeOpl(value: string): string {
  return value.replace(/%([0-9a-fA-F]+)%/g, (_, hex: string) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );
}
