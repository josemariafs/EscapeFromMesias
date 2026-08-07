/**
 * Resuelve la versión del footer.
 * En Vercel Production: incrementa el patch (último dígito) en Turso.
 * En local / preview: no incrementa (local = package.json; preview = último patch en Turso).
 */
import { createClient } from '@libsql/client';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outPath = join(root, 'src', 'generated', 'app-version.json');
const STATS_KEY = 'app_version_patch';
const LEGACY_MINOR_KEY = 'app_version_minor';

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version || '0.0.0'));
  if (!match) return { major: 0, minor: 0, patch: 0 };
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function loadEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(join(root, name), 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      // optional
    }
  }
}

async function resolvePatchFromTurso({ increment }) {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not configured');
  }

  const db = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS site_stats (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    )
  `);

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const base = parseSemver(pkg.version);

  const existing = await db.execute({
    sql: `SELECT value FROM site_stats WHERE key = ?`,
    args: [STATS_KEY],
  });

  if (existing.rows.length === 0) {
    // Migrar el contador antiguo (minor) → patch sin volver a incrementar en el mismo deploy.
    const legacy = await db.execute({
      sql: `SELECT value FROM site_stats WHERE key = ?`,
      args: [LEGACY_MINOR_KEY],
    });
    const legacyValue = Number(legacy.rows[0]?.value);
    const migratedFromLegacy = Number.isFinite(legacyValue);
    const seed = migratedFromLegacy ? legacyValue : base.patch;

    await db.execute({
      sql: `INSERT INTO site_stats (key, value) VALUES (?, ?)`,
      args: [STATS_KEY, seed],
    });

    if (increment && !migratedFromLegacy) {
      await db.execute({
        sql: `UPDATE site_stats SET value = value + 1 WHERE key = ?`,
        args: [STATS_KEY],
      });
    }
  } else if (increment) {
    await db.execute({
      sql: `UPDATE site_stats SET value = value + 1 WHERE key = ?`,
      args: [STATS_KEY],
    });
  }

  const result = await db.execute({
    sql: `SELECT value FROM site_stats WHERE key = ?`,
    args: [STATS_KEY],
  });

  const value = Number(result.rows[0]?.value ?? base.patch);
  return Number.isFinite(value) ? value : base.patch;
}

async function main() {
  loadEnvFiles();

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const base = parseSemver(pkg.version);
  const onVercel = process.env.VERCEL === '1';
  const isProduction = process.env.VERCEL_ENV === 'production';

  let patch = base.patch;
  let source = 'package.json';

  if (onVercel) {
    try {
      patch = await resolvePatchFromTurso({ increment: isProduction });
      source = isProduction ? 'turso+increment' : 'turso';
    } catch (err) {
      console.warn(
        '[resolve-app-version] Turso unavailable, falling back to package.json:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const version = `${base.major}.${base.minor}.${patch}`;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify({
      version,
      major: base.major,
      minor: base.minor,
      patch,
      source,
    }, null, 2)}\n`,
  );

  console.log(`[resolve-app-version] v${version} (${source})`);
}

main().catch((err) => {
  console.error('[resolve-app-version] failed:', err);
  process.exit(1);
});
