import type { VercelRequest } from '@vercel/node';

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

  return match[1] === expected;
}

export function unauthorizedBody() {
  return { error: 'Unauthorized' };
}
