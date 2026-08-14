import type { GameMap, Task, TaskObjective, TaskZone } from '../types';

export interface TaskZonesOverlay {
  fetchedAt?: string;
  note?: string;
  objectives: Record<
    string,
    {
      zones: TaskZone[];
      maps?: GameMap[];
    }
  >;
}

function hasUsableZones(zones: TaskZone[] | undefined): boolean {
  return (zones ?? []).some(
    (zone) =>
      zone.position != null
      && Number.isFinite(zone.position.x)
      && Number.isFinite(zone.position.z ?? zone.position.y),
  );
}

function mapsFromZones(zones: TaskZone[]): GameMap[] {
  const byKey = new Map<string, GameMap>();
  for (const zone of zones) {
    if (!zone.map?.normalizedName) continue;
    byKey.set(zone.map.normalizedName, zone.map);
  }
  return [...byKey.values()];
}

/**
 * La API de tarkov.dev a menudo deja `zones`/`maps` vacíos en plantItem y similares,
 * aunque existan coordenadas conocidas. Rellena desde un overlay local por objective.id.
 */
export function enrichTasksWithZoneOverlay(
  tasks: Task[],
  overlay: TaskZonesOverlay | null | undefined,
): Task[] {
  const bank = overlay?.objectives;
  if (!bank || Object.keys(bank).length === 0) return tasks;

  let changed = false;

  const next = tasks.map((task) => {
    let taskChanged = false;
    const objectives = task.objectives.map((objective) => {
      if (hasUsableZones(objective.zones)) return objective;

      const entry = bank[objective.id];
      if (!entry || !hasUsableZones(entry.zones)) return objective;

      taskChanged = true;
      const maps =
        objective.maps.length > 0
          ? objective.maps
          : (entry.maps?.length ? entry.maps : mapsFromZones(entry.zones));

      const enriched: TaskObjective = {
        ...objective,
        zones: entry.zones,
        maps,
      };
      return enriched;
    });

    if (!taskChanged) return task;
    changed = true;
    return { ...task, objectives };
  });

  return changed ? next : tasks;
}
