import type { GameMap, Task } from '../types';

export const ANY_MAP_ID = '__any__';

const MAP_SVG_BASE =
  'https://raw.githubusercontent.com/the-hideout/tarkov-dev-svg-maps/main';

/** normalizedName del mapa base → archivo SVG en tarkov-dev-svg-maps */
const MAP_SVG_FILES: Record<string, string> = {
  factory: 'Factory.svg',
  customs: 'Customs.svg',
  woods: 'Woods.svg',
  lighthouse: 'Lighthouse.svg',
  shoreline: 'Shoreline.svg',
  reserve: 'Reserve.svg',
  interchange: 'Interchange.svg',
  'streets-of-tarkov': 'StreetsOfTarkov.svg',
  'the-lab': 'Labs.svg',
  'ground-zero': 'GroundZero.svg',
  terminal: 'Terminal.svg',
};

/** Mapas disponibles para el dibujador de rutas (independiente de misiones). */
export const ROUTE_MAPS: { key: string; name: string }[] = [
  { key: 'ground-zero', name: 'Ground Zero' },
  { key: 'factory', name: 'Factory' },
  { key: 'customs', name: 'Customs' },
  { key: 'woods', name: 'Woods' },
  { key: 'shoreline', name: 'Shoreline' },
  { key: 'interchange', name: 'Interchange' },
  { key: 'reserve', name: 'Reserve' },
  { key: 'lighthouse', name: 'Lighthouse' },
  { key: 'streets-of-tarkov', name: 'Streets of Tarkov' },
  { key: 'the-lab', name: 'The Lab' },
];

/**
 * Interchange: el SVG upstream apila Second_Floor (planta parcial, más pequeña)
 * encima de First_Floor. En vista plana eso hace que el interior del mall parezca
 * a escala incorrecta. Usamos una copia local con Second_Floor oculto.
 */
const LOCAL_MAP_SVG: Partial<Record<string, string>> = {
  interchange: '/maps/Interchange.svg',
};

export function getMapSvgUrl(normalizedName: string): string | null {
  const local = LOCAL_MAP_SVG[normalizedName];
  if (local) return local;
  const file = MAP_SVG_FILES[normalizedName];
  return file ? `${MAP_SVG_BASE}/${file}` : null;
}

export function getTarkovDevMapUrl(normalizedName: string): string {
  return `https://tarkov.dev/map/${normalizedName}`;
}

/** Variantes de mapa que deben agruparse bajo el mapa base en la vista Activas. */
const MAP_GROUP_ALIASES: Record<string, string> = {
  'ground-zero-21': 'ground-zero',
  'ground-zero-tutorial': 'ground-zero',
  'night-factory': 'factory',
};

/** Etiqueta mostrada para el grupo unificado (clave = normalizedName del mapa base). */
const MAP_GROUP_LABELS: Record<string, string> = {
  'factory': 'Factory',
  'ground-zero': 'Ground Zero',
};

export function getMapGroupKey(map: GameMap): string {
  return MAP_GROUP_ALIASES[map.normalizedName] ?? map.normalizedName;
}

export function getMapGroupLabel(map: GameMap): string {
  const key = getMapGroupKey(map);
  if (MAP_GROUP_LABELS[key]) return MAP_GROUP_LABELS[key];
  if (key === map.normalizedName) return map.name;
  return map.name.replace(/\s+(21\+|Tutorial)$/i, '').trim();
}

export function getTaskMaps(task: Task): GameMap[] {
  const maps = new Map<string, GameMap>();

  if (task.map) {
    maps.set(task.map.normalizedName, task.map);
  }

  for (const obj of task.objectives) {
    for (const m of obj.maps) {
      maps.set(m.normalizedName, m);
    }
    for (const zone of obj.zones ?? []) {
      maps.set(zone.map.normalizedName, zone.map);
    }
  }

  return [...maps.values()];
}

export function groupTasksByMap(
  tasks: Task[],
  anyMapLabel: string,
): { map: GameMap; tasks: Task[] }[] {
  const groups = new Map<string, { map: GameMap; tasks: Task[] }>();

  for (const task of tasks) {
    const maps = getTaskMaps(task);
    const targetMaps = maps.length > 0
      ? maps
      : [{ normalizedName: ANY_MAP_ID, name: anyMapLabel }];

    const groupKeysSeen = new Set<string>();

    for (const map of targetMaps) {
      const key = map.normalizedName === ANY_MAP_ID
        ? ANY_MAP_ID
        : getMapGroupKey(map);
      if (groupKeysSeen.has(key)) continue;
      groupKeysSeen.add(key);

      if (!groups.has(key)) {
        groups.set(key, {
          map: {
            normalizedName: key,
            name: key === ANY_MAP_ID ? anyMapLabel : getMapGroupLabel(map),
          },
          tasks: [],
        });
      }
      groups.get(key)!.tasks.push(task);
    }
  }

  return [...groups.values()]
    .sort((a, b) => {
      if (a.map.normalizedName === ANY_MAP_ID) return 1;
      if (b.map.normalizedName === ANY_MAP_ID) return -1;
      return a.map.name.localeCompare(b.map.name);
    })
    .map((group) => ({
      ...group,
      tasks: [...group.tasks].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    }));
}
