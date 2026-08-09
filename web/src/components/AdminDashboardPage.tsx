import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminDashboard,
  fetchAdminUsage,
  forceTaskSync,
  type AdminDashboardData,
  type AdminDailyVisitRow,
  type AdminSnapshotRow,
  type AdminUsageAccessFilter,
  type AdminUsageData,
} from '../api/adminDashboard';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { AdminLoginCard } from './AdminLoginCard';

type VisitMetric = 'visits' | 'uniqueVisitors';
type DetailSection = 'overview' | 'changes' | 'sync' | 'usage';
type UsageAccessFilter = 'all' | AdminUsageAccessFilter;

const EVENT_LABELS: Record<string, string> = {
  app_session_start: 'Inicio de sesión',
  home_choice: 'Elección en home',
  go_home: 'Volver a home',
  quest_tab: 'Pestaña misiones',
  quest_category: 'Historia / secundarias',
  task_selected: 'Misión seleccionada',
  task_started: 'Misión iniciada',
  task_completed: 'Misión completada',
  task_reset: 'Misión reiniciada',
  story_node_selected: 'Nodo historia',
  search_used: 'Búsqueda',
  filter_changed: 'Filtro',
  data_source_changed: 'Fuente Local/Logs',
  logs_connect: 'Conectar logs',
  logs_disconnect: 'Desconectar logs',
  language_changed: 'Idioma',
  route_map_opened: 'Mapa de rutas',
  route_point_added: 'Punto añadido',
  route_point_removed: 'Punto eliminado',
  route_map_cleared: 'Mapa limpiado',
  local_data_wiped: 'Borrado local',
};

function eventLabel(name: string): string {
  return EVENT_LABELS[name] ?? name;
}

const ACCESS_KIND_LABELS: Record<string, string> = {
  public: 'Clave pública',
  private: 'Clave privada',
  daily: 'Código semanal',
  legacy: 'Clave legacy',
  unknown: 'Sin clasificar',
};

function accessKindLabel(kind: string | null | undefined): string {
  if (!kind) return 'Sin clasificar';
  return ACCESS_KIND_LABELS[kind] ?? kind;
}

function shortVisitor(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function propsSummary(props: Record<string, string | number | boolean> | null): string {
  if (!props) return '—';
  return Object.entries(props)
    .filter(([key]) => !['gameMode', 'appUsage', 'dataSource', 'lang', 'accessKind'].includes(key))
    .slice(0, 4)
    .map(([k, v]) => `${k}=${v}`)
    .join(' · ') || '—';
}

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

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const delta = Date.now() - t;
  const abs = Math.abs(delta);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (abs < 60_000) return rtf.format(-Math.round(delta / 1000), 'second');
  if (abs < 3_600_000) return rtf.format(-Math.round(delta / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(-Math.round(delta / 3_600_000), 'hour');
  return rtf.format(-Math.round(delta / 86_400_000), 'day');
}

function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—';
  return hash.slice(0, 10);
}

function modeLabel(mode: string): string {
  if (mode === 'regular') return 'PvP Regular';
  if (mode === 'seasonal') return 'Seasonal';
  if (mode === 'pve') return 'PvE';
  return mode;
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

function deltaClass(pct: number | null | undefined): string {
  if (pct == null) return '';
  if (pct > 0) return 'is-up';
  if (pct < 0) return 'is-down';
  return 'is-flat';
}

function formatDelta(pct: number | null | undefined): string {
  if (pct == null) return 'vs ayer —';
  const sign = pct > 0 ? '+' : '';
  return `vs ayer ${sign}${pct}%`;
}

function VisitsChart({
  series,
  metric,
}: {
  series: AdminDailyVisitRow[];
  metric: VisitMetric;
}) {
  const width = 760;
  const height = 220;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const values = series.map((d) => (metric === 'visits' ? d.visits : d.uniqueVisitors));
  const max = Math.max(1, ...values);
  const barGap = 3;
  const barW = Math.max(3, (innerW - barGap * (series.length - 1)) / series.length);

  const points = series.map((day, index) => {
    const value = metric === 'visits' ? day.visits : day.uniqueVisitors;
    const x = padL + index * (barW + barGap) + barW / 2;
    const y = padT + innerH - (value / max) * innerH;
    return { x, y, value, day };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const labelEvery = series.length > 20 ? 5 : series.length > 12 ? 3 : 2;

  return (
    <svg
      className="admin-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Gráfico de ${metric === 'visits' ? 'visitas' : 'únicos'} diarios`}
    >
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = padT + innerH * (1 - f);
        return (
          <g key={f}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} className="admin-chart-grid" />
            <text x={padL - 6} y={y + 3} className="admin-chart-tick" textAnchor="end">
              {Math.round(max * f)}
            </text>
          </g>
        );
      })}
      <line
        x1={padL}
        y1={padT + innerH}
        x2={padL + innerW}
        y2={padT + innerH}
        className="admin-chart-axis"
      />
      {points.map((p, index) => {
        const h = (p.value / max) * innerH;
        return (
          <g key={p.day.dayKey}>
            <title>
              {p.day.dayKey}: {p.day.visits} visitas · {p.day.uniqueVisitors} únicos
            </title>
            <rect
              className={`admin-chart-bar admin-chart-bar--${metric}`}
              x={padL + index * (barW + barGap)}
              y={padT + innerH - h}
              width={barW}
              height={Math.max(p.value > 0 ? 2 : 0, h)}
              rx={2}
            />
            {index % labelEvery === 0 || index === series.length - 1 ? (
              <text
                x={p.x}
                y={height - 8}
                className="admin-chart-label"
                textAnchor="middle"
              >
                {p.day.dayKey.slice(5)}
              </text>
            ) : null}
          </g>
        );
      })}
      <path d={linePath} className="admin-chart-line" fill="none" />
    </svg>
  );
}

