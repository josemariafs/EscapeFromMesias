import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureSchema, getDb } from '../api/_lib/db.ts';
import { purgeUnclassifiedUsageEvents } from '../api/_lib/usageLogs.ts';

function loadEnvFile(file: string): void {
  try {
    const text = readFileSync(resolve(file), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.trimStart().startsWith('#')) continue;
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // optional file
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

await ensureSchema();
const result = await purgeUnclassifiedUsageEvents();
const db = getDb();
const remaining = await db.execute({
  sql: 'SELECT COUNT(*) AS n FROM usage_events',
  args: [],
});
const unclassified = await db.execute({
  sql: `SELECT COUNT(*) AS n FROM usage_events
        WHERE access_kind IS NULL OR TRIM(access_kind) = ''`,
  args: [],
});

console.log(
  JSON.stringify(
    {
      deleted: result.deleted,
      remaining: remaining.rows[0],
      unclassifiedLeft: unclassified.rows[0],
    },
    null,
    2,
  ),
);
