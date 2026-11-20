/** The two base map styles (FR-MAP-001). */
export const baseStyleNames = ['standard', 'satellite'] as const;
export type BaseStyleName = (typeof baseStyleNames)[number];
