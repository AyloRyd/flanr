'use client';

import { useEffect } from 'react';

/**
 * Marks the page as hydrated, so that end-to-end tests wait until buttons react before they
 * click them; a click on the server-rendered markup before that is lost.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return null;
}
