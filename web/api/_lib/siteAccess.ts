import { createHmac, timingSafeEqual } from 'node:crypto';

export type SiteAuthKind = 'public' | 'private' | 'mv' | 'daily' | 'daily-mv' | 'legacy' | 'admin';
export type WeeklyAudience = 'public' | 'mv';

const SITE_SESSION_PAYLOAD = 'efg-site-access-v1';
/** v2: códigos independientes por audiencia (PUBLIC / MV). */
const WEEKLY_CODE_PAYLOAD = 'efg-weekly-code-v2';
const ADMIN_SESSION_PREFIX = 'admin:';
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

function getWeeklyAudienceSecret(audience: WeeklyAudience): string | null {
  const secret = audience === 'public'
    ? process.env.PERMANENT_TOKEN_PUBLIC?.trim()
    : process.env.PERMANENT_TOKEN_MV?.trim();
  return secret || null;
}

function deriveWeeklyDigits(secret: string, weekKey: string, domain: string): string {
  const digest = createHmac('sha256', secret)
    .update(`${WEEKLY_CODE_PAYLOAD}:${domain}:${weekKey}`)
    .digest();
  return String(digest.readUInt32BE(0) % 10000).padStart(4, '0');
}

/** Código semanal de 4 dígitos por audiencia (válido hasta el lunes 05:00 Europe/Madrid). */
export function getWeeklyAccessCode(audience: WeeklyAudience, now = new Date()): string | null {
  const secret = getWeeklyAudienceSecret(audience);
  if (!secret) return null;

  const weekKey = getSpanishAuthWeekKey(now);
  const code = deriveWeeklyDigits(secret, weekKey, audience);
  if (audience !== 'mv') return code;

  const publicSecret = getWeeklyAudienceSecret('public');
  if (!publicSecret) return code;

  const publicCode = deriveWeeklyDigits(publicSecret, weekKey, 'public');
  if (code !== publicCode) return code;

  for (let n = 1; n < 10000; n += 1) {
    const retry = deriveWeeklyDigits(secret, weekKey, `mv:collision:${n}`);
    if (retry !== publicCode) return retry;
  }
  return null;
}

/** Código que una sesión permanente puede revelar. Weekly / private / admin → null. */
export function getRevealableWeeklyCode(
  kind: SiteAuthKind | null | undefined,
  now = new Date(),
): string | null {
  if (kind === 'public') return getWeeklyAccessCode('public', now);
  if (kind === 'mv') return getWeeklyAccessCode('mv', now);
  return null;
}

/** @deprecated Usar getWeeklyAccessCode('public'). */
export function getDailyAccessCode(now = new Date()): string | null {
  return getWeeklyAccessCode('public', now);
}

export function createSiteSessionToken(material: string): string {
  return createHmac('sha256', material).update(SITE_SESSION_PAYLOAD).digest('hex');
}

function weeklySessionMaterial(audience: WeeklyAudience, weekKey: string, code: string): string {
  return `weekly:v2:${audience}:${weekKey}:${code}`;
}

function weeklyKind(audience: WeeklyAudience): SiteAuthKind {
  return audience === 'public' ? 'daily' : 'daily-mv';
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
  add('mv', process.env.PERMANENT_TOKEN_MV);
  add('legacy', process.env.PERMANENT_TOKEN);
  return entries;
}

function getAdminAccessPassword(): string | null {
  const token = process.env.ADMIN_TOKEN?.trim();
  return token || null;
}

function adminSessionMaterial(password: string): string {
  return `${ADMIN_SESSION_PREFIX}${password}`;
}

/** Solo tokens permanentes public/mv revelan su código; weekly/private/admin/legacy no. */
export function canRevealWeeklyCode(kind: SiteAuthKind | null | undefined): boolean {
  return kind === 'public' || kind === 'mv';
}

export function hasSiteAccessPasswords(): boolean {
  return (
    getPermanentAccessEntries().length > 0
    || Boolean(getWeeklyAudienceSecret('public'))
    || Boolean(getWeeklyAudienceSecret('mv'))
    || Boolean(getAdminAccessPassword())
  );
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
  const candidate = password.trim();
  if (!candidate) return { ok: false };

  let matched: { kind: SiteAuthKind; material: string } | null = null;

  for (const entry of getPermanentAccessEntries()) {
    if (safeEqualStrings(candidate, entry.password)) {
      matched = { kind: entry.kind, material: entry.password };
    }
  }

  const weekKey = getSpanishAuthWeekKey(now);
  if (!matched) {
    const audiences: WeeklyAudience[] = ['public', 'mv'];
    for (const audience of audiences) {
      const weekly = getWeeklyAccessCode(audience, now);
      if (weekly && safeEqualStrings(candidate, weekly)) {
        matched = {
          kind: weeklyKind(audience),
          material: weeklySessionMaterial(audience, weekKey, weekly),
        };
        break;
      }
    }
  }

  const adminPassword = getAdminAccessPassword();
  if (adminPassword && safeEqualStrings(candidate, adminPassword)) {
    // ADMIN_TOKEN prevalece si coincide con otra clave.
    matched = { kind: 'admin', material: adminSessionMaterial(adminPassword) };
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

  if (!matched) {
    const weekKey = getSpanishAuthWeekKey(now);
    const audiences: WeeklyAudience[] = ['public', 'mv'];
    for (const audience of audiences) {
      const weekly = getWeeklyAccessCode(audience, now);
      if (!weekly) continue;
      const expected = createSiteSessionToken(weeklySessionMaterial(audience, weekKey, weekly));
      if (safeEqualStrings(token, expected)) {
        matched = { ok: true, kind: weeklyKind(audience), token: expected };
        break;
      }
    }
  }

  const adminPassword = getAdminAccessPassword();
  if (adminPassword) {
    const expected = createSiteSessionToken(adminSessionMaterial(adminPassword));
    if (safeEqualStrings(token, expected)) {
      matched = { ok: true, kind: 'admin', token: expected };
    }
  }

  return matched ?? { ok: false };
}

export function isValidSiteSessionToken(token: string | null | undefined, now = new Date()): boolean {
  return resolveSiteSession(token, now).ok;
}
