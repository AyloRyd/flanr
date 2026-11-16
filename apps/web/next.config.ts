import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// The monorepo keeps one .env at its root, which the API reads too. Next.js only looks in
// apps/web, so the root file is loaded here. Variables that are already set win.
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript sources, so Next.js compiles them.
  transpilePackages: ['@flanr/shared'],
};

// Reads the messages from i18n/request.ts (NFR-L10N-002).
export default createNextIntlPlugin('./i18n/request.ts')(nextConfig);
