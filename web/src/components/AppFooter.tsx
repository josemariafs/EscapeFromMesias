import { APP_VERSION, BUILD_TIME, formatBuildTime } from '../buildInfo';

interface AppFooterProps {
  locale: string;
}

export function AppFooter({ locale }: AppFooterProps) {
  return (
    <footer className="app-footer">
      <span>v{APP_VERSION}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={BUILD_TIME}>{formatBuildTime(BUILD_TIME, locale)}</time>
    </footer>
  );
}
