import type { ReactNode } from 'react';
import { APP_VERSION, BUILD_TIME, formatBuildTime } from '../buildInfo';
import { useOnlinePresence } from '../hooks/useOnlinePresence';
import { useVisitCounter } from '../hooks/useVisitCounter';

interface AppFooterProps {
  locale: string;
  notices?: ReactNode;
  formatVisits: (n: number) => string;
  formatOnline: (n: number) => string;
  feedbackLabel: string;
  onOpenFeedback: () => void;
  kbReportLabel: string;
  onOpenKbReport: () => void;
  lastUpdateLabel: string;
  logoutLabel: string;
  onLogout: () => void;
}

export function AppFooter({
  locale,
  notices,
  formatVisits,
  formatOnline,
  feedbackLabel,
  onOpenFeedback,
  kbReportLabel,
  onOpenKbReport,
  lastUpdateLabel,
  logoutLabel,
  onLogout,
}: AppFooterProps) {
  const { impressions } = useVisitCounter();
  const { online } = useOnlinePresence();

  return (
    <footer className={`app-footer${notices ? ' app-footer--with-notices' : ''}`}>
      {notices && <div className="app-footer-notices">{notices}</div>}
      <div className="app-footer-bar">
        <div className="app-footer-group app-footer-group--meta">
          <span className="app-footer-chip app-footer-version">v{APP_VERSION}</span>
          <span className="app-footer-chip app-footer-updated" title={lastUpdateLabel}>
            <span className="app-footer-updated-label">{lastUpdateLabel}</span>
            <time dateTime={BUILD_TIME}>{formatBuildTime(BUILD_TIME, locale)}</time>
          </span>
        </div>

        <div className="app-footer-group app-footer-group--status">
          {online != null && (
            <span className="app-footer-chip app-footer-online" title={formatOnline(online)}>
              <span className="app-footer-online-dot" aria-hidden="true" />
              {formatOnline(online)}
            </span>
          )}
          {impressions != null && (
            <span className="app-footer-chip app-footer-visits" title={formatVisits(impressions)}>
              {formatVisits(impressions)}
            </span>
          )}
        </div>

        <div className="app-footer-group app-footer-group--actions">
          <button type="button" className="app-footer-link" onClick={onOpenFeedback}>
            {feedbackLabel}
          </button>
          <button type="button" className="app-footer-link" onClick={onOpenKbReport}>
            {kbReportLabel}
          </button>
          <button type="button" className="app-footer-link app-footer-link--danger" onClick={onLogout}>
            {logoutLabel}
          </button>
        </div>
      </div>
    </footer>
  );
}
