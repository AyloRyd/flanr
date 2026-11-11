import { describe, expect, it } from 'vitest';
import { decodeOsmiumId } from './ids.ts';

describe('decodeOsmiumId', () => {
  it('decodes nodes, ways and relations', () => {
    expect(decodeOsmiumId('n206240003')).toEqual({ osmType: 'node', osmId: 206240003 });
    expect(decodeOsmiumId('w42')).toEqual({ osmType: 'way', osmId: 42 });
    expect(decodeOsmiumId('r62578')).toEqual({ osmType: 'relation', osmId: 62578 });
  });

  it('decodes areas built from ways and relations', () => {
    expect(decodeOsmiumId('a84')).toEqual({ osmType: 'way', osmId: 42 });
    expect(decodeOsmiumId('a125157')).toEqual({ osmType: 'relation', osmId: 62578 });
  });

  it('rejects unknown prefixes', () => {
    expect(() => decodeOsmiumId('x1')).toThrow();
  });
});