function SnapshotCards({ snapshots }: { snapshots: AdminSnapshotRow[] }) {
  const byMode = useMemo(() => {
    const map = new Map<string, AdminSnapshotRow[]>();
    for (const s of snapshots) {
      const list = map.get(s.gameMode) ?? [];
      list.push(s);
      map.set(s.gameMode, list);
    }
    return [...map.entries()];
  }, [snapshots]);

  return (
    <div className="admin-snapshot-grid">
      {byMode.map(([mode, rows]) => {
        const es = rows.find((r) => r.lang === 'es');
        const en = rows.find((r) => r.lang === 'en');
        const primary = es ?? en ?? rows[0];
        const staleHours = primary?.fetchedAt
          ? (Date.now() - Date.parse(primary.fetchedAt)) / 3_600_000
          : null;
        const freshness =
          staleHours == null
            ? 'unknown'
            : staleHours < 30
              ? 'fresh'
              : staleHours < 72
                ? 'warm'
                : 'stale';
        return (
          <article key={mode} className={`admin-snapshot-card is-${freshness}`}>
            <header className="admin-snapshot-card-head">
              <h3>{modeLabel(mode)}</h3>
              <span className={`admin-freshness admin-freshness--${freshness}`}>
                {freshness === 'fresh' ? 'Al día' : freshness === 'warm' ? 'OK' : 'Desfasado'}
              </span>
            </header>
            <p className="admin-snapshot-count">
              <strong>{primary?.taskCount ?? '—'}</strong>
              <span>misiones</span>
            </p>
            <dl className="admin-snapshot-meta">
              <div>
                <dt>Comprobado</dt>
                <dd title={formatWhen(primary?.fetchedAt)}>{formatRelative(primary?.fetchedAt)}</dd>
              </div>
              <div>
                <dt>Cambió</dt>
                <dd title={formatWhen(primary?.changedAt)}>
                  {formatRelative(primary?.changedAt ?? null)}
                </dd>
              </div>
              <div>
                <dt>ES / EN</dt>
                <dd>
                  {es?.taskCount ?? '—'} / {en?.taskCount ?? '—'}
                </dd>
              </div>
              <div>
                <dt>Hash</dt>
                <dd><code>{shortHash(primary?.contentHash)}</code></dd>
              </div>
            </dl>
            <p className="admin-snapshot-source" title={primary?.source}>
              {primary?.source ?? '—'}
            </p>
          </article>
        );
      })}
    </div>
  );
}

