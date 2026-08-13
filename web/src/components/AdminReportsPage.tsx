import { useCallback, useEffect, useState } from 'react';
import {
  fetchKbDocumentReports,
  reviewKbDocumentReport,
  type KbDocumentReport,
  type KbReportStatus,
} from '../api/kbReports';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useLanguage } from '../i18n/useLanguage';
import { KB_MARKER_ICON_URL } from '../types/routes';
import { getMapSvgUrl, ROUTE_MAPS } from '../utils/maps';
import { AdminLoginCard } from './AdminLoginCard';
import { AdminToolbar } from './AdminToolbar';

function mapLabel(mapKey: string): string {
  return ROUTE_MAPS.find((m) => m.key === mapKey)?.name ?? mapKey;
}

export function AdminReportsPage() {
  const { t } = useLanguage();
  const auth = useAdminAuth();
  const [statusFilter, setStatusFilter] = useState<KbReportStatus>('pending');
  const [reports, setReports] = useState<KbDocumentReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchKbDocumentReports(auth.token, statusFilter);
      setReports(list);
      setSelectedId((current) => {
        if (current && list.some((r) => r.id === current)) return current;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setReports([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [auth.token, statusFilter]);

  useEffect(() => {
    if (auth.status === 'unlocked') void load();
  }, [auth.status, load]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;
  const mapUrl = selected ? getMapSvgUrl(selected.mapKey) : null;

  const handleReview = async (reportId: string, action: 'accept' | 'reject') => {
    if (!auth.token) return;
    setBusyId(reportId);
    setError(null);
    try {
      await reviewKbDocumentReport(auth.token, reportId, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  if (auth.status === 'checking') {
    return (
      <div className="admin-page admin-page--login">
        <div className="loader" />
      </div>
    );
  }

  if (auth.status === 'locked') {
    return (
      <div className="admin-page admin-page--login">
        <AdminLoginCard
          title={t.adminReportsTitle}
          subtitle={t.adminReportsHint}
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
    <div className="admin-page admin-reports-page">
      <AdminToolbar
        section="reports"
        title={t.adminReportsTitle}
        appTitle={t.appTitle}
        navDashboard={t.adminNavDashboard}
        navRoutes={t.adminNavRoutes}
        navReports={t.adminReportsNav}
        logoutLabel={t.adminLogout}
        onLogout={auth.logout}
        actions={(
          <button
            type="button"
            className="admin-tool-btn admin-tool-btn--ghost"
            onClick={() => void load()}
            disabled={loading}
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
            <span>{t.adminReportsRefresh}</span>
          </button>
        )}
        secondary={(
          <div className="segmented" role="tablist" aria-label={t.adminReportsFilter}>
            {(['pending', 'accepted', 'rejected'] as const).map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={statusFilter === status}
                className={`segmented-item${statusFilter === status ? ' active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'pending'
                  ? t.adminReportsPending
                  : status === 'accepted'
                    ? t.adminReportsAccepted
                    : t.adminReportsRejected}
              </button>
            ))}
          </div>
        )}
      />

      {error && <p className="admin-action-error">{error}</p>}

      <div className="admin-reports-body">
        <aside className="admin-reports-list">
          {loading && <p className="admin-reports-empty">{t.adminWorking}</p>}
          {!loading && reports.length === 0 && (
            <p className="admin-reports-empty">{t.adminReportsEmpty}</p>
          )}
          <ul>
            {reports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  className={`admin-reports-item${selectedId === report.id ? ' active' : ''}`}
                  onClick={() => setSelectedId(report.id)}
                >
                  <strong>{report.label?.trim() || t.adminMarkerTypeKeyDocument}</strong>
                  <span>
                    {mapLabel(report.mapKey)}
                    {' · '}
                    {report.environment === 'regular'
                      ? t.routeEnvironmentRegular
                      : t.routeEnvironmentSeasonal}
                  </span>
                  <span className="admin-reports-item-date">
                    {new Date(report.createdAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="admin-reports-detail">
          {!selected ? (
            <p className="admin-reports-empty">{t.adminReportsSelect}</p>
          ) : (
            <>
              <header className="admin-reports-detail-header">
                <div>
                  <h2>{selected.label?.trim() || t.adminMarkerTypeKeyDocument}</h2>
                  <p>
                    {mapLabel(selected.mapKey)}
                    {' · '}
                    {selected.environment === 'regular'
                      ? t.routeEnvironmentRegular
                      : t.routeEnvironmentSeasonal}
                    {selected.submittedBy ? ` · ${selected.submittedBy}` : ''}
                  </p>
                </div>
                {selected.status === 'pending' && (
                  <div className="admin-reports-detail-actions">
                    <button
                      type="button"
                      className="btn btn-wipe"
                      disabled={busyId === selected.id}
                      onClick={() => void handleReview(selected.id, 'reject')}
                    >
                      {t.adminReportsReject}
                    </button>
                    <button
                      type="button"
                      className="btn btn-start"
                      disabled={busyId === selected.id}
                      onClick={() => void handleReview(selected.id, 'accept')}
                    >
                      {t.adminReportsAccept}
                    </button>
                  </div>
                )}
              </header>

              <div className="admin-reports-preview">
                {mapUrl && (
                  <div className="admin-reports-map">
                    <img src={mapUrl} alt={mapLabel(selected.mapKey)} draggable={false} />
                    <span
                      className="admin-reports-map-pin"
                      style={{ left: `${selected.left}%`, top: `${selected.top}%` }}
                    >
                      <img src={KB_MARKER_ICON_URL} alt="" draggable={false} />
                    </span>
                  </div>
                )}
                <div className="admin-reports-image">
                  <img src={selected.imageUrl} alt={selected.label ?? ''} />
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
