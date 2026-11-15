import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript sources, so Next.js compiles them.
  transpilePackages: ['@flanr/shared'],
};

// Reads the messages from i18n/request.ts (NFR-L10N-002).
export default createNextIntlPlugin('./i18n/request.ts')(nextConfig);
