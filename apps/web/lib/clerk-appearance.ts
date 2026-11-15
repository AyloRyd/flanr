/**
 * Clerk's sign-in, sign-up and account components in Flanr's colours. They read the CSS
 * variables of globals.css, so they follow the light and dark theme on their own.
 */
export const clerkAppearance = {
  variables: {
    colorBackground: 'var(--card)',
    colorForeground: 'var(--card-foreground)',
    colorPrimary: 'var(--primary)',
    colorPrimaryForeground: 'var(--primary-foreground)',
    colorDanger: 'var(--destructive)',
    colorInput: 'var(--background)',
    colorInputForeground: 'var(--foreground)',
    colorMuted: 'var(--muted)',
    colorMutedForeground: 'var(--muted-foreground)',
    colorNeutral: 'var(--foreground)',
    colorRing: 'var(--ring)',
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-figtree)',
  },
} as const;
