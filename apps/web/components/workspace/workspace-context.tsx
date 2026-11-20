'use client';

import type { SettlementType } from '@flanr/shared';
import { createContext, useContext } from 'react';
import type { Bounds } from '@/lib/map/layers';

/** A city selected in the workspace, with what the map knows of where it is. */
export interface Selection {
  cityId: number;
  position: [number, number] | null;
  settlementType: SettlementType | null;
  /** The box around the city's boundary, when the city panel has loaded it. */
  bounds: Bounds | null;
  /**
   * Whether the map moves to the city: yes when it was chosen in a list or by its URL, no when
   * the user clicked it on the map, where it already is.
   */
  move: boolean;
}

export interface Workspace {
  selection: Selection | null;
  select: (selection: Selection | null) => void;
}

export const WorkspaceContext = createContext<Workspace | null>(null);

/** The workspace around the map, for the parts of it that pages render (FR-MAP-008). */
export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('useWorkspace is used outside the map workspace');
  return workspace;
}