export function AdminDashboardPage() {
  const auth = useAdminAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [visitMetric, setVisitMetric] = useState<VisitMetric>('visits');
  const [section, setSection] = useState<DetailSection>('overview');
  const [usage, setUsage] = useState<AdminUsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageAccessFilter, setUsageAccessFilter] = useState<UsageAccessFilter>('all');

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
      if (/unauthor/i.test(msg) || /401/.test(msg)) logout();
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  const loadUsage = useCallback(async () => {
    if (!token) return;
    setUsageLoading(true);
    setUsageError(null);
    try {
      setUsage(await fetchAdminUsage(token, usageAccessFilter));
    } catch (err) {
      setUsageError(err instanceof Error ? err.message : 'Error al cargar uso');
      const msg = err instanceof Error ? err.message : String(err);
      if (/unauthor/i.test(msg) || /401/.test(msg)) logout();
    } finally {
      setUsageLoading(false);
    }
  }, [token, logout, usageAccessFilter]);

  useEffect(() => {
    if (status === 'unlocked') void load();
  }, [status, load]);

  useEffect(() => {
    if (status === 'unlocked' && section === 'usage') void loadUsage();
  }, [status, section, loadUsage]);

  const series = useMemo(
    () => fillDailySeries(data?.dailyVisits ?? [], 30),
    [data?.dailyVisits],
  );

  const peakDay = useMemo(() => {
    if (series.length === 0) return null;
    return series.reduce((best, d) => (d.visits > best.visits ? d : best), series[0]);
  }, [series]);

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

  const s = data?.summary;

  return (
    <div className="admin-page">
      <header className="admin-toolbar">
        <div className="admin-toolbar-title">
          <p className="admin-eyebrow">Escape From Gorditos</p>
          <h1>Panel de administración</h1>
          <p className="admin-muted">
            Zona horaria {s?.timezone ?? 'Europe/Madrid'}
            {loading ? ' · actualizando…' : ''}
          </p>
        </div>
        <div className="admin-toolbar-actions">
          <a className="btn" href="/admin/routes">Rutas fijas</a>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void load();
              if (section === 'usage') void loadUsage();
            }}
            disabled={loading || usageLoading}
          >
            Actualizar
          </button>
          <button
            type="button"
            className="btn btn-start"
            onClick={() => void handleForceSync()}
            disabled={syncBusy}
          >
            {syncBusy ? 'Sincronizando…' : 'Forzar sync'}
          </button>
          <button type="button" className="btn btn-reset" onClick={logout}>Salir</button>
        </div>
      </header>

      {error ? <p className="admin-banner admin-banner--error">{error}</p> : null}
      {syncMsg ? <p className="admin-banner">{syncMsg}</p> : null}

      <main className="admin-dashboard">
        <section className="admin-stat-grid">
          <article className="admin-stat-card">
            <span className="admin-stat-label">Hoy</span>
            <strong className="admin-stat-value">{s?.visitsToday ?? '—'}</strong>
            <span className={`admin-stat-delta ${deltaClass(s?.visitsDeltaPct)}`}>
              {formatDelta(s?.visitsDeltaPct)}
            </span>
            <span className="admin-stat-foot">{s?.uniquesToday ?? 0} únicos</span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Últimos 7 días</span>
            <strong className="admin-stat-value">{s?.visits7d ?? '—'}</strong>
            <span className="admin-stat-foot">
              media {s?.avgVisits7d ?? 0}/día · {s?.uniques7d ?? 0} únicos acum.
            </span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Online ahora</span>
            <strong className="admin-stat-value">{s?.online ?? '—'}</strong>
            <span className="admin-stat-foot">ventana 60 s</span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Audiencia total</span>
            <strong className="admin-stat-value">{s?.uniqueBrowsers ?? '—'}</strong>
            <span className="admin-stat-foot">{s?.impressions ?? 0} sesiones</span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Datasets</span>
            <strong className="admin-stat-value">{s?.totalTasksEs ?? '—'}</strong>
            <span className="admin-stat-foot">
              {s?.snapshotCount ?? 0} snapshots · {s?.changes7d ?? 0} cambios / 7d
            </span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Último sync</span>
            <strong className="admin-stat-value admin-stat-value--sm">
              {s?.lastSync ? (
                <span className={`admin-pill admin-pill--${s.lastSync.status}`}>
                  {s.lastSync.status}
                </span>
              ) : '—'}
            </strong>
            <span className="admin-stat-foot" title={formatWhen(s?.lastSync?.lastSuccessAt)}>
              {s?.lastSync
                ? `${s.lastSync.dayKey} · ${formatRelative(s.lastSync.lastSuccessAt)}`
                : 'sin ejecuciones'}
            </span>
          </article>
        </section>

        <div className="admin-layout-split">
          <section className="admin-panel admin-panel--chart">
            <div className="admin-panel-head">
              <div>
                <h2>Tráfico diario</h2>
                <p className="admin-muted">
                  Pico: {peakDay ? `${peakDay.dayKey} (${peakDay.visits})` : '—'}
                  {' · '}
                  Ayer: {s?.visitsYesterday ?? 0} visitas
                </p>
              </div>
              <div className="admin-segmented" role="tablist" aria-label="Métrica del gráfico">
                <button
                  type="button"
                  className={visitMetric === 'visits' ? 'active' : ''}
                  onClick={() => setVisitMetric('visits')}
                >
                  Visitas
                </button>
                <button
                  type="button"
                  className={visitMetric === 'uniqueVisitors' ? 'active' : ''}
                  onClick={() => setVisitMetric('uniqueVisitors')}
                >
                  Únicos
                </button>
              </div>
            </div>
            <VisitsChart series={series} metric={visitMetric} />
          </section>

          <section className="admin-panel">
            <div className="admin-panel-head">
              <h2>Salud del sistema</h2>
            </div>
            <ul className="admin-health-list">
              <li>
                <span>Último cambio de dataset</span>
                <strong title={formatWhen(s?.lastDatasetChangeAt)}>
                  {formatRelative(s?.lastDatasetChangeAt ?? null)}
                </strong>
              </li>
              <li>
                <span>Snapshot más antiguo comprobado</span>
                <strong title={formatWhen(s?.oldestFetchedAt)}>
                  {formatRelative(s?.oldestFetchedAt ?? null)}
                </strong>
              </li>
              <li>
                <span>Puntos de ruta fijos</span>
                <strong>{s?.fixedPoints ?? '—'}</strong>
              </li>
              <li>
                <span>Cambios de misiones (7 días)</span>
                <strong>{s?.changes7d ?? 0}</strong>
              </li>
              <li>
                <span>Error sync reciente</span>
                <strong className={s?.lastSync?.lastError ? 'is-warn' : ''}>
                  {s?.lastSync?.lastError
                    ? s.lastSync.lastError.slice(0, 48) + (s.lastSync.lastError.length > 48 ? '…' : '')
                    : 'ninguno'}
                </strong>
              </li>
            </ul>
          </section>
        </div>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Snapshots de misiones</h2>
            <p className="admin-muted">1 fila por modo · contenido sin historial de payloads</p>
          </div>
          <SnapshotCards snapshots={data?.snapshots ?? []} />
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Detalle</h2>
            <div className="admin-segmented" role="tablist">
              <button
                type="button"
                className={section === 'overview' ? 'active' : ''}
                onClick={() => setSection('overview')}
              >
                Visitas
              </button>
              <button
                type="button"
                className={section === 'usage' ? 'active' : ''}
                onClick={() => setSection('usage')}
              >
                Uso
              </button>
              <button
                type="button"
                className={section === 'changes' ? 'active' : ''}
                onClick={() => setSection('changes')}
              >
                Cambios
              </button>
              <button
                type="button"
                className={section === 'sync' ? 'active' : ''}
                onClick={() => setSection('sync')}
              >
                Sync
              </button>
            </div>
          </div>

          {section === 'usage' ? (
            <div className="admin-usage">
              <div className="admin-usage-filters">
                <label className="admin-usage-filter" htmlFor="usage-access-filter">
                  <span>Clave de acceso</span>
                  <select
                    id="usage-access-filter"
                    className="admin-usage-select"
                    value={usageAccessFilter}
                    onChange={(e) => setUsageAccessFilter(e.target.value as UsageAccessFilter)}
                    disabled={usageLoading}
                  >
                    <option value="all">Todas</option>
                    <option value="public">Clave pública</option>
                    <option value="private">Clave privada</option>
                    <option value="daily">Código semanal</option>
                    <option value="legacy">Clave legacy</option>
                    <option value="unknown">Sin clasificar</option>
                  </select>
                </label>
                <div className="admin-usage-filter-counts" aria-label="Distribución por clave (7d)">
                  {(usage?.byAccessKind ?? []).map((row) => {
                    const kind: AdminUsageAccessFilter | null =
                      row.accessKind === 'public'
                      || row.accessKind === 'private'
                      || row.accessKind === 'daily'
                      || row.accessKind === 'legacy'
                      || row.accessKind === 'unknown'
                        ? row.accessKind
                        : null;
                    const active = kind != null && usageAccessFilter === kind;
                    return (
                      <button
                        key={row.accessKind}
                        type="button"
                        className={`admin-usage-chip${active ? ' active' : ''}`}
                        disabled={kind == null}
                        onClick={() => {
                          if (!kind) return;
                          setUsageAccessFilter(usageAccessFilter === kind ? 'all' : kind);
                        }}
                        title="Filtrar por esta clave"
                      >
                        {accessKindLabel(row.accessKind)}
                        <strong>{row.count}</strong>
                      </button>
                    );
                  })}
                </div>
                {usageLoading ? <span className="admin-muted">Actualizando…</span> : null}
              </div>

              {usageError ? <p className="admin-banner admin-banner--error">{usageError}</p> : null}
              {usageLoading && !usage ? (
                <p className="admin-muted">Cargando logs de uso…</p>
              ) : (
                <>
                  <p className="admin-muted admin-usage-filter-note">
                    Mostrando{' '}
                    {usageAccessFilter === 'all'
                      ? 'todas las claves'
                      : accessKindLabel(usageAccessFilter)}
                    . Los eventos anteriores al despliegue pueden aparecer como «Sin clasificar».
                  </p>
                  <div className="admin-stat-grid admin-stat-grid--compact">
                    <article className="admin-stat-card">
                      <span className="admin-stat-label">Eventos hoy</span>
                      <strong className="admin-stat-value">{usage?.summary.eventsToday ?? 0}</strong>
                    </article>
                    <article className="admin-stat-card">
                      <span className="admin-stat-label">Eventos 7d</span>
                      <strong className="admin-stat-value">{usage?.summary.events7d ?? 0}</strong>
                    </article>
                    <article className="admin-stat-card">
                      <span className="admin-stat-label">Usuarios 7d</span>
                      <strong className="admin-stat-value">{usage?.summary.uniques7d ?? 0}</strong>
                      <span className="admin-stat-foot">navegadores con algún evento</span>
                    </article>
                    <article className="admin-stat-card">
                      <span className="admin-stat-label">Top acción 7d</span>
                      <strong className="admin-stat-value admin-stat-value--sm">
                        {usage?.summary.topEvent7d
                          ? eventLabel(usage.summary.topEvent7d)
                          : '—'}
                      </strong>
                    </article>
                  </div>

                  <div className="admin-table-wrap admin-usage-daily">
                    <h3 className="admin-subhead">Eventos por día</h3>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Día</th>
                          <th>Eventos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(usage?.dailyTotals ?? [])].reverse().slice(0, 14).map((d) => (
                          <tr key={d.dayKey}>
                            <td>{d.dayKey}</td>
                            <td>{d.events}</td>
                          </tr>
                        ))}
                        {(usage?.dailyTotals.length ?? 0) === 0 ? (
                          <tr>
                            <td colSpan={2} className="admin-muted">Sin datos diarios.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="admin-usage-split">
                    <div className="admin-table-wrap">
                      <h3 className="admin-subhead">Acciones (7 días)</h3>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Evento</th>
                            <th>Veces</th>
                            <th>Únicos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(usage?.byEvent7d.length ?? 0) === 0 ? (
                            <tr>
                              <td colSpan={3} className="admin-muted">
                                Aún no hay eventos. Usa la app (fuera de /admin) para generar logs.
                              </td>
                            </tr>
                          ) : (
                            usage?.byEvent7d.map((row) => (
                              <tr key={row.eventName}>
                                <td>
                                  <span className="admin-event-name">{eventLabel(row.eventName)}</span>
                                  <code className="admin-event-code">{row.eventName}</code>
                                </td>
                                <td>{row.count}</td>
                                <td>{row.uniqueVisitors}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="admin-table-wrap">
                      <h3 className="admin-subhead">Desglose (7 días)</h3>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Qué</th>
                            <th>Valor</th>
                            <th>Veces</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(usage?.byProp7d.length ?? 0) === 0 ? (
                            <tr>
                              <td colSpan={3} className="admin-muted">Sin desglose todavía.</td>
                            </tr>
                          ) : (
                            usage?.byProp7d.map((row) => (
                              <tr key={`${row.eventName}-${row.propKey}-${row.propValue}`}>
                                <td>{eventLabel(row.eventName)}</td>
                                <td>
                                  <code>{row.propKey}={row.propValue}</code>
                                </td>
                                <td>{row.count}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="admin-table-wrap">
                    <h3 className="admin-subhead">Actividad reciente</h3>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Cuándo</th>
                          <th>Clave</th>
                          <th>Evento</th>
                          <th>Detalle</th>
                          <th>Visitante</th>
                          <th>Contexto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(usage?.recent.length ?? 0) === 0 ? (
                          <tr>
                            <td colSpan={6} className="admin-muted">Sin logs recientes.</td>
                          </tr>
                        ) : (
                          usage?.recent.map((row) => (
                            <tr key={row.id}>
                              <td title={formatWhen(row.occurredAt)}>
                                {formatRelative(row.occurredAt)}
                              </td>
                              <td>
                                <span className="admin-pill admin-pill--access">
                                  {accessKindLabel(row.accessKind)}
                                </span>
                              </td>
                              <td>{eventLabel(row.eventName)}</td>
                              <td><code>{propsSummary(row.props)}</code></td>
                              <td title={row.visitorId}>
                                <code>{shortVisitor(row.visitorId)}</code>
                              </td>
                              <td className="admin-cell-error">
                                {[
                                  row.props?.gameMode,
                                  row.props?.appUsage,
                                  row.props?.dataSource,
                                  row.props?.lang,
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    <p className="admin-footnote">
                      Retención {usage?.retentionDays ?? 90} días · zona {usage?.timezone ?? 'Europe/Madrid'} ·
                      no se guarda texto de búsqueda ni rutas de carpeta de logs.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {section === 'overview' ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Visitas</th>
                    <th>Únicos</th>
                    <th>Recurrentes*</th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().slice(0, 14).map((d) => (
                    <tr key={d.dayKey}>
                      <td>{d.dayKey}</td>
                      <td>{d.visits}</td>
                      <td>{d.uniqueVisitors}</td>
                      <td>{Math.max(0, d.visits - d.uniqueVisitors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="admin-footnote">
                * Recurrentes ≈ visitas − únicos del día (misma sesión extra no cuenta como único nuevo).
              </p>
            </div>
          ) : null}

          {section === 'changes' ? (
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
                        Sin cambios registrados. Solo se guardan cuando el contenido del dataset difiere.
                      </td>
                    </tr>
                  ) : (
                    data?.changes.map((c) => (
                      <tr key={c.id}>
                        <td title={formatWhen(c.detectedAt)}>{formatRelative(c.detectedAt)}</td>
                        <td>{modeLabel(c.gameMode)}</td>
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
          ) : null}

          {section === 'sync' ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Estado</th>
                    <th>Intentos</th>
                    <th>Actualizados</th>
                    <th>Éxito</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.syncDays.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-muted">Aún no hay ejecuciones de sync registradas.</td>
                    </tr>
                  ) : (
                    data?.syncDays.map((d) => (
                      <tr key={d.dayKey}>
                        <td>{d.dayKey}</td>
                        <td>
                          <span className={`admin-pill admin-pill--${d.status}`}>{d.status}</span>
                        </td>
                        <td>{d.attempts}</td>
                        <td>{d.updatedCombinations}</td>
                        <td title={formatWhen(d.lastSuccessAt)}>{formatRelative(d.lastSuccessAt)}</td>
                        <td className="admin-cell-error">{d.lastError ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
