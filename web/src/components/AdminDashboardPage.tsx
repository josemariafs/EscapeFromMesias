import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminDashboard,
  fetchAdminUsage,
  forceTaskSync,
  type AdminAccessKindKey,
  type AdminChangeRow,
  type AdminDashboardData,
  type AdminDailyVisitRow,
  type AdminSnapshotRow,
  type AdminTaskSnapshotDiff,
  type AdminUsageAccessFilter,
  type AdminUsageData,
} from '../api/adminDashboard';
import { fetchVersionNews, saveVersionNews } from '../api/versionNews';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useLanguage } from '../i18n/useLanguage';
import { AdminLoginCard } from './AdminLoginCard';
import { AdminToolbar } from './AdminToolbar';

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
  route_arrow_added: 'Flecha añadida',
  route_arrow_removed: 'Flecha eliminada',
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
  admin: 'Admin',
  unknown: 'Sin clasificar',
};

const ACCESS_STACK_ORDER: AdminAccessKindKey[] = [
  'public',
  'private',
  'daily',
  'legacy',
  'admin',
  'unknown',
];

const ACCESS_STACK_COLORS: Record<AdminAccessKindKey, string> = {
  public: '#5ec4a8',
  private: '#c9a227',
  daily: '#6a9fd8',
  legacy: '#8a8a90',
  admin: '#d08050',
  unknown: '#4a5560',
};

function accessKindLabel(kind: string | null | undefined): string {
  if (!kind) return 'Sin clasificar';
  return ACCESS_KIND_LABELS[kind] ?? kind;
}

function emptyAccessBuckets(): NonNullable<AdminDailyVisitRow['byAccess']> {
  return {
    public: { visits: 0, uniqueVisitors: 0 },
    private: { visits: 0, uniqueVisitors: 0 },
    daily: { visits: 0, uniqueVisitors: 0 },
    legacy: { visits: 0, uniqueVisitors: 0 },
    admin: { visits: 0, uniqueVisitors: 0 },
    unknown: { visits: 0, uniqueVisitors: 0 },
  };
}

function dayMetric(day: AdminDailyVisitRow, metric: VisitMetric): number {
  return metric === 'visits' ? day.visits : day.uniqueVisitors;
}

function dayAccessMetric(
  day: AdminDailyVisitRow,
  kind: AdminAccessKindKey,
  metric: VisitMetric,
): number {
  const bucket = day.byAccess?.[kind];
  if (!bucket) return 0;
  return metric === 'visits' ? bucket.visits : bucket.uniqueVisitors;
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

function toMadridDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
}

function asTaskDiff(raw: AdminChangeRow['diff']): AdminTaskSnapshotDiff | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

function taskCountDelta(change: AdminChangeRow): string {
  if (change.previousTaskCount == null) return '—';
  const delta = change.taskCount - change.previousTaskCount;
  if (delta === 0) return '±0';
  return delta > 0 ? `+${delta}` : String(delta);
}

