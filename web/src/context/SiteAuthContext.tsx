import { createContext, useContext, type ReactNode } from 'react';
import type { SiteAuthKind } from '../api/siteAuth';
import { useSiteAuth } from '../hooks/useSiteAuth';
import { LoginScreen } from '../components/LoginScreen';

interface SiteAuthContextValue {
  kind: SiteAuthKind | null;
  canRevealDailyCode: boolean;
}

const SiteAuthContext = createContext<SiteAuthContextValue>({
  kind: null,
  canRevealDailyCode: false,
});

export function useSiteAuthContext(): SiteAuthContextValue {
  return useContext(SiteAuthContext);
}

interface SiteAuthGateProps {
  children: ReactNode;
}

export function SiteAuthGate({ children }: SiteAuthGateProps) {
  const { status, kind, canRevealDailyCode, error, failCount, submitting, login } = useSiteAuth();

  if (status === 'checking') {
    return (
      <div className="tv-login tv-login--booting">
        <div className="tv-login-scanlines" aria-hidden />
        <div className="tv-login-vignette" aria-hidden />
        <p className="tv-login-boot">SYNCING CHANNEL…</p>
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <LoginScreen
        error={error}
        failCount={failCount}
        submitting={submitting}
        onSubmit={login}
      />
    );
  }

  return (
    <SiteAuthContext.Provider value={{ kind, canRevealDailyCode }}>
      {children}
    </SiteAuthContext.Provider>
  );
}
