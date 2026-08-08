import { GAME_MODES, progressStorageKey, type PlayerProgress } from '../types';
import {
  ROUTE_ENVIRONMENTS,
  ROUTE_MAPS_STORAGE_KEY,
  routeMapsStorageKey,
  type RouteMapsData,
  type RoutePoint,
} from '../types/routes';
import { rotateMapPercentCCW90 } from './mapCoordinates';

/** Una sola vez: adapta % guardados tras rotar el SVG de Streets of Tarkov 90° a la izquierda. */
export const STREETS_OF_TARKOV_MAP_ROTATION_FLAG = 'efg-map-rot:streets-of-tarkov:ccw90';

const MAP_KEY = 'streets-of-tarkov';

function rotatePoint<T extends { left: number; top: number }>(point: T): T {
  const next = rotateMapPercentCCW90(point.left, point.top);
  return { ...point, left: next.left, top: next.top };
}

function migrateRouteBucket(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as RouteMapsData;
    const points = data[MAP_KEY];
    if (!Array.isArray(points) || points.length === 0) return null;
    const next: RouteMapsData = {
      ...data,
      [MAP_KEY]: points.map((p: RoutePoint) => rotatePoint(p)),
    };
    return JSON.stringify(next);
  } catch {
    return null;
  }
}

function migrateProgressBucket(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const progress = JSON.parse(raw) as PlayerProgress;
    const pins = progress.customMapMarkers?.[MAP_KEY];
    if (!pins || Object.keys(pins).length === 0) return null;
    const nextPins = Object.fromEntries(
      Object.entries(pins).map(([taskId, pin]) => [taskId, rotatePoint(pin)]),
    );
    const next: PlayerProgress = {
      ...progress,
      customMapMarkers: {
        ...progress.customMapMarkers,
        [MAP_KEY]: nextPins,
      },
    };
    return JSON.stringify(next);
  } catch {
    return null;
  }
}

/** Migra localStorage (rutas personales + pins custom). Idempotente vía flag. */
export function migrateStreetsOfTarkovLocalMarkers(): void {
  try {
    if (localStorage.getItem(STREETS_OF_TARKOV_MAP_ROTATION_FLAG) === '1') return;

    for (const env of ROUTE_ENVIRONMENTS) {
      const key = routeMapsStorageKey(env);
      const migrated = migrateRouteBucket(localStorage.getItem(key));
      if (migrated) localStorage.setItem(key, migrated);
    }

    const legacyRoutes = migrateRouteBucket(localStorage.getItem(ROUTE_MAPS_STORAGE_KEY));
    if (legacyRoutes) localStorage.setItem(ROUTE_MAPS_STORAGE_KEY, legacyRoutes);

    for (const mode of GAME_MODES) {
      const key = progressStorageKey(mode);
      const migrated = migrateProgressBucket(localStorage.getItem(key));
      if (migrated) localStorage.setItem(key, migrated);
    }

    localStorage.setItem(STREETS_OF_TARKOV_MAP_ROTATION_FLAG, '1');
  } catch {
    // ignore quota / private mode
  }
}
