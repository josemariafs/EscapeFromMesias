import type { ReactNode } from 'react';

export type AdminSection = 'dashboard' | 'routes' | 'reports';

interface AdminToolbarProps {
  section: AdminSection;
  title: string;
  appTitle: string;
  eyebrow?: string;
  navDashboard: string;
  navRoutes: string;
  navReports: string;
  logoutLabel: string;
  onLogout: () => void;
  /** Acciones de la página (Actualizar, Forzar sync…). */
  actions?: ReactNode;
  /** Fila secundaria (filtros de estado, entorno…). */
  secondary?: ReactNode;
}

/** Cabecera unificada para todas las vistas admin. */
export function AdminToolbar({
  section,
  title,
  appTitle,
  eyebrow = 'Admin',
  navDashboard,
  navRoutes,
  navReports,
  logoutLabel,
  onLogout,
  actions,
  secondary,
}: AdminToolbarProps) {
  return (
    <header className={`admin-toolbar${secondary ? ' admin-toolbar--with-secondary' : ''}`}>
      <div className="admin-toolbar-primary">
        <div className="admin-toolbar-brand">
          <a className="admin-brand" href="/" title={appTitle}>
            <img src="/logo.png" alt={appTitle} className="admin-brand-logo" />
          </a>
          <div className="admin-toolbar-title">
            <p className="admin-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
        </div>

        <nav className="admin-toolbar-nav" aria-label="Admin">
          <a
            className={`admin-toolbar-nav-link${section === 'dashboard' ? ' is-active' : ''}`}
            href="/admin"
            aria-current={section === 'dashboard' ? 'page' : undefined}
          >
            {navDashboard}
          </a>
          <a
            className={`admin-toolbar-nav-link${section === 'routes' ? ' is-active' : ''}`}
            href="/admin/routes"
            aria-current={section === 'routes' ? 'page' : undefined}
          >
            {navRoutes}
          </a>
          <a
            className={`admin-toolbar-nav-link${section === 'reports' ? ' is-active' : ''}`}
            href="/admin/reports"
            aria-current={section === 'reports' ? 'page' : undefined}
          >
            {navReports}
          </a>
        </nav>

        <div className="admin-toolbar-actions">
          {actions ? <div className="admin-toolbar-action-group">{actions}</div> : null}
          {actions ? <span className="admin-toolbar-actions-sep" aria-hidden /> : null}
          <button type="button" className="admin-tool-btn admin-tool-btn--danger" onClick={onLogout}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v7A1.5 1.5 0 0 0 3.5 13H6M10.5 11.5 14 8l-3.5-3.5M14 8H6.5"
              />
            </svg>
            <span>{logoutLabel}</span>
          </button>
        </div>
      </div>

      {secondary ? (
        <div className="admin-toolbar-secondary">{secondary}</div>
      ) : null}
    </header>
  );
}
