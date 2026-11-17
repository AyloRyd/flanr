import { auth } from '@clerk/nextjs/server';
import { apiUrl } from '@/lib/api';

/**
 * Everything Flanr stores about the signed-in user as a JSON file to download (NFR-GDPR-003).
 * The API builds the export; this route only hands it over with a file name.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  const token = session.userId ? await session.getToken() : null;
  if (!token) return new Response(null, { status: 401 });

  const response = await fetch(`${apiUrl}/v1/me/export`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) return new Response(null, { status: 502 });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(response.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="flanr-export-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
