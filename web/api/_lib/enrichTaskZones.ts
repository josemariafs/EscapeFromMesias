import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameMap, Task, TaskObjective, TaskZone } from './eftTypes.js';

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

let cachedOverlay: TaskZonesOverlay | null = null;

function loadOverlay(): TaskZonesOverlay {
  if (cachedOverlay) return cachedOverlay;

  const candidates = [
    join(process.cwd(), 'src/data/task-zones-overlay.json'),
    join(process.cwd(), 'web/src/data/task-zones-overlay.json'),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      cachedOverlay = JSON.parse(readFileSync(path, 'utf8')) as TaskZonesOverlay;
      return cachedOverlay;
    } catch {
      // probar siguiente ruta
    }
  }

  cachedOverlay = { objectives: {} };
  return cachedOverlay;
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

/** Rellena zones vacías desde el overlay empaquetado (API live a menudo las omite). */
export function enrichTasksWithZoneOverlay(tasks: Task[]): Task[] {
  const objectives = loadOverlay().objectives;
  if (!objectives || Object.keys(objectives).length === 0) return tasks;

  let changed = false;

  const next = tasks.map((task) => {
    let taskChanged = false;
    const mapped = task.objectives.map((objective) => {
      if (hasUsableZones(objective.zones)) return objective;

      const entry = objectives[objective.id];
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
    return { ...task, objectives: mapped };
  });

  return changed ? next : tasks;
}
