import { describe, expect, it } from 'vitest';
import { parseOplRelation, unescapeOpl } from './opl.ts';

describe('parseOplRelation', () => {
  it('reads tags and members with roles', () => {
    const line =
      'r62578 v40 dV c0 t2024-01-01T00:00:00Z i0 u Tadmin_level=6,boundary=administrative,name=K%f6%ln Mw1@outer,n20953083@label,n20953083@admin_centre';

    expect(parseOplRelation(line)).toEqual({
      id: 62578,
      tags: { admin_level: '6', boundary: 'administrative', name: 'Köln' },
      members: [
        { type: 'way', id: 1, role: 'outer' },
        { type: 'node', id: 20953083, role: 'label' },
        { type: 'node', id: 20953083, role: 'admin_centre' },
      ],
    });
  });

  it('ignores lines that are not relations', () => {
    expect(parseOplRelation('n1 v1 T')).toBeNull();
  });
});

describe('unescapeOpl', () => {
  it('decodes escaped code points', () => {
    expect(unescapeOpl('Cottbus%20%-%20%Ch%f3%%15b%ebuz')).toBe('Cottbus - Chóśebuz');
  });
});
