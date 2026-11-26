import type { StyleSpecification } from 'mapbox-gl';
import { describe, expect, it } from 'vitest';
import { withDarkerSpace } from './base-styles.ts';

const style = (fog: StyleSpecification['fog']): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [],
  ...(fog ? { fog } : {}),
});

describe('the space around the globe (FR-MAP-002)', () => {
  it('replaces the space colour of the globe zoom and keeps the one closer in', () => {
    const standard = style({
      'space-color': ['interpolate', ['linear'], ['zoom'], 5, 'hsl(211, 84%, 9%)', 7, 'blue'],
    });

    const space = withDarkerSpace(standard).fog?.['space-color'] as unknown[];

    expect(space[4]).not.toBe('hsl(211, 84%, 9%)');
    expect(space.slice(5)).toEqual([7, 'blue']);
  });

  it('leaves a style alone whose space colour it does not know', () => {
    const standard = style({ 'space-color': 'black' });

    expect(withDarkerSpace(standard)).toBe(standard);
    expect(withDarkerSpace(style(undefined)).fog).toBeUndefined();
  });
});
