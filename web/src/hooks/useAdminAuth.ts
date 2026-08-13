import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getStoredSiteKind, getStoredSiteSession } from '../api/siteAuth';
import { verifyAdminToken } from '../api/fixedRoutes';
import { ADMIN_TOKEN_STORAGE_KEY } from '../types/routes';

function readStoredToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function persistToken(token: string): void {
  try {
    sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

function clearToken(): void {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Candidatos para Authorization en /admin.
 * Prioriza la sesión HMAC de la app (kind=admin): evita fallos con caracteres
 * especiales del ADMIN_TOKEN en bruto y reutiliza el login ya hecho.
 */
function readBridgeCandidates(): string[] {
  const out: string[] = [];

  try {
    if (getStoredSiteKind() === 'admin') {
      const site = getStoredSiteSession()?.trim() ?? '';
      if (site) out.push(site);
    }
  } catch {
    /* ignore */
  }

  const stored = readStoredToken().trim();
  if (stored && !out.includes(stored)) out.push(stored);

  return out;
}

export type AdminAuthStatus = 'checking' | 'locked' | 'unlocked';

export function useAdminAuth() {
  const [status, setStatus] = useState<AdminAuthStatus>('checking');
  const [token, setToken] = useState('');
  const [loginValue, setLoginValue] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const candidates = readBridgeCandidates();
      if (candidates.length === 0) {
        if (!cancelled) {
          setToken('');
          setStatus('locked');
        }
        return;
      }

      for (const candidate of candidates) {
        try {
          await verifyAdminToken(candidate);
          if (!cancelled) {
            persistToken(candidate);
            setToken(candidate);
            setStatus('unlocked');
          }
          return;
        } catch {
          // probar siguiente candidato
        }
      }

      // No borrar ADMIN_TOKEN_STORAGE_KEY si la sesión de sitio sigue siendo admin:
      // puede ser un fallo puntual; el usuario aún puede reintentar.
      if (!cancelled) {
        setToken('');
        setStatus('locked');
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    const next = loginValue.trim();
    if (!next) return;
    setLoggingIn(true);
    setLoginError(null);
    try {
      await verifyAdminToken(next);
      persistToken(next);
      setToken(next);
      setStatus('unlocked');
      setLoginValue('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'unauthorized') {
        setLoginError('Token inválido.');
      } else if (msg.includes('ADMIN_TOKEN')) {
        setLoginError(msg);
      } else {
        setLoginError(msg || 'Token inválido o ADMIN_TOKEN no configurado.');
      }
    } finally {
      setLoggingIn(false);
    }
  }, [loginValue]);

  const logout = useCallback(() => {
    clearToken();
    setToken('');
    setStatus('locked');
  }, []);

  return {
    status,
    token,
    loginValue,
    setLoginValue,
    loginError,
    loggingIn,
    login,
    logout,
  };
}
