import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// The monorepo keeps one .env at its root, which the API reads too. Next.js only looks in
// apps/web, so the root file is loaded here. Variables that are already set win.
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Where the web server reaches the API; see lib/api.ts.
const apiUrl = process.env.API_URL ?? 'http://localhost:8787';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript sources, so Next.js compiles them.
  transpilePackages: ['@flanr/shared'],
  // The map loads the city tiles of the API from the site's own origin (FR-MAP-003), so the
  // browser needs neither the address of the API nor CORS for them. The address is read when
  // the app is built.
  async rewrites() {
    return [{ source: '/tiles/cities/:path*', destination: `${apiUrl}/tiles/cities/:path*` }];
  },
  images: {
    // Avatars are the pictures of the users' Clerk accounts (FR-PROF-002).
    remotePatterns: [{ protocol: 'https', hostname: 'img.clerk.com' }],
  },
};

// Reads the messages from i18n/request.ts (NFR-L10N-002).
export default createNextIntlPlugin('./i18n/request.ts')(nextConfig);
