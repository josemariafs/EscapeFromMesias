import type { ReactNode } from 'react';
import { APP_VERSION, BUILD_TIME, formatBuildTime } from '../buildInfo';
import { useVisitCounter } from '../hooks/useVisitCounter';

interface AppFooterProps {
  locale: string;
  notices?: ReactNode;
  formatVisits: (n: number) => string;
}

export function AppFooter({ locale, notices, formatVisits }: AppFooterProps) {
  const { impressions } = useVisitCounter();

  return (
    <footer className={`app-footer${notices ? ' app-footer--with-notices' : ''}`}>
      {notices && <div className="app-footer-notices">{notices}</div>}
      <div className="app-footer-meta">
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
