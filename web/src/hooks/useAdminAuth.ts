import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
      const stored = readStoredToken();
      if (!stored) {
        if (!cancelled) {
          setToken('');
          setStatus('locked');
        }
        return;
      }

      try {
        await verifyAdminToken(stored);
        if (!cancelled) {
          setToken(stored);
          setStatus('unlocked');
        }
      } catch {
        clearToken();
        if (!cancelled) {
          setToken('');
          setStatus('locked');
        }
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
    } catch {
      setLoginError('Token inválido o ADMIN_TOKEN no configurado.');
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
