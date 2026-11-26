'use client';

import type { MapCity, UserMap } from '@flanr/shared';
import { PanelLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccountMenu } from '@/components/account-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { LeftPanel } from '@/components/workspace/left-panel';
import { MapControls } from '@/components/workspace/map-controls';
import {
  WorkspaceContext,
  type Selection,
  type Workspace,
} from '@/components/workspace/workspace-context';
import { WorkspaceMap } from '@/components/workspace/workspace-map';
import { positionOf } from '@/lib/map/layers';
import { readMapPrefs, type MapPrefs } from '@/lib/map/view-prefs';
import { cn } from '@/lib/utils';

const prefsKey = 'flanr.map';

/** Listeners of the stored preferences, and the value kept when the browser blocks storage. */
const prefsListeners = new Set<() => void>();
let prefsInMemory: string | null = null;

function subscribePrefs(listener: () => void): () => void {
  prefsListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    prefsListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function storedPrefs(): string | null {
  try {
    return window.localStorage.getItem(prefsKey) ?? prefsInMemory;
  } catch {
    return prefsInMemory;
  }
}

/**
 * The map preferences of this browser (FR-MAP-008). The server and the first render use the
 * defaults, so that the markup matches; the stored ones follow right after.
 */
function useMapPrefs(): [MapPrefs, (change: Partial<MapPrefs>) => void] {
  const stored = useSyncExternalStore(subscribePrefs, storedPrefs, () => null);
  const prefs = useMemo(() => readMapPrefs(stored), [stored]);
  const change = useCallback((update: Partial<MapPrefs>) => {
    const next = JSON.stringify({ ...readMapPrefs(storedPrefs()), ...update });
    prefsInMemory = next;
    try {
      window.localStorage.setItem(prefsKey, next);
    } catch {
      // Not remembered beyond this page, but still applied.
    }
    for (const listener of prefsListeners) listener();
  }, []);
  return [prefs, change];
}

interface MapWorkspaceProps {
  /** The signed-in user's cities; null for a guest. */
  data: UserMap | null;
  /** The city panel, when the URL names a city. */
  children: ReactNode;
}

/**
 * The map as the main screen and the user's workspace (FR-MAP-008, SRS §6.1): the full-screen
 * map, the account menu and the left panel at the top left, the map controls, and the city panel
 * on the right that the pages under /map render.
 */
export function MapWorkspace({ data, children }: MapWorkspaceProps) {
  const t = useTranslations('workspace');
  const tApp = useTranslations('app');
  const router = useRouter();
  const panelOpen = usePathname().startsWith('/map/cities/');
  const [prefs, changePrefs] = useMapPrefs();
  const [leftOpen, setLeftOpen] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  const select = useCallback((next: Selection | null) => {
    setSelection((before) => {
      // A city picked again keeps what its panel reported, which comes only once.
      if (next && before?.cityId === next.cityId) {
        return {
          ...next,
          position: next.position ?? before.position,
          bounds: next.bounds ?? before.bounds,
        };
      }
      return next;
    });
  }, []);
  const workspace = useMemo<Workspace>(() => ({ selection, select }), [selection, select]);

  const openCity = (city: MapCity) => {
    select({
      cityId: city.cityId,
      position: positionOf(city),
      settlementType: city.settlementType,
      bounds: null,
    });
    router.push(`/map/cities/${city.cityId}`);
    // On a phone the list covers the map, so it makes way for the city.
    if (window.innerWidth < 640) setLeftOpen(false);
  };

  return (
    <WorkspaceContext.Provider value={workspace}>
      <main id="main" className="relative h-svh w-full overflow-hidden">
        <h1 className="sr-only">{t('title')}</h1>
        <WorkspaceMap data={data} prefs={prefs} className="absolute inset-0" />

        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('toggleLeftPanel')}
            aria-expanded={leftOpen}
            onClick={() => setLeftOpen(!leftOpen)}
          >
            <PanelLeft />
          </Button>
          <Link href="/" className="px-1.5 text-lg font-bold tracking-tight text-primary">
            {tApp('name')}
          </Link>
          <ThemeToggle />
          <AccountMenu />
        </div>

        {leftOpen && (
          <LeftPanel
            data={data}
            onSelectCity={openCity}
            // On a phone the open list lies above the city panel, which opens from the bottom.
            className="absolute top-17 bottom-0 left-0 z-40 w-full rounded-none sm:bottom-3 sm:left-3 sm:z-10 sm:w-[24rem] sm:rounded-xl"
          />
        )}

        <MapControls
          data={data}
          prefs={prefs}
          onChange={changePrefs}
          // Beside the city panel while it is open; on phones the panel opens from the bottom.
          className={cn('absolute top-3 right-3 z-20', panelOpen && 'sm:right-[27.75rem]')}
        />

        {children}
      </main>
    </WorkspaceContext.Provider>
  );
}
