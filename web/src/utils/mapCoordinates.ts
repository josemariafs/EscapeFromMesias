import type { MapPosition } from '../types';
import mapProjections from '../data/mapProjections.json';

export interface MapProjectionConfig {
  transform: [number, number, number, number];
  coordinateRotation: number;
  bounds: [[number, number], [number, number]];
  svgBounds: [[number, number], [number, number]] | null;
}

const projections = mapProjections as unknown as Record<string, MapProjectionConfig>;

export function getMapProjection(normalizedName: string): MapProjectionConfig | null {
  return projections[normalizedName] ?? null;
}

function toMapLatLng(
  position: MapPosition,
  rotation: number,
): { lat: number; lng: number } {
  let lat = position.z ?? 0;
  let lng = position.x;

  if (rotation) {
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedLng = lng * cos - lat * sin;
    const rotatedLat = lng * sin + lat * cos;
    lng = rotatedLng;
    lat = rotatedLat;
  }

  return { lat, lng };
}

/** Convierte coordenadas del juego a porcentaje sobre la imagen del mapa (misma lógica que tarkov.dev). */
export function gamePositionToPercent(
  position: MapPosition,
  projection: MapProjectionConfig,
): { left: number; top: number } | null {
  const bounds = projection.svgBounds ?? projection.bounds;
  const { lat, lng } = toMapLatLng(position, projection.coordinateRotation);

  const swLng = bounds[0][0];
  const swLat = bounds[0][1];
  const neLng = bounds[1][0];
  const neLat = bounds[1][1];

  const lngSpan = neLng - swLng;
  const latSpan = neLat - swLat;
  if (lngSpan === 0 || latSpan === 0) return null;

  const left = ((lng - swLng) / lngSpan) * 100;
  const top = ((lat - swLat) / latSpan) * 100;

  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;

  return { left, top };
}
