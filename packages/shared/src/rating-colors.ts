/** The colour of each whole rating from 1 to 10, SRS appendix C. */
export const ratingScaleColors = [
  '#5f3a74',
  '#a44257',
  '#e9493a',
  '#f9951f',
  '#f4cf3f',
  '#8dc252',
  '#25b464',
  '#1f8e4f',
  '#196839',
  '#17a0f5',
] as const;

const channels = (hex: string) =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

const toHex = (values: number[]) =>
  `#${values.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

/**
 * The colour of a rating on the scale of appendix C. A rating between two whole numbers, such as
 * 7.5 or a community rating of 7.83, gets a colour linearly interpolated between the two.
 * Values outside 1–10 get the colour of the nearest end.
 */
export function ratingColor(rating: number): string {
  const position = Math.min(Math.max(rating, 1), 10) - 1;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, ratingScaleColors.length - 1);
  const share = position - lower;
  const from = channels(ratingScaleColors[lower] ?? ratingScaleColors[0]);
  const to = channels(ratingScaleColors[upper] ?? ratingScaleColors[0]);
  return toHex(from.map((value, index) => value + ((to[index] ?? value) - value) * share));
}
