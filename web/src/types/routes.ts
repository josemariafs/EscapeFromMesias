/** Punto de ruta dibujado manualmente sobre un mapa (coordenadas en %). */
export interface RoutePoint {
  id: string;
  left: number;
  top: number;
  color: string;
  label?: string;
  source?: 'personal' | 'fixed';
}

export type FixedMarkerType = 'default' | 'kb' | 'question';

export const DEFAULT_FIXED_MARKER_TYPE: FixedMarkerType = 'default';

/** Icono del marcador especial KB (sin etiqueta de texto). */
export const KB_MARKER_ICON_URL = '/markers/kb-pin.png';

/** Icono del marcador de interrogación (sin etiqueta de texto). */
export const QUESTION_MARKER_ICON_URL = '/markers/question-pin.svg';

export function isIconMarkerType(markerType?: FixedMarkerType | null): boolean {
  return markerType === 'kb' || markerType === 'question';
}

export function markerTypeIconUrl(markerType?: FixedMarkerType | null): string | null {
  if (markerType === 'kb') return KB_MARKER_ICON_URL;
  if (markerType === 'question') return QUESTION_MARKER_ICON_URL;
  return null;
}

/**
 * Bucket de mapas PVP:
 * - `regular`: PVP Zone (marcadores solo en ese modo)
 * - `seasonal`: temporada + pantalla Routes (compartidos)
 */
export type RouteEnvironment = 'regular' | 'seasonal';

export const ROUTE_ENVIRONMENTS: RouteEnvironment[] = ['regular', 'seasonal'];

export function isRouteEnvironment(value: unknown): value is RouteEnvironment {
  return value === 'regular' || value === 'seasonal';
}

/** Punto fijo servido desde Turso (compartido por todos los usuarios). */
export interface FixedRoutePoint extends RoutePoint {
  source: 'fixed';
  mapKey: string;
  environment: RouteEnvironment;
  /** URL http(s) o data URL de imagen para tooltip en hover. */
  imageUrl?: string;
  /** Estilo del pin en el mapa. `kb` / `question` = icono especial sin etiqueta. */
  markerType?: FixedMarkerType;
  createdAt?: string;
  updatedAt?: string;
}

/** mapKey → puntos en orden de la ruta. */
export type RouteMapsData = Record<string, RoutePoint[]>;

/** mapKey → puntos fijos del servidor. */
export type FixedRouteMapsData = Record<string, FixedRoutePoint[]>;

/** color hex → nombre del jugador asignado a ese color. */
export type RouteColorLabels = Record<string, string>;

export const ROUTE_MAPS_STORAGE_KEY = 'efg-route-maps';
export const ROUTE_COLOR_LABELS_STORAGE_KEY = 'efg-route-color-labels';
export const ADMIN_TOKEN_STORAGE_KEY = 'efg-admin-token';

export function routeMapsStorageKey(environment: RouteEnvironment): string {
  return `${ROUTE_MAPS_STORAGE_KEY}:${environment}`;
}

export function routeColorLabelsStorageKey(environment: RouteEnvironment): string {
  return `${ROUTE_COLOR_LABELS_STORAGE_KEY}:${environment}`;
}

/** Máximo de series/colores de jugador que puede usar el usuario. */
export const MAX_ROUTE_POINT_COLORS = 5;

export const ROUTE_POINT_COLORS = [
  '#e6a817',
  '#3d8bfd',
  '#3dba6d',
  '#e85d4c',
  '#c77dff',
] as const;

export const DEFAULT_ROUTE_POINT_COLOR = ROUTE_POINT_COLORS[0];
