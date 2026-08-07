/** Claves de mapa válidas para puntos fijos (alineado con ROUTE_MAPS del frontend). */
export const VALID_ROUTE_MAP_KEYS = new Set([
  'ground-zero',
  'factory',
  'customs',
  'woods',
  'shoreline',
  'interchange',
  'reserve',
  'lighthouse',
  'streets-of-tarkov',
  'the-lab',
]);

export function isValidMapKey(mapKey: string): boolean {
  return VALID_ROUTE_MAP_KEYS.has(mapKey);
}
