import type { GameMap, Task } from '../types';

export const ANY_MAP_ID = '__any__';

/** Variantes de mapa que deben agruparse bajo el mapa base en la vista Activas. */
const MAP_GROUP_ALIASES: Record<string, string> = {
  'ground-zero-21': 'ground-zero',
  'ground-zero-tutorial': 'ground-zero',
};

export function getMapGroupKey(map: GameMap): string {
  return MAP_GROUP_ALIASES[map.normalizedName] ?? map.normalizedName;
}

export function getMapGroupLabel(map: GameMap): string {
  const key = getMapGroupKey(map);
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
