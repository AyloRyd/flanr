import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript sources, so Next.js compiles them.
  transpilePackages: ['@flanr/shared'],
};

export default nextConfig;
