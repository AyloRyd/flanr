import { describe, expect, it } from 'vitest';
import { defaultMapPrefs, readMapPrefs } from './view-prefs.ts';

describe('remembered map preferences (FR-MAP-008)', () => {
  it('reads what the user chose', () => {
    const stored = JSON.stringify({
      mode: 'population',
      values: true,
      boundaries: true,
      baseStyle: 'satellite',
    });

    expect(readMapPrefs(stored)).toEqual({
      ...defaultMapPrefs,
      mode: 'population',
      values: true,
      boundaries: true,
      baseStyle: 'satellite',
    });
  });

  it('keeps the defaults for nothing stored, a broken value or unknown values', () => {
    expect(readMapPrefs(null)).toEqual(defaultMapPrefs);
    expect(readMapPrefs('{not json')).toEqual(defaultMapPrefs);
    expect(readMapPrefs(JSON.stringify({ mode: 'heat', planned: 'yes' }))).toEqual(defaultMapPrefs);
  });
});
