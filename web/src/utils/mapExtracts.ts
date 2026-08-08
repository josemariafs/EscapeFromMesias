import type { MapPosition } from '../types';
import { gamePositionToPercent, getMapProjection } from './mapCoordinates';
import { getMapGroupKey } from './maps';

export type ExtractFaction = 'pmc' | 'scav' | 'shared';

export interface MapExtractMarker {
  id: string;
  mapKey: string;
  name: string;
  faction: ExtractFaction;
  left: number;
  top: number;
}

/** mapKey → extracciones proyectadas sobre el SVG. */
export type MapExtractsData = Record<string, MapExtractMarker[]>;

export const EXTRACT_PMC_ICON_URL = '/markers/extract-pmc-pin.svg';
export const EXTRACT_SCAV_ICON_URL = '/markers/extract-scav-pin.svg';
export const EXTRACT_SHARED_COLOR = '#00e4e5';
export const EXTRACT_PMC_COLOR = '#00e599';
export const EXTRACT_SCAV_COLOR = '#ff7800';

export function normalizeExtractFaction(value: string | null | undefined): ExtractFaction {
  const raw = (value ?? 'shared').trim().toLowerCase();
  if (raw === 'pmc' || raw === 'usec' || raw === 'bear') return 'pmc';
  if (raw === 'scav' || raw === 'scavs') return 'scav';
  return 'shared';
}

export function extractIconUrl(faction: ExtractFaction): string {
  // Shared usa el pin PMC; el color del marcador distingue la facción.
  return faction === 'scav' ? EXTRACT_SCAV_ICON_URL : EXTRACT_PMC_ICON_URL;
}

export function extractFactionLabel(
  faction: ExtractFaction,
  labels: { pmc: string; scav: string; shared: string },
): string {
  if (faction === 'scav') return labels.scav;
  if (faction === 'pmc') return labels.pmc;
  return labels.shared;
}

export function extractMarkerColor(faction: ExtractFaction): string {
  if (faction === 'scav') return EXTRACT_SCAV_COLOR;
  if (faction === 'pmc') return EXTRACT_PMC_COLOR;
  return EXTRACT_SHARED_COLOR;
}

function averagePosition(points: MapPosition[]): MapPosition | null {
  if (points.length === 0) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  let zCount = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    if (Number.isFinite(p.z)) {
      z += Number(p.z);
      zCount += 1;
    }
  }
  const n = points.length;
  return {
    x: x / n,
    y: y / n,
    z: zCount > 0 ? z / zCount : undefined,
  };
}

export function resolveExtractGamePosition(extract: {
  position?: MapPosition | null;
  outline?: MapPosition[] | null;
}): MapPosition | null {
  const pos = extract.position;
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
    return {
      x: pos.x,
      y: pos.y,
      z: Number.isFinite(pos.z) ? pos.z : pos.y,
    };
  }
  const outline = (extract.outline ?? []).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  const avg = averagePosition(outline);
  if (!avg) return null;
  return {
    x: avg.x,
    y: avg.y,
    z: Number.isFinite(avg.z) ? avg.z : avg.y,
  };
}

export function projectExtractToMap(
  mapNormalizedName: string,
  extract: {
    id: string;
    name: string;
    faction?: string | null;
    position?: MapPosition | null;
    outline?: MapPosition[] | null;
  },
): MapExtractMarker | null {
  const mapKey = getMapGroupKey({
    normalizedName: mapNormalizedName,
    name: mapNormalizedName,
  });
  const projection = getMapProjection(mapKey);
  if (!projection) return null;

  const gamePos = resolveExtractGamePosition(extract);
  if (!gamePos) return null;

  const percent = gamePositionToPercent(gamePos, projection);
  if (!percent) return null;

  return {
    id: `extract:${mapKey}:${extract.id}`,
    mapKey,
    name: extract.name?.trim() || extract.id,
    faction: normalizeExtractFaction(extract.faction),
    left: percent.left,
    top: percent.top,
  };
}
