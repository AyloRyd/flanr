import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Reads the Clerk session on every page request, so that server components know who is signed
 * in. No page is closed to guests (FR-AUTH-001); write actions ask for sign-in where they are
 * (FR-AUTH-002), and the API checks every request itself (NFR-SEC-003).
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next.js internals and static files.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)',
  ],
};
