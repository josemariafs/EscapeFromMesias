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
}

export function AppFooter({
  locale,
  notices,
  formatVisits,
  formatOnline,
  feedbackLabel,
  onOpenFeedback,
}: AppFooterProps) {
  const { impressions } = useVisitCounter();
  const { online } = useOnlinePresence();

  return (
    <footer className={`app-footer${notices ? ' app-footer--with-notices' : ''}`}>
      {notices && <div className="app-footer-notices">{notices}</div>}
      <div className="app-footer-meta">
        <button type="button" className="app-footer-feedback" onClick={onOpenFeedback}>
          {feedbackLabel}
        </button>
        <span aria-hidden="true">·</span>
        {online != null && (
          <>
            <span className="app-footer-online" title={formatOnline(online)}>
              <span className="app-footer-online-dot" aria-hidden="true" />
              {formatOnline(online)}
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        {impressions != null && (
          <>
            <span className="app-footer-visits" title={formatVisits(impressions)}>
              {formatVisits(impressions)}
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>v{APP_VERSION}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={BUILD_TIME}>{formatBuildTime(BUILD_TIME, locale)}</time>
      </div>
    </footer>
  );
}
