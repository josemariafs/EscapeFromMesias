import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminDashboard,
  forceTaskSync,
  type AdminDashboardData,
  type AdminDailyVisitRow,
} from '../api/adminDashboard';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { AdminLoginCard } from './AdminLoginCard';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—';
  return `${hash.slice(0, 8)}…`;
}

function fillDailySeries(rows: AdminDailyVisitRow[], days = 30): AdminDailyVisitRow[] {
  const map = new Map(rows.map((r) => [r.dayKey, r]));
  const out: AdminDailyVisitRow[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    out.push(map.get(key) ?? { dayKey: key, visits: 0, uniqueVisitors: 0 });
  }
  return out;
}

function VisitsChart({ series }: { series: AdminDailyVisitRow[] }) {
  const max = Math.max(1, ...series.map((d) => Math.max(d.visits, d.uniqueVisitors)));
  const width = 720;
  const height = 180;
  const padX = 28;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const gap = 2;
  const barW = Math.max(2, (innerW - gap * (series.length - 1)) / series.length / 2 - 1);

  return (
    <svg
      className="admin-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Visitas diarias últimos 30 días"
    >
      <line
        x1={padX}
        y1={padY + innerH}
        x2={padX + innerW}
        y2={padY + innerH}
        className="admin-chart-axis"
      />
      {series.map((day, index) => {
        const x = padX + (index / Math.max(1, series.length - 1 || 1)) * (innerW - barW * 2);
        const hVisits = (day.visits / max) * innerH;
        const hUnique = (day.uniqueVisitors / max) * innerH;
        return (
          <g key={day.dayKey}>
            <title>
              {day.dayKey}: {day.visits} visitas, {day.uniqueVisitors} únicos
            </title>
            <rect
              className="admin-chart-bar admin-chart-bar--visits"
              x={x}
              y={padY + innerH - hVisits}
              width={barW}
              height={Math.max(day.visits > 0 ? 2 : 0, hVisits)}
              rx={1}
            />
            <rect
              className="admin-chart-bar admin-chart-bar--unique"
              x={x + barW + 1}
              y={padY + innerH - hUnique}
              width={barW}
              height={Math.max(day.uniqueVisitors > 0 ? 2 : 0, hUnique)}
              rx={1}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function AdminDashboardPage() {
  const auth = useAdminAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const { token, status, logout } = auth;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminDashboard(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el panel');
      const msg = err instanceof Error ? err.message : String(err);
      if (/unauthor/i.test(msg) || /401/.test(msg)) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    if (status === 'unlocked') void load();
  }, [status, load]);

  const series = useMemo(
    () => fillDailySeries(data?.dailyVisits ?? [], 30),
    [data?.dailyVisits],
  );

  const handleForceSync = async () => {
    if (!token) return;
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const result = await forceTaskSync(token) as {
        skipped?: boolean;
        run?: { updated?: number; unchanged?: number; status?: string };
        decision?: { reason?: string };
      };
      if (result.skipped) {
        setSyncMsg(`Sync omitido: ${result.decision?.reason ?? 'skipped'}`);
      } else {
        setSyncMsg(
          `Sync ${result.run?.status ?? 'ok'}: ${result.run?.updated ?? 0} actualizados, `
          + `${result.run?.unchanged ?? 0} sin cambios`,
        );
      }
      await load();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Error al sincronizar');
    } finally {
      setSyncBusy(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="admin-page admin-page--login">
        <p className="admin-muted">Comprobando acceso…</p>
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <div className="admin-page admin-page--login">
        <AdminLoginCard
          title="Admin"
          subtitle="Acceso solo con ADMIN_TOKEN"
          loginValue={auth.loginValue}
          onLoginValueChange={auth.setLoginValue}
          onSubmit={auth.login}
          loggingIn={auth.loggingIn}
          error={auth.loginError}
        />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-toolbar">
        <div className="admin-toolbar-title">
          <h1>Panel admin</h1>
          <p className="admin-muted">Datasets · visitas · sync (Europe/Madrid)</p>
        </div>
        <div className="admin-toolbar-actions">
          <a className="btn" href="/admin/routes">Rutas fijas</a>
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
          <button type="button" className="btn btn-start" onClick={() => void handleForceSync()} disabled={syncBusy}>
            {syncBusy ? 'Sync…' : 'Forzar sync'}
          </button>
          <button type="button" className="btn btn-reset" onClick={logout}>Salir</button>
        </div>
      </header>

      {error ? <p className="admin-action-error">{error}</p> : null}
      {syncMsg ? <p className="admin-banner">{syncMsg}</p> : null}

      <main className="admin-dashboard">
        <section className="admin-stat-grid">
          <article className="admin-stat-card">
            <span className="admin-stat-label">Sesiones totales</span>
            <strong className="admin-stat-value">{data?.summary.impressions ?? '—'}</strong>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Navegadores únicos</span>
            <strong className="admin-stat-value">{data?.summary.uniqueBrowsers ?? '—'}</strong>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Online ahora</span>
            <strong className="admin-stat-value">{data?.summary.online ?? '—'}</strong>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Cambios dataset</span>
            <strong className="admin-stat-value">{data?.changes.length ?? '—'}</strong>
          </article>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Visitas diarias (30 días)</h2>
            <div className="admin-chart-legend">
              <span className="admin-legend-item admin-legend-item--visits">Visitas</span>
              <span className="admin-legend-item admin-legend-item--unique">Únicos</span>
            </div>
          </div>
          <VisitsChart series={series} />
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Visitas</th>
                  <th>Únicos</th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().slice(0, 14).map((d) => (
                  <tr key={d.dayKey}>
                    <td>{d.dayKey}</td>
                    <td>{d.visits}</td>
                    <td>{d.uniqueVisitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Cambios en datasets</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Modo</th>
                  <th>Lang</th>
                  <th>Misiones</th>
                  <th>Hash</th>
                  <th>Anterior</th>
                </tr>
              </thead>
              <tbody>
                {(data?.changes.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-muted">
                      Sin cambios registrados todavía (solo se guardan cuando el contenido difiere).
                    </td>
                  </tr>
                ) : (
                  data?.changes.map((c) => (
                    <tr key={c.id}>
                      <td>{formatWhen(c.detectedAt)}</td>
                      <td>{c.gameMode}</td>
                      <td>{c.lang}</td>
                      <td>{c.taskCount}</td>
                      <td><code>{shortHash(c.contentHash)}</code></td>
                      <td><code>{shortHash(c.previousHash)}</code></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Snapshots actuales</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Modo</th>
                  <th>Lang</th>
                  <th>Misiones</th>
                  <th>Última comprobación</th>
                  <th>Último cambio</th>
                  <th>Hash</th>
                  <th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {(data?.snapshots ?? []).map((s) => (
                  <tr key={`${s.gameMode}-${s.lang}`}>
                    <td>{s.gameMode}</td>
                    <td>{s.lang}</td>
                    <td>{s.taskCount}</td>
                    <td>{formatWhen(s.fetchedAt)}</td>
                    <td>{formatWhen(s.changedAt ?? s.updatedAt)}</td>
                    <td><code>{shortHash(s.contentHash)}</code></td>
                    <td className="admin-cell-source">{s.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Sync diario</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Estado</th>
                  <th>Intentos</th>
                  <th>Actualizados</th>
                  <th>Último éxito</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {(data?.syncDays ?? []).map((d) => (
                  <tr key={d.dayKey}>
                    <td>{d.dayKey}</td>
                    <td>
                      <span className={`admin-pill admin-pill--${d.status}`}>{d.status}</span>
                    </td>
                    <td>{d.attempts}</td>
                    <td>{d.updatedCombinations}</td>
                    <td>{formatWhen(d.lastSuccessAt)}</td>
                    <td className="admin-cell-error">{d.lastError ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
