import { describe, expect, it } from 'vitest';
import { ratingColor, ratingScaleColors } from './rating-colors.ts';

describe('ratingColor (SRS appendix C)', () => {
  it('gives each whole rating its colour from the table', () => {
    ratingScaleColors.forEach((color, index) => {
      expect(ratingColor(index + 1)).toBe(color);
    });
  });

  it('interpolates between two whole ratings', () => {
    // Halfway between #25b464 (7) and #1f8e4f (8).
    expect(ratingColor(7.5)).toBe('#22a15a');
  });

  it('interpolates a community rating with two decimals', () => {
    // 7.83: 83 % of the way from 7 to 8.
    expect(ratingColor(7.83)).toBe('#209453');
  });

  it('keeps values outside the scale at its ends', () => {
    expect(ratingColor(0)).toBe('#5f3a74');
    expect(ratingColor(11)).toBe('#17a0f5');
  });
});
