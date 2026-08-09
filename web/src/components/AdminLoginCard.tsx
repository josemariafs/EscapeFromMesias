import type { FormEvent } from 'react';

interface AdminLoginCardProps {
  title: string;
  subtitle?: string;
  loginValue: string;
  onLoginValueChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  loggingIn: boolean;
  error: string | null;
}

export function AdminLoginCard({
  title,
  subtitle,
  loginValue,
  onLoginValueChange,
  onSubmit,
  loggingIn,
  error,
}: AdminLoginCardProps) {
  return (
    <form className="admin-login-card" onSubmit={onSubmit}>
      <p className="admin-eyebrow">Escape From Gorditos</p>
      <h1>{title}</h1>
      {subtitle ? <p className="admin-login-hint">{subtitle}</p> : null}
      <label className="admin-login-label" htmlFor="admin-token">
        ADMIN_TOKEN
        <input
          id="admin-token"
          type="password"
          autoComplete="current-password"
          value={loginValue}
          onChange={(e) => onLoginValueChange(e.target.value)}
          disabled={loggingIn}
          required
        />
      </label>
      {error ? <p className="admin-login-error">{error}</p> : null}
      <button type="submit" className="btn btn-start" disabled={loggingIn || !loginValue.trim()}>
        {loggingIn ? 'Comprobando…' : 'Entrar'}
      </button>
    </form>
  );
}
