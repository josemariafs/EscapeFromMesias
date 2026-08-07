import type { GameMap, Task, TaskObjective } from '../types';
import { ANY_MAP_ID, getMapGroupKey, getMapGroupLabel, getTaskMaps } from './maps';

export function getCompletedObjectiveSet(
  completedObjectives: Record<string, string[]>,
  taskId: string,
): Set<string> {
  return new Set(completedObjectives[taskId] ?? []);
}

export function getObjectiveMapGroupKeys(objective: TaskObjective): string[] {
  const keys = new Set<string>();

  for (const map of objective.maps) {
    keys.add(getMapGroupKey(map));
  }

  for (const zone of objective.zones ?? []) {
    keys.add(getMapGroupKey(zone.map));
  }

  return [...keys];
}

function getTrackableObjectives(task: Task): TaskObjective[] {
  return task.objectives.filter((obj) => !obj.optional);
}

export function taskHasPendingObjectivesOnMap(
  task: Task,
  mapKey: string,
  completedObjectiveIds: Set<string>,
): boolean {
  const trackable = getTrackableObjectives(task);

  if (trackable.length === 0) {
    return true;
  }

  const pending = trackable.filter((obj) => !completedObjectiveIds.has(obj.id));
  if (pending.length === 0) {
    return false;
  }

  const taskMapKey = task.map ? getMapGroupKey(task.map) : null;

  if (mapKey === ANY_MAP_ID) {
    // Solo si no hay mapa de misión ni en los objetivos pendientes.
    if (taskMapKey) return false;
    return pending.some((obj) => getObjectiveMapGroupKeys(obj).length === 0);
  }

  return pending.some((obj) => {
    const keys = getObjectiveMapGroupKeys(obj);
    if (keys.length === 0) {
      // Objetivo sin mapas: hereda el mapa de la misión si existe.
      return taskMapKey === mapKey;
    }
    return keys.includes(mapKey);
  });
}

export function groupActiveTasksByMap(
  tasks: Task[],
  completedObjectives: Record<string, string[]>,
  anyMapLabel: string,
): { map: GameMap; tasks: Task[] }[] {
  return groupTasksByMap(tasks, anyMapLabel, {
    onlyPendingOnMap: true,
    completedObjectives,
  });
}

/** Agrupa misiones por mapa; en completadas no exige objetivos pendientes. */
export function groupTasksByMap(
  tasks: Task[],
  anyMapLabel: string,
  options?: {
    onlyPendingOnMap?: boolean;
    completedObjectives?: Record<string, string[]>;
  },
): { map: GameMap; tasks: Task[] }[] {
  const onlyPending = options?.onlyPendingOnMap === true;
  const completedObjectives = options?.completedObjectives ?? {};
  const groups = new Map<string, { map: GameMap; tasks: Task[] }>();

  for (const task of tasks) {
    const completed = getCompletedObjectiveSet(completedObjectives, task.id);
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

      if (onlyPending && !taskHasPendingObjectivesOnMap(task, key, completed)) continue;

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
