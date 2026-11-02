import type { MapPosition } from '../types';
import { gamePositionToPercent, getMapProjection } from './mapCoordinates';
import { getMapGroupKey } from './maps';
import { resolveExtractGamePosition } from './mapExtracts';

export interface MapPmcSpawnMarker {
  id: string;
  mapKey: string;
  left: number;
  top: number;
}

/** mapKey → spawns PMC proyectados sobre el SVG. */
export type MapPmcSpawnsData = Record<string, MapPmcSpawnMarker[]>;

export const PMC_SPAWN_ICON_URL = '/markers/pmc-spawn-pin.svg';
export const PMC_SPAWN_COLOR = '#4da3ff';

export function projectPmcSpawnToMap(
  mapNormalizedName: string,
  spawn: { position?: MapPosition | null; zoneName?: string | null },
  spawnIndex: number,
): MapPmcSpawnMarker | null {
  const mapKey = getMapGroupKey({
    normalizedName: mapNormalizedName,
    name: mapNormalizedName,
  });
  const projection = getMapProjection(mapKey);
  if (!projection) return null;

  const gamePos = resolveExtractGamePosition({ position: spawn.position, outline: null });
  if (!gamePos) return null;

  const percent = gamePositionToPercent(gamePos, projection);
  if (!percent) return null;

  const zoneKey = (spawn.zoneName ?? '').trim() || String(spawnIndex);
  return {
    id: `spawn:pmc:${mapKey}:${spawnIndex}:${zoneKey}`,
    mapKey,
    left: percent.left,
    top: percent.top,
  };
}
