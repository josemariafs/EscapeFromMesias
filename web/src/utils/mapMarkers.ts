import type { CustomMapMarkers, Task, Trader } from '../types';
import { getMapGroupKey, getMapGroupLabel, getMapSvgUrl, ROUTE_MAPS } from './maps';
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
  trader: Trader;
  left: number;
  top: number;
  custom?: boolean;
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
          trader: task.trader,
          left: percent.left,
          top: percent.top,
        });
      }
    }
  }

  return markers;
}

export function getCustomMapMarkers(
  mapKey: string,
  tasks: Task[],
  customMapMarkers: CustomMapMarkers,
  completedObjectives: Record<string, string[]>,
  excludeTaskIds: Set<string>,
): MapQuestMarker[] {
  const mapPins = customMapMarkers[mapKey];
  if (!mapPins) return [];

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const markers: MapQuestMarker[] = [];

  for (const [taskId, pin] of Object.entries(mapPins)) {
    if (excludeTaskIds.has(taskId)) continue;

    const task = tasksById.get(taskId);
    if (!task) continue;

    const completed = getCompletedObjectiveSet(completedObjectives, taskId);
    const hasPendingOnMap = task.objectives.some((obj) => {
      if (obj.optional || completed.has(obj.id)) return false;
      const keys = getObjectiveMapGroupKeys(obj);
      return keys.length === 0 || keys.includes(mapKey);
    });
    if (!hasPendingOnMap) continue;

    markers.push({
      id: `custom:${taskId}`,
      taskId,
      taskName: task.name,
      objectiveId: 'custom',
      objectiveDescription: '',
      trader: task.trader,
      left: pin.left,
      top: pin.top,
      custom: true,
    });
  }

  return markers;
}

export function getAllMapMarkers(
  mapKey: string,
  tasks: Task[],
  completedObjectives: Record<string, string[]>,
  customMapMarkers: CustomMapMarkers = {},
): MapQuestMarker[] {
  const apiMarkers = getMapQuestMarkers(mapKey, tasks, completedObjectives);
  const apiTaskIds = new Set(apiMarkers.map((marker) => marker.taskId));
  const customMarkers = getCustomMapMarkers(
    mapKey,
    tasks,
    customMapMarkers,
    completedObjectives,
    apiTaskIds,
  );
  return [...apiMarkers, ...customMarkers];
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

export interface TaskMapLocationMarker {
  id: string;
  left: number;
  top: number;
  objectiveDescription: string;
  custom?: boolean;
}

export interface TaskMapLocation {
  mapKey: string;
  mapName: string;
  markers: TaskMapLocationMarker[];
}

/** Ubicaciones en mapa (API + pins manuales) para una misión concreta. */
export function getTaskMapLocations(
  task: Task,
  customMapMarkers: CustomMapMarkers = {},
): TaskMapLocation[] {
  const byMap = new Map<string, TaskMapLocation>();

  const ensureMap = (mapKey: string, mapName: string): TaskMapLocation => {
    const existing = byMap.get(mapKey);
    if (existing) return existing;
    const created: TaskMapLocation = { mapKey, mapName, markers: [] };
    byMap.set(mapKey, created);
    return created;
  };

  for (const objective of task.objectives) {
    for (const zone of objective.zones ?? []) {
      if (!zone.position) continue;
      const mapKey = getMapGroupKey(zone.map);
      const projection = getMapProjection(mapKey);
      if (!projection) continue;
      const percent = gamePositionToPercent(zone.position, projection);
      if (!percent) continue;

      const group = ensureMap(mapKey, getMapGroupLabel(zone.map));
      const id = `${task.id}:${objective.id}:${zone.id}`;
      if (group.markers.some((m) => m.id === id)) continue;
      group.markers.push({
        id,
        left: percent.left,
        top: percent.top,
        objectiveDescription: objective.description,
      });
    }
  }

  for (const [mapKey, pins] of Object.entries(customMapMarkers)) {
    const pin = pins?.[task.id];
    if (!pin) continue;
    if (!getMapSvgUrl(mapKey)) continue;
    const knownName = ROUTE_MAPS.find((m) => m.key === mapKey)?.name ?? mapKey;
    const group = ensureMap(mapKey, knownName);
    for (const objective of task.objectives) {
      for (const map of objective.maps) {
        if (getMapGroupKey(map) === mapKey) {
          group.mapName = getMapGroupLabel(map);
          break;
        }
      }
    }
    const id = `custom:${task.id}:${mapKey}`;
    if (group.markers.some((m) => m.id === id || m.custom)) continue;
    group.markers.push({
      id,
      left: pin.left,
      top: pin.top,
      objectiveDescription: '',
      custom: true,
    });
  }

  return [...byMap.values()].filter((entry) => entry.markers.length > 0);
}

