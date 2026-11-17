import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { HydrationMarker } from '@/components/hydration-marker';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import { clerkAppearance } from '@/lib/clerk-appearance';
import './globals.css';

const figtree = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-figtree' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return {
    title: { default: t('name'), template: `%s · ${t('name')}` },
    description: t('tagline'),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1c1c' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('nav')]);

  return (
    // next-themes sets the theme class before React runs, so the server markup differs.
    <html lang={locale} className={figtree.variable} suppressHydrationWarning>
      <body className="flex min-h-svh flex-col">
        <ClerkProvider
          // Hands the session of the request to client components while they render on the
          // server, so the header shows the right account state without a jump.
          dynamic
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          // After signing up without a page to return to, offer adding past visits (FR-VIS-007).
          signUpFallbackRedirectUrl="/onboarding"
          appearance={clerkAppearance}
        >
          <NextIntlClientProvider>
            <ThemeProvider>
              <a
                href="#main"
                className="sr-only rounded-lg bg-background px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
              >
                {t('skipToContent')}
              </a>
              <SiteHeader />
              <main id="main" className="flex-1">
                {children}
              </main>
              <SiteFooter />
              <HydrationMarker />
            </ThemeProvider>
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
