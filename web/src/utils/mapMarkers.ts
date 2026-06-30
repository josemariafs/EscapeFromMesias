import type { Task } from '../types';
import { getMapGroupKey } from './maps';
import {
  getCompletedObjectiveSet,
  getObjectiveMapGroupKeys,
} from './objectives';
import { gamePositionToPercent, getMapProjection } from './mapCoordinates';

export interface MapQuestMarker {
  id: string;
  taskId: string;
  taskName: string;
  objectiveId: string;
  objectiveDescription: string;
  left: number;
  top: number;
}

export function getMapQuestMarkers(
  mapKey: string,
  tasks: Task[],
  completedObjectives: Record<string, string[]>,
): MapQuestMarker[] {
  const projection = getMapProjection(mapKey);
  if (!projection) return [];

  const markers: MapQuestMarker[] = [];
  const seen = new Set<string>();

  for (const task of tasks) {
    const completed = getCompletedObjectiveSet(completedObjectives, task.id);

    for (const objective of task.objectives) {
      if (objective.optional || completed.has(objective.id)) continue;

      const zonesOnMap = (objective.zones ?? []).filter(
        (zone) => zone.position && getMapGroupKey(zone.map) === mapKey,
      );
      if (zonesOnMap.length === 0) continue;

      for (const zone of zonesOnMap) {
        if (!zone.position) continue;

        const dedupeKey = `${task.id}:${objective.id}:${zone.id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const percent = gamePositionToPercent(zone.position, projection);
        if (!percent) continue;

        markers.push({
          id: dedupeKey,
          taskId: task.id,
          taskName: task.name,
          objectiveId: objective.id,
          objectiveDescription: objective.description,
          left: percent.left,
          top: percent.top,
        });
      }
    }
  }

  return markers;
}

/** Misiones activas en el mapa sin ubicación conocida para objetivos pendientes. */
export function getTasksWithoutMapMarkers(
  mapKey: string,
  tasks: Task[],
  completedObjectives: Record<string, string[]>,
  markerTaskIds: Set<string>,
): Task[] {
  return tasks.filter((task) => {
    if (markerTaskIds.has(task.id)) return false;

    const completed = getCompletedObjectiveSet(completedObjectives, task.id);
    const hasPendingOnMap = task.objectives.some((obj) => {
      if (obj.optional || completed.has(obj.id)) return false;
      const keys = getObjectiveMapGroupKeys(obj);
      return keys.length === 0 || keys.includes(mapKey);
    });

    return hasPendingOnMap;
  });
}
