import { useCallback, useEffect, useState } from 'react';
import {
  clearSiteSession,
  getStoredSiteKind,
  getStoredSiteSession,
  loginWithPassword,
  verifySiteSession,
  type SiteAuthKind,
} from '../api/siteAuth';
import { ADMIN_TOKEN_STORAGE_KEY } from '../types/routes';

type AuthStatus = 'checking' | 'locked' | 'unlocked';
type AuthError = 'invalid' | 'unavailable' | null;

export function useSiteAuth() {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [kind, setKind] = useState<SiteAuthKind | null>(null);
  const [error, setError] = useState<AuthError>(null);
  const [failCount, setFailCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = getStoredSiteSession();
      if (!token) {
        if (!cancelled) {
          setKind(null);
          setStatus('locked');
        }
        return;
      }

      const result = await verifySiteSession(token);
      if (cancelled) return;

      if (result.ok) {
        setKind(result.kind);
        setStatus('unlocked');
      } else {
        clearSiteSession();
        setKind(null);
        setStatus('locked');
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (password: string) => {
    setSubmitting(true);
    setError(null);

    const result = await loginWithPassword(password);
    setSubmitting(false);

    if (result.ok) {
      setError(null);
      setKind(result.kind);
      setStatus('unlocked');
      // Misma clave sirve para /admin sin volver a pedirla.
      if (result.kind === 'admin') {
        try {
          sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, password);
        } catch {
          // ignore
        }
      }
      return true;
    }

    setError(result.error === 'unavailable' ? 'unavailable' : 'invalid');
    setFailCount((n) => n + 1);
    setKind(null);
    setStatus('locked');
    return false;
  }, []);

  return {
    status,
    kind: kind ?? getStoredSiteKind(),
    canRevealDailyCode: (kind ?? getStoredSiteKind()) === 'public',
    error,
    failCount,
    submitting,
    login,
  };
}
