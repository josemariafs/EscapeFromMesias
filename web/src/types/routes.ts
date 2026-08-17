/** Punto de ruta dibujado manualmente sobre un mapa (coordenadas en %). */
export interface RoutePoint {
  id: string;
  left: number;
  top: number;
  color: string;
  label?: string;
  source?: 'personal' | 'fixed';
}

/** Flecha dibujada a mano (clic + arrastre) sobre un mapa, coordenadas en %. */
export interface RouteArrow {
  id: string;
  fromLeft: number;
  fromTop: number;
  toLeft: number;
  toTop: number;
  color: string;
}

/** Preview de flecha mientras se arrastra. */
export type RouteArrowDraft = Omit<RouteArrow, 'id'>;

export type FixedMarkerType = 'default' | 'kb-document' | 'kb-underground' | 'question';

export const DEFAULT_FIXED_MARKER_TYPE: FixedMarkerType = 'default';

/** Icono del marcador Key Document. */
export const KB_MARKER_ICON_URL = '/markers/kb-pin.png';

/** Icono del marcador Key Document en subterráneo. */
export const KB_UNDERGROUND_MARKER_ICON_URL = '/markers/kb-underground-pin.png';

/** Icono del marcador de interrogación (sin etiqueta de texto). */
export const QUESTION_MARKER_ICON_URL = '/markers/question-pin.svg';

/** Pin con icono propio (sin número/texto sobre el mapa). */
export function isIconMarkerType(markerType?: FixedMarkerType | string | null): boolean {
  return (
    markerType === 'kb'
    || markerType === 'kb-document'
    || markerType === 'kb-underground'
    || markerType === 'question'
  );
}

/** Tipos que no guardan label (solo icono + imagen opcional). */
export function isLabellessMarkerType(markerType?: FixedMarkerType | string | null): boolean {
  return markerType === 'question';
}

export function allowsFixedPointLabel(markerType?: FixedMarkerType | string | null): boolean {
  return !isLabellessMarkerType(markerType);
}

/** Key Document: pin KB + label opcional encima de la imagen. */
export function isKeyDocumentMarkerType(markerType?: FixedMarkerType | string | null): boolean {
  return markerType === 'kb' || markerType === 'kb-document' || markerType === 'kb-underground';
}

export function isUndergroundKeyDocumentMarkerType(
  markerType?: FixedMarkerType | string | null,
): boolean {
  return markerType === 'kb-underground';
}

export function markerTypeIconUrl(markerType?: FixedMarkerType | string | null): string | null {
  if (isUndergroundKeyDocumentMarkerType(markerType)) return KB_UNDERGROUND_MARKER_ICON_URL;
  if (isKeyDocumentMarkerType(markerType)) return KB_MARKER_ICON_URL;
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
  /** El listado público omite `imageUrl`; este flag indica que hay captura. */
  hasImage?: boolean;
  /**
   * Estilo del pin en el mapa.
   * - `kb-document` (Key Document): icono KB + label encima de la imagen
   * - `kb-underground`: mismo comportamiento, icono KB de subterráneo
   * - `question`: icono ? sin label
   */
  markerType?: FixedMarkerType;
  createdAt?: string;
  updatedAt?: string;
}

/** mapKey → puntos en orden de la ruta. */
export type RouteMapsData = Record<string, RoutePoint[]>;

/** mapKey → flechas dibujadas a mano. */
export type RouteArrowsData = Record<string, RouteArrow[]>;

/** mapKey → puntos fijos del servidor. */
export type FixedRouteMapsData = Record<string, FixedRoutePoint[]>;

/** color hex → nombre del jugador asignado a ese color. */
export type RouteColorLabels = Record<string, string>;

export const ROUTE_MAPS_STORAGE_KEY = 'efg-route-maps';
export const ROUTE_ARROWS_STORAGE_KEY = 'efg-route-arrows';
export const ROUTE_COLOR_LABELS_STORAGE_KEY = 'efg-route-color-labels';
export const ADMIN_TOKEN_STORAGE_KEY = 'efg-admin-token';

export function routeMapsStorageKey(environment: RouteEnvironment): string {
  return `${ROUTE_MAPS_STORAGE_KEY}:${environment}`;
}

export function routeArrowsStorageKey(environment: RouteEnvironment): string {
  return `${ROUTE_ARROWS_STORAGE_KEY}:${environment}`;
}

export function routeColorLabelsStorageKey(environment: RouteEnvironment): string {
  return `${ROUTE_COLOR_LABELS_STORAGE_KEY}:${environment}`;
}

/** Máximo de series/colores de jugador que puede usar el usuario. */
export const MAX_ROUTE_POINT_COLORS = 5;

export const ROUTE_POINT_COLORS = [
  '#e6a817',
  '#6ec4b6',
  '#3dba6d',
  '#e85d4c',
  '#c77dff',
] as const;

export const DEFAULT_ROUTE_POINT_COLOR = ROUTE_POINT_COLORS[0];

export function pointHasImage(point: Pick<FixedRoutePoint, 'imageUrl' | 'hasImage'>): boolean {
  return Boolean(point.imageUrl) || Boolean(point.hasImage);
}
