/** Anotaciones dibujadas sobre mapas (porcentajes sobre la imagen). */
export interface MapZoneAnnotation {
  id: string;
  mapKey: string;
  label: string;
  /** Si se define `right`, se ignora `left` (ancla a la derecha). */
  left?: number;
  right?: number;
  top: number;
  width: number;
  height: number;
}

/** Reserve — Bunker anclado a la esquina superior derecha del mapa. */
export const MAP_ZONE_ANNOTATIONS: MapZoneAnnotation[] = [
  {
    id: 'reserve-bunker',
    mapKey: 'reserve',
    label: 'Bunker',
    right: 0,
    top: 0,
    width: 28,
    height: 20,
  },
];

export function getMapZoneAnnotations(mapKey: string): MapZoneAnnotation[] {
  return MAP_ZONE_ANNOTATIONS.filter((zone) => zone.mapKey === mapKey);
}

export function mapZoneAnnotationStyle(
  zone: MapZoneAnnotation,
): { left?: string; right?: string; top: string; width: string; height: string } {
  return {
    ...(zone.right != null
      ? { right: `${zone.right}%` }
      : { left: `${zone.left ?? 0}%` }),
    top: `${zone.top}%`,
    width: `${zone.width}%`,
    height: `${zone.height}%`,
  };
}
