/**
 * Extrae un overlay compacto de zonas con posición desde el fallback seasonal.
 * La API live a menudo deja zones[] vacío; este archivo alimenta enrichTasksWithZoneOverlay.
 *
 * Uso: node scripts/generate-task-zones-overlay.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const seasonal = JSON.parse(
  readFileSync(join(ROOT, 'src/data/tasks-fallback-seasonal-en.json'), 'utf8'),
);

const objectives = {};
let zoneCount = 0;

for (const task of seasonal.tasks) {
  for (const objective of task.objectives ?? []) {
    const zones = (objective.zones ?? []).filter(
      (z) => z?.position && Number.isFinite(z.position.x),
    );
    if (zones.length === 0) continue;
    zoneCount += zones.length;
    objectives[objective.id] = {
      zones: zones.map((z) => ({
        id: z.id,
        map: {
          normalizedName: z.map.normalizedName,
          name: z.map.name,
        },
        position: z.position,
      })),
      maps: (objective.maps ?? []).map((m) => ({
        normalizedName: m.normalizedName,
        name: m.name,
      })),
    };
  }
}

const out = {
  source: 'tasks-fallback-seasonal-en.json',
  fetchedAt: seasonal.fetchedAt ?? new Date().toISOString(),
  note:
    'Zonas con posición para enriquecer misiones cuando json.tarkov.dev deja zones vacío.',
  objectives,
};

const path = join(ROOT, 'src/data/task-zones-overlay.json');
writeFileSync(path, JSON.stringify(out));
console.log(
  `Wrote ${path} (${Object.keys(objectives).length} objectives, ${zoneCount} zones)`,
);
