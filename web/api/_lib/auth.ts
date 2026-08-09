import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { resolveSiteSession } from './siteAccess.js';

export {
  createSiteSessionToken,
  getDailyAccessCode,
  getSpanishAuthDayKey,
  getSpanishAuthWeekKey,
  getWeeklyAccessCode,
  hasSiteAccessPasswords,
  isValidSiteSessionToken,
  resolveSiteLogin,
  resolveSiteSession,
  type SiteAuthKind,
} from './siteAccess.js';

function safeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function getAdminToken(): string | null {
  const token = process.env.ADMIN_TOKEN?.trim();
  return token || null;
}

export function isAuthorized(req: VercelRequest): boolean {
  const expected = getAdminToken();
  if (!expected) return false;

  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return false;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;

  const bearer = match[1];
  if (safeEqualStrings(bearer, expected)) return true;

  // Sesión de la app iniciada con ADMIN_TOKEN (HMAC), sin re-pedir la clave.
  const site = resolveSiteSession(bearer);
  return site.ok && site.kind === 'admin';
}

export function unauthorizedBody() {
  return { error: 'Unauthorized' };
}
