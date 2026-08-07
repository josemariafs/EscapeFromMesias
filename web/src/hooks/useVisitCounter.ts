import { useEffect, useState } from 'react';
import { fetchImpressions, registerVisit } from '../api/siteStats';

const VISITOR_ID_KEY = 'efg-visitor-id';
const SESSION_COUNTED_KEY = 'efg-visit-counted';

function readOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) return existing;
    const id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    return `v_tmp_${Date.now().toString(36)}`;
  }
}

function wasCountedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_COUNTED_KEY) === '1';
  } catch {
    return false;
  }
}

function markCountedThisSession(): void {
  try {
    sessionStorage.setItem(SESSION_COUNTED_KEY, '1');
  } catch {
    // ignore
  }
}

/** Registra una impresión por sesión de usuario y expone el total desde Turso. */
export function useVisitCounter() {
  const [impressions, setImpressions] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (wasCountedThisSession()) {
          const total = await fetchImpressions();
          if (!cancelled) setImpressions(total);
          return;
        }

        const visitorId = readOrCreateVisitorId();
        const total = await registerVisit(visitorId);
        markCountedThisSession();
        if (!cancelled) setImpressions(total);
      } catch {
        try {
          const total = await fetchImpressions();
          if (!cancelled) setImpressions(total);
        } catch {
          if (!cancelled) setImpressions(null);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { impressions };
}
