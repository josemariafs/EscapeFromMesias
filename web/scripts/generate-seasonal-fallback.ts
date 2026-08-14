/**
 * Genera snapshots offline Seasonal desde json.tarkov.dev/pvp-season
 * usando el mismo mapper que la app.
 *
 * Si la API deja zones vacío, conserva las del snapshot anterior / overlay.
 *
 * Uso: npx tsx scripts/generate-seasonal-fallback.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTasksFromJson } from '../src/api/tarkovJson';
import { enrichTasksWithZoneOverlay, type TaskZonesOverlay } from '../src/utils/enrichTaskZones';
import type { Task } from '../src/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function overlayFromTasks(tasks: Task[]): TaskZonesOverlay {
  const objectives: TaskZonesOverlay['objectives'] = {};
  for (const task of tasks) {
    for (const objective of task.objectives) {
      const zones = (objective.zones ?? []).filter(
        (z) => z.position && Number.isFinite(z.position.x),
      );
      if (zones.length === 0) continue;
      objectives[objective.id] = {
        zones,
        maps: objective.maps,
      };
    }
  }
  return { objectives };
}

function loadPreviousZones(lang: 'es' | 'en'): TaskZonesOverlay {
  const overlayPath = join(ROOT, 'src', 'data', 'task-zones-overlay.json');
  const prevPath = join(ROOT, 'src', 'data', `tasks-fallback-seasonal-${lang}.json`);
  let overlay: TaskZonesOverlay = { objectives: {} };

  if (existsSync(overlayPath)) {
    overlay = JSON.parse(readFileSync(overlayPath, 'utf8')) as TaskZonesOverlay;
  }

  if (existsSync(prevPath)) {
    const prev = JSON.parse(readFileSync(prevPath, 'utf8')) as { tasks: Task[] };
    const fromPrev = overlayFromTasks(prev.tasks ?? []);
    overlay = {
      objectives: { ...overlay.objectives, ...fromPrev.objectives },
    };
  }

  return overlay;
}

for (const lang of ['es', 'en'] as const) {
  console.log(`Fetching pvp-season tasks (${lang})…`);
  const live = await fetchTasksFromJson(lang, 'seasonal');
  const preserved = loadPreviousZones(lang);
  const tasks = enrichTasksWithZoneOverlay(live, preserved);
  const out = {
    source: 'https://json.tarkov.dev/pvp-season/tasks',
    gameMode: 'seasonal' as const,
    fetchedAt: new Date().toISOString(),
    note: 'Snapshot Kord Breach / PVP Seasonal (json.tarkov.dev pvp-season) para fallback offline.',
    lang,
    tasks,
  };
  const path = join(ROOT, 'src', 'data', `tasks-fallback-seasonal-${lang}.json`);
  writeFileSync(path, JSON.stringify(out));
  console.log(`Wrote ${path} (${tasks.length} tasks, ${(Buffer.byteLength(JSON.stringify(out)) / 1024 / 1024).toFixed(2)} MB)`);
}