function fillDailySeries(rows: AdminDailyVisitRow[], days = 30): AdminDailyVisitRow[] {
  const map = new Map(rows.map((r) => [r.dayKey, r]));
  const out: AdminDailyVisitRow[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    const row = map.get(key);
    out.push(
      row
        ? {
            ...row,
            byAccess: { ...emptyAccessBuckets(), ...(row.byAccess ?? {}) },
          }
        : { dayKey: key, visits: 0, uniqueVisitors: 0, byAccess: emptyAccessBuckets() },
    );
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
  const values = series.map((d) => dayMetric(d, metric));
  const max = Math.max(1, ...values);
  const barGap = 3;
  const barW = Math.max(3, (innerW - barGap * (series.length - 1)) / series.length);
  const [hover, setHover] = useState<{
    day: AdminDailyVisitRow;
    xPct: number;
    yPct: number;
  } | null>(null);

  const activeKinds = useMemo(() => {
    return ACCESS_STACK_ORDER.filter((kind) =>
      series.some((day) => dayAccessMetric(day, kind, metric) > 0),
    );
  }, [series, metric]);

  const points = series.map((day, index) => {
    const value = dayMetric(day, metric);
    const x = padL + index * (barW + barGap) + barW / 2;
    const y = padT + innerH - (value / max) * innerH;
    return { x, y, value, day, index };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const labelEvery = series.length > 20 ? 5 : series.length > 12 ? 3 : 2;
  const stackKinds = activeKinds.length > 0 ? activeKinds : ACCESS_STACK_ORDER;

  return (
    <div className="admin-chart-wrap" onMouseLeave={() => setHover(null)}>
      <svg
        className="admin-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Gráfico apilado de ${metric === 'visits' ? 'visitas' : 'únicos'} por tipo de acceso`}
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
        {points.map((p) => {
          const active = hover?.day.dayKey === p.day.dayKey;
          const x = padL + p.index * (barW + barGap);
          let stacked = 0;
          const segments = stackKinds
            .map((kind) => {
              const value = dayAccessMetric(p.day, kind, metric);
              if (value <= 0) return null;
              const h = (value / max) * innerH;
              const y = padT + innerH - stacked - h;
              stacked += h;
              return { kind, value, h, y };
            })
            .filter((s): s is { kind: AdminAccessKindKey; value: number; h: number; y: number } => !!s);

          return (
            <g key={p.day.dayKey} className={active ? 'is-active-stack' : undefined}>
              {segments.map((seg, segIndex) => {
                const isTop = segIndex === segments.length - 1;
                const isBottom = segIndex === 0;
                return (
                  <rect
                    key={seg.kind}
                    className={`admin-chart-bar-stack${active ? ' is-active' : ''}`}
                    x={x}
                    y={seg.y}
                    width={barW}
                    height={Math.max(1, seg.h)}
                    rx={isTop || isBottom ? 2 : 0}
                    fill={ACCESS_STACK_COLORS[seg.kind]}
                  />
                );
              })}
              <rect
                className="admin-chart-hit"
                x={x - 1}
                y={padT}
                width={barW + 2}
                height={innerH}
                onMouseEnter={() => {
                  setHover({
                    day: p.day,
                    xPct: (p.x / width) * 100,
                    yPct: (Math.max(padT, p.y) / height) * 100,
                  });
                }}
              />
              {p.index % labelEvery === 0 || p.index === series.length - 1 ? (
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
        {hover ? (
          <circle
            className="admin-chart-focus"
            cx={(hover.xPct / 100) * width}
            cy={(hover.yPct / 100) * height}
            r={4}
          />
        ) : null}
      </svg>
      <ul className="admin-chart-legend" aria-label="Tipos de acceso">
        {stackKinds.map((kind) => (
          <li key={kind}>
            <span
              className="admin-chart-legend-swatch"
              style={{ background: ACCESS_STACK_COLORS[kind] }}
              aria-hidden
            />
            {accessKindLabel(kind)}
          </li>
        ))}
      </ul>
      {hover ? (
        <div
          className={`admin-chart-tooltip${hover.xPct > 70 ? ' is-left' : ''}`}
          style={{ left: `${hover.xPct}%`, top: `${Math.max(8, hover.yPct - 6)}%` }}
          role="tooltip"
        >
          <p className="admin-chart-tooltip-date">{hover.day.dayKey}</p>
          <dl className="admin-chart-tooltip-stats">
            <div>
              <dt>Total</dt>
              <dd>{dayMetric(hover.day, metric)}</dd>
            </div>
            {stackKinds.map((kind) => {
              const value = dayAccessMetric(hover.day, kind, metric);
              if (value <= 0) return null;
              return (
                <div key={kind}>
                  <dt>
                    <span
                      className="admin-chart-tooltip-swatch"
                      style={{ background: ACCESS_STACK_COLORS[kind] }}
                      aria-hidden
                    />
                    {accessKindLabel(kind)}
                  </dt>
                  <dd>{value}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}
    </div>
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
                <dd
                  {...(primary?.fetchedAt
                    ? { 'data-admin-tip': formatWhen(primary.fetchedAt) }
                    : {})}
                >
                  {formatRelative(primary?.fetchedAt)}
                </dd>
              </div>
              <div>
                <dt>Cambió</dt>
                <dd
                  {...(primary?.changedAt
                    ? { 'data-admin-tip': formatWhen(primary.changedAt) }
                    : {})}
                >
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

function SyncChangeMissionDetail({ change }: { change: AdminChangeRow }) {
  const diff = asTaskDiff(change.diff);
  if (!diff) {
    return (
      <div className="admin-sync-missions">
        <p className="admin-muted">
          Sin detalle de misiones para este sync (registrado antes de guardar diffs).
          El próximo sync con cambios sí incluirá el desglose.
        </p>
      </div>
    );
  }

  const sections: {
    key: 'added' | 'updated' | 'removed';
    title: string;
    count: number;
    items: AdminTaskSnapshotDiff['added'];
  }[] = [
    { key: 'added', title: 'Añadidas', count: diff.addedCount, items: diff.added },
    { key: 'updated', title: 'Actualizadas', count: diff.updatedCount, items: diff.updated },
    { key: 'removed', title: 'Eliminadas', count: diff.removedCount, items: diff.removed },
  ];

  return (
    <div className="admin-sync-missions">
      <p className="admin-sync-missions-summary">
        {modeLabel(change.gameMode)} · {change.lang.toUpperCase()} ·{' '}
        {change.previousTaskCount ?? '?'} → {change.taskCount} misiones
        {' · '}
        +{diff.addedCount} / ∼{diff.updatedCount} / −{diff.removedCount}
        {diff.truncated ? ' · lista truncada' : ''}
      </p>
      {sections.map((section) => {
        if (section.count === 0) return null;
        return (
          <div key={section.key} className="admin-sync-missions-block">
            <h4>
              {section.title} ({section.count}
              {section.items.length < section.count
                ? `, mostrando ${section.items.length}`
                : ''}
              )
            </h4>
            <ul>
              {section.items.map((item) => (
                <li key={`${section.key}-${item.id}`}>
                  <strong>{item.name || item.id}</strong>
                  {section.key === 'updated' && item.changes && item.changes.length > 0 ? (
                    <ul className="admin-sync-missions-changes">
                      {item.changes.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {diff.addedCount === 0 && diff.updatedCount === 0 && diff.removedCount === 0 ? (
        <p className="admin-muted">
          El hash cambió pero no se detectaron diferencias por id de misión
          (posible reordenación o cambio no tipado).
        </p>
      ) : null}
    </div>
  );
}

export function AdminDashboardPage() {
  const { t } = useLanguage();
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
  const [versionNewsDraft, setVersionNewsDraft] = useState('');
  const [versionNewsSavedAt, setVersionNewsSavedAt] = useState<string | null>(null);
  const [versionNewsLoading, setVersionNewsLoading] = useState(false);
  const [versionNewsSaving, setVersionNewsSaving] = useState(false);
  const [versionNewsMsg, setVersionNewsMsg] = useState<string | null>(null);
  const [selectedSyncDay, setSelectedSyncDay] = useState<string | null>(null);
  const [selectedSyncChangeId, setSelectedSyncChangeId] = useState<string | null>(null);

  const { token, status, logout } = auth;

  const loadVersionNews = useCallback(async () => {
    setVersionNewsLoading(true);
    setVersionNewsMsg(null);
    try {
      const data = await fetchVersionNews();
      setVersionNewsDraft(typeof data.news === 'string' ? data.news : '');
      setVersionNewsSavedAt(data.updatedAt);
    } catch (err) {
      setVersionNewsMsg(err instanceof Error ? err.message : 'Error al cargar novedades');
    } finally {
      setVersionNewsLoading(false);
    }
  }, []);

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
    if (status === 'unlocked') {
      void load();
      void loadVersionNews();
    }
  }, [status, load, loadVersionNews]);

  useEffect(() => {
    if (status === 'unlocked' && section === 'usage') void loadUsage();
  }, [status, section, loadUsage]);

  const handleSaveVersionNews = async () => {
    if (!token) return;
    setVersionNewsSaving(true);
    setVersionNewsMsg(null);
    try {
      const data = await saveVersionNews(token, versionNewsDraft);
      setVersionNewsDraft(data.news);
      setVersionNewsSavedAt(data.updatedAt);
      setVersionNewsMsg('Novedades de versión guardadas. Visibles en la home para todos.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar novedades';
      setVersionNewsMsg(msg);
      if (/unauthor/i.test(msg) || /401/.test(msg)) logout();
    } finally {
      setVersionNewsSaving(false);
    }
  };

  const series = useMemo(
    () => fillDailySeries(data?.dailyVisits ?? [], 30),
    [data?.dailyVisits],
  );

  const peakDay = useMemo(() => {
    if (series.length === 0) return null;
    return series.reduce((best, d) => (d.visits > best.visits ? d : best), series[0]);
  }, [series]);

  const syncDayChanges = useMemo(() => {
    if (!selectedSyncDay || !data?.changes) return [];
    return data.changes
      .filter((c) => toMadridDayKey(c.detectedAt) === selectedSyncDay)
      .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
  }, [selectedSyncDay, data?.changes]);

  const handleForceSync = async () => {
    if (!token) return;
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const result = await forceTaskSync(token);
      if (result.skipped) {
        setSyncMsg(`Sync omitido: ${result.decision?.reason ?? 'skipped'}`);
      } else {
        const day = result.run?.dayKey ?? 'hoy';
        const errPart = result.run?.error ? ` · ${result.run.error}` : '';
        setSyncMsg(
          `Sync ${result.run?.status ?? 'ok'} (${day}, intento ${result.run?.attempt ?? '?'}): `
          + `${result.run?.updated ?? 0} actualizados, ${result.run?.unchanged ?? 0} sin cambios`
          + errPart,
        );
      }
      await load();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Error al sincronizar');
      // Aunque falle (p. ej. timeout), refrescar: el intento puede haberse registrado.
      try {
        await load();
      } catch {
        /* ignore */
      }
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
      <AdminToolbar
        section="dashboard"
        title={t.adminDashboardTitle}
        appTitle={t.appTitle}
        navDashboard={t.adminNavDashboard}
        navRoutes={t.adminNavRoutes}
        navReports={t.adminReportsNav}
        logoutLabel={t.adminLogout}
        onLogout={logout}
        actions={(
          <>
            <button
              type="button"
              className="admin-tool-btn admin-tool-btn--ghost"
              onClick={() => {
                void load();
                if (section === 'usage') void loadUsage();
              }}
              disabled={loading || usageLoading}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 8A5.5 5.5 0 1 1 11.2 3.4M13.5 2.5v3.2h-3.2"
                />
              </svg>
              <span>{t.adminRefresh}</span>
            </button>
            <button
              type="button"
              className="admin-tool-btn admin-tool-btn--primary"
              onClick={() => void handleForceSync()}
              disabled={syncBusy}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9M13.5 8a5.5 5.5 0 0 1-9.4 3.9M11.5 2.2v2.9H8.6M4.5 13.8v-2.9h2.9"
                />
              </svg>
              <span>{syncBusy ? t.adminSyncing : t.adminForceSync}</span>
            </button>
          </>
        )}
      />

      {error ? <p className="admin-banner admin-banner--error">{error}</p> : null}
      {syncMsg ? <p className="admin-banner">{syncMsg}</p> : null}

      <main className="admin-dashboard">
        <section className="admin-version-news" aria-labelledby="admin-version-news-title">
          <div className="admin-version-news-head">
            <div>
              <h2 id="admin-version-news-title">Novedades de versión</h2>
              <p className="admin-muted">
                Texto del panel CRT en la home. Se guarda en Turso y se muestra al instante,
                sin depender del deploy.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-start"
              onClick={() => void handleSaveVersionNews()}
              disabled={versionNewsSaving || versionNewsLoading}
            >
              {versionNewsSaving ? 'Guardando…' : 'Guardar novedades'}
            </button>
          </div>
          <textarea
            className="admin-version-news-input"
            value={versionNewsDraft}
            onChange={(e) => setVersionNewsDraft(e.target.value)}
            rows={8}
            maxLength={4000}
            disabled={versionNewsLoading || versionNewsSaving}
            placeholder="Ej.&#10;• Flechas en mapas&#10;• Reportes KB Document&#10;• …"
            spellCheck
          />
          <div className="admin-version-news-meta">
            <span>{versionNewsDraft.length}/4000</span>
            <span>
              {versionNewsLoading
                ? 'Cargando…'
                : versionNewsSavedAt
                  ? `Última guardada: ${formatWhen(versionNewsSavedAt)}`
                  : 'Aún no hay novedades guardadas'}
            </span>
          </div>
          {versionNewsMsg ? <p className="admin-banner">{versionNewsMsg}</p> : null}
        </section>

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
            <span
              className="admin-stat-foot"
              {...(s?.lastSync?.lastSuccessAt
                ? { 'data-admin-tip': formatWhen(s.lastSync.lastSuccessAt) }
                : {})}
            >
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
                  Apilado por tipo de pass · Pico:{' '}
                  {peakDay ? `${peakDay.dayKey} (${peakDay.visits})` : '—'}
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
                <strong
                  {...(s?.lastDatasetChangeAt
                    ? { 'data-admin-tip': formatWhen(s.lastDatasetChangeAt) }
                    : {})}
                >
                  {formatRelative(s?.lastDatasetChangeAt ?? null)}
                </strong>
              </li>
              <li>
                <span>Snapshot más antiguo comprobado</span>
                <strong
                  {...(s?.oldestFetchedAt
                    ? { 'data-admin-tip': formatWhen(s.oldestFetchedAt) }
                    : {})}
                >
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
                    <option value="admin">Admin</option>
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
                      || row.accessKind === 'admin'
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
                    <th>Ant.</th>
                    <th>Nuevas</th>
                    <th>Δ</th>
                    <th>+ / ∼ / −</th>
                    <th>Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.changes.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={8} className="admin-muted">
                        Sin cambios registrados. Solo se guardan cuando el contenido del dataset difiere.
                      </td>
                    </tr>
                  ) : (
                    data?.changes.map((c) => {
                      const openChange = selectedSyncChangeId === c.id;
                      const diff = asTaskDiff(c.diff);
                      return (
                        <Fragment key={c.id}>
                          <tr
                            className={`admin-sync-change-row${openChange ? ' is-open' : ''}`}
                            onClick={() => {
                              setSelectedSyncChangeId((prev) => (prev === c.id ? null : c.id));
                            }}
                            title="Ver detalle de misiones"
                          >
                            <td title={formatWhen(c.detectedAt)}>{formatRelative(c.detectedAt)}</td>
                            <td>
                              <span className="admin-sync-day-cell">
                                <span className="admin-sync-chevron" aria-hidden>
                                  {openChange ? '▾' : '▸'}
                                </span>
                                {modeLabel(c.gameMode)}
                              </span>
                            </td>
                            <td>{c.lang}</td>
                            <td>{c.previousTaskCount ?? '—'}</td>
                            <td>{c.taskCount}</td>
                            <td>{taskCountDelta(c)}</td>
                            <td>
                              {diff
                                ? `+${diff.addedCount} / ∼${diff.updatedCount} / −${diff.removedCount}`
                                : '—'}
                            </td>
                            <td><code>{shortHash(c.contentHash)}</code></td>
                          </tr>
                          {openChange ? (
                            <tr className="admin-sync-mission-row">
                              <td colSpan={8}>
                                <SyncChangeMissionDetail change={c} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {section === 'sync' ? (
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--sync">
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
                    data?.syncDays.map((d) => {
                      const open = selectedSyncDay === d.dayKey;
                      return (
                        <Fragment key={d.dayKey}>
                          <tr
                            className={`admin-sync-row${open ? ' is-open' : ''}${d.updatedCombinations > 0 ? ' is-clickable' : ''}`}
                            onClick={() => {
                              setSelectedSyncDay((prev) => {
                                const next = prev === d.dayKey ? null : d.dayKey;
                                if (next !== prev) setSelectedSyncChangeId(null);
                                return next;
                              });
                            }}
                            title={
                              d.updatedCombinations > 0
                                ? 'Ver detalle de actualizaciones'
                                : 'Sin cambios de contenido ese día'
                            }
                          >
                            <td>
                              <span className="admin-sync-day-cell">
                                <span className="admin-sync-chevron" aria-hidden>
                                  {open ? '▾' : '▸'}
                                </span>
                                {d.dayKey}
                              </span>
                            </td>
                            <td>
                              <span className={`admin-pill admin-pill--${d.status}`}>{d.status}</span>
                            </td>
                            <td>{d.attempts}</td>
                            <td>
                              <strong className={d.updatedCombinations > 0 ? 'admin-sync-updated' : undefined}>
                                {d.updatedCombinations}
                              </strong>
                            </td>
                            <td title={formatWhen(d.lastSuccessAt)}>{formatRelative(d.lastSuccessAt)}</td>
                            <td className="admin-cell-error">{d.lastError ?? '—'}</td>
                          </tr>
                          {open ? (
                            <tr className="admin-sync-detail-row">
                              <td colSpan={6}>
                                <div className="admin-sync-detail">
                                  <p className="admin-sync-detail-title">
                                    Actualizaciones del {d.dayKey}
                                    {' · '}
                                    {d.updatedCombinations} combinaciones con contenido nuevo
                                  </p>
                                  {syncDayChanges.length === 0 ? (
                                    <p className="admin-muted">
                                      {d.updatedCombinations > 0
                                        ? 'No hay filas de cambio en el historial reciente para este día (pueden haber expirado de la vista).'
                                        : 'Ningún dataset cambió de contenido: solo se refrescaron fechas de comprobación.'}
                                    </p>
                                  ) : (
                                    <table className="admin-table admin-table--nested">
                                      <thead>
                                        <tr>
                                          <th>#</th>
                                          <th>Modo</th>
                                          <th>Lang</th>
                                          <th>Ant.</th>
                                          <th>Nuevas</th>
                                          <th>Δ</th>
                                          <th>+ / ∼ / −</th>
                                          <th>Detectado</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {syncDayChanges.map((c, index) => {
                                          const openChange = selectedSyncChangeId === c.id;
                                          const diff = asTaskDiff(c.diff);
                                          return (
                                            <Fragment key={c.id}>
                                              <tr
                                                className={`admin-sync-change-row${openChange ? ' is-open' : ''}`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedSyncChangeId((prev) =>
                                                    prev === c.id ? null : c.id,
                                                  );
                                                }}
                                                title="Ver misiones añadidas / actualizadas / eliminadas"
                                              >
                                                <td>{index + 1}</td>
                                                <td>
                                                  <span className="admin-sync-day-cell">
                                                    <span className="admin-sync-chevron" aria-hidden>
                                                      {openChange ? '▾' : '▸'}
                                                    </span>
                                                    {modeLabel(c.gameMode)}
                                                  </span>
                                                </td>
                                                <td>{c.lang}</td>
                                                <td>{c.previousTaskCount ?? '—'}</td>
                                                <td>{c.taskCount}</td>
                                                <td>{taskCountDelta(c)}</td>
                                                <td>
                                                  {diff
                                                    ? `+${diff.addedCount} / ∼${diff.updatedCount} / −${diff.removedCount}`
                                                    : '—'}
                                                </td>
                                                <td title={formatWhen(c.detectedAt)}>
                                                  {formatRelative(c.detectedAt)}
                                                </td>
                                              </tr>
                                              {openChange ? (
                                                <tr className="admin-sync-mission-row">
                                                  <td colSpan={8}>
                                                    <SyncChangeMissionDetail change={c} />
                                                  </td>
                                                </tr>
                                              ) : null}
                                            </Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
              <p className="admin-footnote">
                Clic en el día y luego en un modo (p. ej. PvE) para ver misiones añadidas, actualizadas o eliminadas.
                El detalle por misión solo está disponible en syncs posteriores a esta función.
              </p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
