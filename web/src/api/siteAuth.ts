export type SiteAuthKind = 'public' | 'private' | 'mv' | 'daily' | 'daily-mv' | 'legacy' | 'admin';

export function canRevealWeeklyCode(kind: SiteAuthKind | null | undefined): boolean {
  return kind === 'public' || kind === 'mv';
}

const SITE_SESSION_KEY = 'efg-site-session';
const SITE_KIND_KEY = 'efg-site-kind';

export function getStoredSiteSession(): string | null {
  try {
    return sessionStorage.getItem(SITE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function getStoredSiteKind(): SiteAuthKind | null {
  try {
    const kind = sessionStorage.getItem(SITE_KIND_KEY);
    if (
      kind === 'public'
      || kind === 'private'
      || kind === 'mv'
      || kind === 'daily'
      || kind === 'daily-mv'
      || kind === 'legacy'
      || kind === 'admin'
    ) {
      return kind;
    }
    return null;
  } catch {
    return null;
  }
}

export function storeSiteSession(token: string, kind: SiteAuthKind): void {
  sessionStorage.setItem(SITE_SESSION_KEY, token);
  sessionStorage.setItem(SITE_KIND_KEY, kind);
}

export function clearSiteSession(): void {
  try {
    sessionStorage.removeItem(SITE_SESSION_KEY);
    sessionStorage.removeItem(SITE_KIND_KEY);
  } catch {
    // ignore
  }
}

export async function loginWithPassword(
  password: string,
): Promise<{ ok: true; kind: SiteAuthKind } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { ok: false, error: 'invalid' };
      }
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error || 'unavailable' };
    }

    const data = (await response.json()) as { token?: string; kind?: SiteAuthKind };
    if (!data.token || !data.kind) {
      return { ok: false, error: 'unavailable' };
    }

    storeSiteSession(data.token, data.kind);
    return { ok: true, kind: data.kind };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}

export async function verifySiteSession(
  token: string,
): Promise<{ ok: true; kind: SiteAuthKind } | { ok: false }> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return { ok: false };
    const data = (await response.json()) as { ok?: boolean; kind?: SiteAuthKind };
    if (data.ok !== true || !data.kind) return { ok: false };
    storeSiteSession(token, data.kind);
    return { ok: true, kind: data.kind };
  } catch {
    return { ok: false };
  }
}

export async function fetchDailyAccessCode(): Promise<
  { ok: true; code: string; dayKey: string } | { ok: false; error: string }
> {
  const token = getStoredSiteSession();
  if (!token) return { ok: false, error: 'unauthorized' };

  try {
    const response = await fetch('/api/auth/daily-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (response.status === 401) return { ok: false, error: 'unauthorized' };
    if (response.status === 403) return { ok: false, error: 'forbidden' };
    if (!response.ok) return { ok: false, error: 'unavailable' };

    const data = (await response.json()) as { code?: string; dayKey?: string };
    if (!data.code || !data.dayKey) return { ok: false, error: 'unavailable' };
    return { ok: true, code: data.code, dayKey: data.dayKey };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}
