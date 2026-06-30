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

/** Misma rotación que tarkov.dev (applyRotation en Map.jsx). */
function rotateLatLng(
  lat: number,
  lng: number,
  rotation: number,
): { lat: number; lng: number } {
  if (!rotation) return { lat, lng };

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotatedLng = lng * cos - lat * sin;
  const rotatedLat = lng * sin + lat * cos;
  return { lat: rotatedLat, lng: rotatedLng };
}

/** latLng → punto en el plano del mapa (CRS.Simple + transform de tarkov.dev). */
function latLngToLayerPoint(
  lat: number,
  lng: number,
  projection: MapProjectionConfig,
): { x: number; y: number } {
  const { lat: rLat, lng: rLng } = rotateLatLng(lat, lng, projection.coordinateRotation);
  const [scaleX, marginX, scaleY, marginY] = projection.transform;
  return {
    x: scaleX * rLng + marginX,
    y: scaleY * -1 * rLat + marginY,
  };
}

/** Convierte coordenadas del juego a porcentaje sobre la imagen del mapa. */
export function gamePositionToPercent(
  position: MapPosition,
  projection: MapProjectionConfig,
): { left: number; top: number } | null {
  const bounds = projection.svgBounds ?? projection.bounds;
  const lat = position.z ?? 0;
  const lng = position.x;

  const point = latLngToLayerPoint(lat, lng, projection);
  const sw = latLngToLayerPoint(bounds[0][1], bounds[0][0], projection);
  const ne = latLngToLayerPoint(bounds[1][1], bounds[1][0], projection);

  const minX = Math.min(sw.x, ne.x);
  const maxX = Math.max(sw.x, ne.x);
  const minY = Math.min(sw.y, ne.y);
  const maxY = Math.max(sw.y, ne.y);

  const xSpan = maxX - minX;
  const ySpan = maxY - minY;
  if (xSpan === 0 || ySpan === 0) return null;

  const left = ((point.x - minX) / xSpan) * 100;
  const top = ((point.y - minY) / ySpan) * 100;

  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;

  return { left, top };
}
