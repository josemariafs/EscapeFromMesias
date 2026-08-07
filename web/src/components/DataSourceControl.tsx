import { useState } from 'react';
import type { DataSourceMode } from '../hooks/useDataSource';
import {
  NO_SESSION_FOLDERS_ERROR,
  WIPE_START_ALL,
  type TarkovLogSyncStatus,
  type WipeBreakpoint,
} from '../hooks/useTarkovLogSync';
import { isLogSyncSupported } from '../utils/tarkovLogsFs';
import type { Translations } from '../i18n/translations';

interface DataSourceControlProps {
  dataSource: DataSourceMode;
  onChangeDataSource: (mode: DataSourceMode) => void;
  status: TarkovLogSyncStatus;
  folderName: string | null;
  lastSyncedAt: Date | null;
  errorMessage: string | null;
  sessionCount: number;
  totalSessionCount: number;
  taskCount: number;
  wipeVersion: string | null;
  unmatchedTaskIds: string[];
  breakpoints: WipeBreakpoint[];
  wipeStartSelection: string | null;
  resolvedWipeStartSession: string | null;
  onChangeWipeStart: (selection: string | null) => void;
  locale: string;
  t: Translations;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
}

export function DataSourceControl({
  dataSource,
  onChangeDataSource,
  status,
  folderName,
  lastSyncedAt,
  errorMessage,
  sessionCount,
  totalSessionCount,
  taskCount,
  wipeVersion,
  unmatchedTaskIds,
  breakpoints,
  wipeStartSelection,
  resolvedWipeStartSession,
  onChangeWipeStart,
  locale,
  t,
  onConnect,
  onReconnect,
  onDisconnect,
}: DataSourceControlProps) {
  const supported = isLogSyncSupported();
  const [wipeMenuOpen, setWipeMenuOpen] = useState(false);

  return (
    <div className="data-source-control">
      <div className="data-source-toggle" role="group" aria-label={t.dataSource}>
        <button
          type="button"
          className={`data-source-btn${dataSource === 'localStorage' ? ' active' : ''}`}
          onClick={() => onChangeDataSource('localStorage')}
          aria-pressed={dataSource === 'localStorage'}
        >
          {t.dataSourceLocal}
        </button>
        <button
          type="button"
          className={`data-source-btn${dataSource === 'logs' ? ' active' : ''}`}
          onClick={() => onChangeDataSource('logs')}
          aria-pressed={dataSource === 'logs'}
          disabled={!supported}
          title={supported ? undefined : t.dataSourceLogsUnsupportedTitle}
        >
          {t.dataSourceLogs}
        </button>
      </div>

      {dataSource === 'logs' && (
        <span
          className="help-icon"
          tabIndex={0}
          role="note"
          title={t.logsPathHint}
          aria-label={t.logsPathHint}
        >
          ?
        </span>
      )}

      {dataSource === 'logs' && (
        <div className={`log-sync-status log-sync-status--${status}`}>
          {status === 'unsupported' && (
            <span className="log-sync-text">{t.dataSourceLogsUnsupportedTitle}</span>
          )}
          {status === 'disconnected' && (
            <button type="button" className="btn btn-connect-logs" onClick={onConnect}>
              {t.logsConnect}
            </button>
          )}
          {status === 'connecting' && (
            <span className="log-sync-text">{t.logsConnecting}</span>
          )}
          {status === 'needs-permission' && (
            <>
              <span className="log-sync-text">{t.logsNeedsPermission}</span>
              <button type="button" className="btn btn-connect-logs" onClick={onReconnect}>
                {t.logsReconnect}
              </button>
            </>
          )}
          {status === 'syncing' && (
            <>
              <span className={`log-sync-dot${taskCount === 0 ? ' log-sync-dot--warn' : ''}`} aria-hidden="true" />
              <span
                className="log-sync-text"
                title={[
                  folderName,
                  t.logsStats(sessionCount, totalSessionCount, taskCount, wipeVersion),
                  taskCount === 0 ? t.logsNoEventsHint : null,
                ].filter(Boolean).join('\n')}
              >
                {lastSyncedAt ? t.logsSyncedAt(lastSyncedAt.toLocaleTimeString(locale)) : folderName}
              </span>
              {unmatchedTaskIds.length > 0 && (
                <span
                  className="log-sync-stats log-sync-stats--warn"
                  title={`${t.logsUnmatchedIds(unmatchedTaskIds.length)}:\n${unmatchedTaskIds.slice(0, 15).join('\n')}`}
                >
                  ⚠ {unmatchedTaskIds.length}
                </span>
              )}
              <div className="wipe-start-picker">
                <button
                  type="button"
                  className="btn-icon-ghost"
                  title={t.logsWipeStartTitle}
                  aria-label={t.logsWipeStartTitle}
                  onClick={() => setWipeMenuOpen((open) => !open)}
                >
                  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                    <circle cx="8" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M8 5.5v3l2.2 1.3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
                {wipeMenuOpen && (
                  <>
                  <div className="wipe-start-backdrop" onClick={() => setWipeMenuOpen(false)} />
                  <div className="wipe-start-menu">
                    <div className="wipe-start-menu-title">{t.logsWipeStartTitle}</div>
                    <button
                      type="button"
                      className={`wipe-start-option${wipeStartSelection == null ? ' active' : ''}`}
                      onClick={() => { onChangeWipeStart(null); setWipeMenuOpen(false); }}
                    >
                      {t.logsWipeStartAuto}
                    </button>
                    <button
                      type="button"
                      className={`wipe-start-option${wipeStartSelection === WIPE_START_ALL ? ' active' : ''}`}
                      onClick={() => { onChangeWipeStart(WIPE_START_ALL); setWipeMenuOpen(false); }}
                    >
                      {t.logsWipeStartAll}
                    </button>
                    {breakpoints.length > 0 && <div className="wipe-start-menu-divider" />}
                    {[...breakpoints].reverse().map((bp) => (
                      <button
                        type="button"
                        key={bp.session}
                        className={`wipe-start-option${wipeStartSelection === bp.session ? ' active' : ''}`}
                        onClick={() => { onChangeWipeStart(bp.session); setWipeMenuOpen(false); }}
                      >
                        {t.logsWipeStartOption(new Date(bp.timestamp).toLocaleString(locale), bp.version)}
                        {resolvedWipeStartSession === bp.session && wipeStartSelection == null && (
                          <span className="wipe-start-auto-tag">{t.logsWipeStartAutoTag}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  </>
                )}
              </div>
              <button
                type="button"
                className="btn-icon-ghost"
                title={t.logsChangeFolder}
                aria-label={t.logsChangeFolder}
                onClick={onConnect}
              >
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <path
                    d="M2 4a1 1 0 0 1 1-1h3.2l1 1.2H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="btn-icon-ghost"
                title={t.logsDisconnect}
                aria-label={t.logsDisconnect}
                onClick={onDisconnect}
              >
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </>
          )}
          {status === 'error' && (
            <>
              <span className="log-sync-text log-sync-error">
                {t.logsErrorPrefix}
                {': '}
                {errorMessage === NO_SESSION_FOLDERS_ERROR ? t.logsNoSessionsFoundError : errorMessage}
              </span>
              <button type="button" className="btn btn-connect-logs" onClick={onReconnect}>
                {t.logsRetry}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
