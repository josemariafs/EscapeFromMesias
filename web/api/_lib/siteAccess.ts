import { createHmac, timingSafeEqual } from 'node:crypto';

export type SiteAuthKind = 'public' | 'private' | 'daily' | 'legacy';

const SITE_SESSION_PAYLOAD = 'efg-site-access-v1';
/** Prefijo distinto al diario antiguo para invalidar códigos previos. */
const WEEKLY_CODE_PAYLOAD = 'efg-weekly-code-v1';
const MADRID_TZ = 'Europe/Madrid';
const WEEK_ROLLOVER_HOUR = 5;

function safeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getMadridParts(now: Date): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
  };
}

/** Día civil YYYY-MM-DD en Europe/Madrid. */
export function getMadridCivilDayKey(now = new Date()): string {
  const z = getMadridParts(now);
  return `${z.year}-${pad2(z.month)}-${pad2(z.day)}`;
}

export function getMadridHour(now = new Date()): number {
  return getMadridParts(now).hour;
}

/**
 * Semana de autenticación ES: lunes 05:00 Europe/Madrid.
 * Devuelve la fecha (YYYY-MM-DD) del lunes que abre la semana vigente.
 */
export function getSpanishAuthWeekKey(now = new Date()): string {
  const z = getMadridParts(now);
  let utcMidday = Date.UTC(z.year, z.month - 1, z.day, 12, 0, 0);
  // Antes de las 05:00 cuenta como el día civil anterior.
  if (z.hour < WEEK_ROLLOVER_HOUR) {
    utcMidday -= 24 * 60 * 60 * 1000;
  }

  const civil = new Date(utcMidday);
  const dayOfWeek = civil.getUTCDay(); // 0=domingo … 1=lunes …
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(utcMidday - daysFromMonday * 24 * 60 * 60 * 1000);

  return `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`;
}

/** @deprecated Usar getSpanishAuthWeekKey. */
export function getSpanishAuthDayKey(now = new Date()): string {
  return getSpanishAuthWeekKey(now);
}

function getWeeklyCodeSecret(): string | null {
  const secret =
    process.env.PERMANENT_TOKEN_PRIVATE?.trim()
    || process.env.PERMANENT_TOKEN_PUBLIC?.trim()
    || process.env.PERMANENT_TOKEN?.trim()
    || '';
  return secret || null;
}

/** Código semanal de 4 dígitos (válido hasta el lunes 05:00 Europe/Madrid). */
export function getWeeklyAccessCode(now = new Date()): string | null {
  const secret = getWeeklyCodeSecret();
  if (!secret) return null;

  const weekKey = getSpanishAuthWeekKey(now);
  const digest = createHmac('sha256', secret)
    .update(`${WEEKLY_CODE_PAYLOAD}:${weekKey}`)
    .digest();
  const num = digest.readUInt32BE(0) % 10000;
  return String(num).padStart(4, '0');
}

/** @deprecated Usar getWeeklyAccessCode. */
export function getDailyAccessCode(now = new Date()): string | null {
  return getWeeklyAccessCode(now);
}

export function createSiteSessionToken(material: string): string {
  return createHmac('sha256', material).update(SITE_SESSION_PAYLOAD).digest('hex');
}

function weeklySessionMaterial(weekKey: string, code: string): string {
  return `weekly:${weekKey}:${code}`;
}

export function getPermanentAccessEntries(): Array<{ kind: SiteAuthKind; password: string }> {
  const entries: Array<{ kind: SiteAuthKind; password: string }> = [];
  const seen = new Set<string>();

  const add = (kind: SiteAuthKind, value: string | undefined) => {
    const password = value?.trim();
    if (!password || seen.has(password)) return;
    seen.add(password);
    entries.push({ kind, password });
  };

  add('public', process.env.PERMANENT_TOKEN_PUBLIC);
  add('private', process.env.PERMANENT_TOKEN_PRIVATE);
  add('legacy', process.env.PERMANENT_TOKEN);
  return entries;
}

export function hasSiteAccessPasswords(): boolean {
  return getPermanentAccessEntries().length > 0 || Boolean(getWeeklyCodeSecret());
}

export interface SiteSessionOk {
  ok: true;
  kind: SiteAuthKind;
  token: string;
}

export interface SiteSessionFail {
  ok: false;
}

/** Login: permanent tokens o código semanal ES actual. */
export function resolveSiteLogin(
  password: string | null | undefined,
  now = new Date(),
): SiteSessionOk | SiteSessionFail {
  if (password == null) return { ok: false };

  let matched: { kind: SiteAuthKind; material: string } | null = null;

  for (const entry of getPermanentAccessEntries()) {
    if (safeEqualStrings(password, entry.password)) {
      matched = { kind: entry.kind, material: entry.password };
    }
  }

  const weekKey = getSpanishAuthWeekKey(now);
  const weekly = getWeeklyAccessCode(now);
  if (weekly && safeEqualStrings(password, weekly)) {
    // Si coincide con un permanente por azar, prevalece el permanente (matched ya set).
    if (!matched) {
      matched = { kind: 'daily', material: weeklySessionMaterial(weekKey, weekly) };
    }
  }

  if (!matched) return { ok: false };

  return {
    ok: true,
    kind: matched.kind,
    token: createSiteSessionToken(matched.material),
  };
}

export function resolveSiteSession(
  token: string | null | undefined,
  now = new Date(),
): SiteSessionOk | SiteSessionFail {
  if (!token) return { ok: false };

  let matched: SiteSessionOk | null = null;

  for (const entry of getPermanentAccessEntries()) {
    const expected = createSiteSessionToken(entry.password);
    if (safeEqualStrings(token, expected)) {
      matched = { ok: true, kind: entry.kind, token: expected };
    }
  }

  const weekKey = getSpanishAuthWeekKey(now);
  const weekly = getWeeklyAccessCode(now);
  if (weekly) {
    const expected = createSiteSessionToken(weeklySessionMaterial(weekKey, weekly));
    if (safeEqualStrings(token, expected)) {
      matched = { ok: true, kind: 'daily', token: expected };
    }
  }

  return matched ?? { ok: false };
}

export function isValidSiteSessionToken(token: string | null | undefined, now = new Date()): boolean {
  return resolveSiteSession(token, now).ok;
}
