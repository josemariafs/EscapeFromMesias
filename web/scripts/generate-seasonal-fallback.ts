/**
 * Genera snapshots offline Seasonal desde json.tarkov.dev/pvp-season
 * usando el mismo mapper que la app.
 *
 * Uso: npx tsx scripts/generate-seasonal-fallback.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTasksFromJson } from '../src/api/tarkovJson';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const lang of ['es', 'en'] as const) {
  console.log(`Fetching pvp-season tasks (${lang})…`);
  const tasks = await fetchTasksFromJson(lang, 'seasonal');
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
