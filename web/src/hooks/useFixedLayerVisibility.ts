import { useCallback, useState } from 'react';
import {
  isKeyDocumentMarkerType,
  isUndergroundKeyDocumentMarkerType,
  type FixedMarkerType,
} from '../types/routes';
import type { ExtractFaction } from '../utils/mapExtracts';

export type FixedLayerId =
  | 'default'
  | 'kb'
  | 'kb-underground'
  | 'question'
  | 'extract-pmc'
  | 'extract-scav';

export type FixedLayerVisibility = Record<FixedLayerId, boolean>;

export const FIXED_LAYER_IDS: FixedLayerId[] = [
  'default',
  'kb',
  'kb-underground',
  'question',
  'extract-pmc',
  'extract-scav',
];

/** v2: extracciones ocultas por defecto. */
const STORAGE_KEY = 'efg-fixed-layer-visibility:v2';

const DEFAULT_VISIBILITY: FixedLayerVisibility = {
  default: true,
  kb: true,
  'kb-underground': true,
  question: true,
  'extract-pmc': false,
  'extract-scav': false,
};

function readStored(): FixedLayerVisibility {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VISIBILITY };
    const parsed = JSON.parse(raw) as Partial<FixedLayerVisibility>;
    return {
      ...DEFAULT_VISIBILITY,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}

export function fixedMarkerLayerId(markerType?: FixedMarkerType | null): FixedLayerId {
  if (isUndergroundKeyDocumentMarkerType(markerType)) return 'kb-underground';
  if (isKeyDocumentMarkerType(markerType)) return 'kb';
  if (markerType === 'question') return 'question';
  return 'default';
}

export function isExtractLayerVisible(
  faction: ExtractFaction,
  visibility: FixedLayerVisibility,
): boolean {
  if (faction === 'pmc') return visibility['extract-pmc'];
  if (faction === 'scav') return visibility['extract-scav'];
  return visibility['extract-pmc'] || visibility['extract-scav'];
}

export function useFixedLayerVisibility() {
  const [visibility, setVisibility] = useState<FixedLayerVisibility>(readStored);

  const setLayerVisible = useCallback((layer: FixedLayerId, visible: boolean) => {
    setVisibility((prev) => {
      const next = { ...prev, [layer]: visible };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / private mode
      }
      return next;
    });
  }, []);

  const toggleLayer = useCallback((layer: FixedLayerId) => {
    setVisibility((prev) => {
      const next = { ...prev, [layer]: !prev[layer] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / private mode
      }
      return next;
    });
  }, []);

  return { visibility, setLayerVisible, toggleLayer };
}
