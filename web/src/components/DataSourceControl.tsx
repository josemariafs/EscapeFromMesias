import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataSourceMode } from '../hooks/useDataSource';
import {
  NO_SESSION_FOLDERS_ERROR,
  WIPE_START_ALL,
  type LogProfileInfo,
  type TarkovLogSyncStatus,
  type WipeBreakpoint,
} from '../hooks/useTarkovLogSync';
import type { TaskProgressState } from '../types';
import type { LogProfileGameMode } from '../utils/logProfileModes';
import { shortProfileId } from '../utils/logProfileModes';
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
  unmatchedTaskStates?: Record<string, TaskProgressState | string>;
  breakpoints: WipeBreakpoint[];
  wipeStartSelection: string | null;
  resolvedWipeStartSession: string | null;
  onChangeWipeStart: (selection: string | null) => void;
  knownProfiles: LogProfileInfo[];
  activeProfileId: string | null;
  onAssignProfileMode: (profileId: string, mode: LogProfileGameMode | null) => void;
  canLivePoll: boolean;
  locale: string;
  t: Translations;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
}

/**
 * Toggle Local/Logs + (en Logs) chip compacto que abre un panel con herramientas.
 */
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
  unmatchedTaskStates = {},
  breakpoints,
  wipeStartSelection,
  resolvedWipeStartSession,
  onChangeWipeStart,
  knownProfiles,
  activeProfileId,
  onAssignProfileMode,
  canLivePoll,
  locale,
  t,
  onConnect,
  onReconnect,
  onDisconnect,
}: DataSourceControlProps) {
  const supported = isLogSyncSupported();
  const [panelOpen, setPanelOpen] = useState(false);
  const [wipeMenuOpen, setWipeMenuOpen] = useState(false);
  const [profilesMenuOpen, setProfilesMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasUnassigned = knownProfiles.some((p) => p.mode == null);

  const unmatchedStatusLine = useMemo(() => {
    let completed = 0;
    let started = 0;
    let failed = 0;
    for (const id of unmatchedTaskIds) {
      const state = unmatchedTaskStates[id];
      if (state === 'completed') completed += 1;
      else if (state === 'started') started += 1;
      else if (state === 'failed') failed += 1;
    }
    return t.logsUnmatchedStatus(completed, started, failed);
  }, [unmatchedTaskIds, unmatchedTaskStates, t]);

  useEffect(() => {
    if (dataSource !== 'logs') setPanelOpen(false);
  }, [dataSource]);

  useEffect(() => {
    if (!panelOpen) return undefined;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPanelOpen(false);
        setWipeMenuOpen(false);
        setProfilesMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanelOpen(false);
        setWipeMenuOpen(false);
        setProfilesMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [panelOpen]);

  const syncLabel = lastSyncedAt
    ? t.logsSyncedAt(lastSyncedAt.toLocaleTimeString(locale))
    : folderName ?? t.dataSourceLogs;

  return (
    <div className="data-source-control data-source-control--compact" ref={rootRef}>
      <div className="data-source-mode">
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
      </div>

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
          {status === 'error' && (
            <>
              <span className="log-sync-text log-sync-error">
                {t.logsErrorPrefix}
                {': '}
                {errorMessage === NO_SESSION_FOLDERS_ERROR ? t.logsNoSessionsFoundError : errorMessage}
              </span>
              <button type="button" className="btn btn-connect-logs" onClick={onConnect}>
                {t.logsChangeFolder}
              </button>
              {errorMessage !== NO_SESSION_FOLDERS_ERROR && (
                <button type="button" className="btn btn-connect-logs" onClick={onReconnect}>
                  {t.logsRetry}
                </button>
              )}
            </>
          )}
          {status === 'syncing' && (
            <>
              <button
                type="button"
                className={`logs-panel-trigger${panelOpen ? ' is-open' : ''}${taskCount === 0 ? ' is-warn' : ''}`}
                aria-expanded={panelOpen}
                aria-controls="logs-sync-panel"
                title={t.logsPanelManage}
                onClick={() => setPanelOpen((open) => !open)}
              >
                <span className={`log-sync-dot${taskCount === 0 ? ' log-sync-dot--warn' : ''}`} aria-hidden />
                <span className="logs-panel-trigger-label">{syncLabel}</span>
                {unmatchedTaskIds.length > 0 && (
                  <span className="logs-panel-trigger-warn">⚠ {unmatchedTaskIds.length}</span>
                )}
                <span className="logs-panel-trigger-chevron" aria-hidden>
                  {panelOpen ? '▴' : '▾'}
                </span>
              </button>

              {panelOpen && (
                <div className="logs-panel" id="logs-sync-panel" role="dialog" aria-label={t.logsPanelTitle}>
                  <header className="logs-panel-head">
                    <div>
                      <strong>{t.logsPanelTitle}</strong>
                      {folderName && <p className="logs-panel-folder">{folderName}</p>}
                    </div>
                    <button
                      type="button"
                      className="btn-icon-ghost"
                      aria-label={t.close}
                      onClick={() => setPanelOpen(false)}
                    >
                      ×
                    </button>
                  </header>

                  <p className="logs-panel-stats">
                    {t.logsStats(sessionCount, totalSessionCount, taskCount, wipeVersion)}
                  </p>
                  {taskCount === 0 && (
                    <p className="logs-panel-hint logs-panel-hint--warn">{t.logsNoEventsHint}</p>
                  )}
                  {!canLivePoll && (
                    <p className="logs-panel-hint">{t.logsSnapshotHint}</p>
                  )}
                  {hasUnassigned && (
                    <p className="logs-panel-hint logs-panel-hint--warn">{t.logsProfileNeedsAssign}</p>
                  )}

                  {unmatchedTaskIds.length > 0 && (
                    <div className="logs-panel-block logs-panel-block--warn">
                      <strong>{t.logsUnmatchedTitle(unmatchedTaskIds.length)}</strong>
                      <p>{t.logsUnmatchedBody}</p>
                      {unmatchedStatusLine && <p>{unmatchedStatusLine}</p>}
                      <p className="logs-panel-ok">{t.logsUnmatchedOk}</p>
                    </div>
                  )}

                  <p className="logs-panel-help" title={t.logsPathHint}>
                    <span className="help-icon" aria-hidden>?</span>
                    {t.logsPathHint.split('\n')[0]}
                  </p>

                  {knownProfiles.length > 0 && (
                    <div className="logs-panel-block">
                      <div className="logs-panel-block-head">
                        <strong>{t.logsProfilesTitle}</strong>
                        <button
                          type="button"
                          className={`btn-icon-ghost${hasUnassigned ? ' is-warn' : ''}`}
                          title={t.logsProfilesTitle}
                          aria-expanded={profilesMenuOpen}
                          onClick={() => {
                            setProfilesMenuOpen((open) => !open);
                            setWipeMenuOpen(false);
                          }}
                        >
                          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                            <circle cx="8" cy="5.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                            <path
                              d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                      {profilesMenuOpen && (
                        <div className="log-profiles-menu logs-panel-submenu">
                          <p className="log-profiles-hint">{t.logsProfilesHint}</p>
                          {knownProfiles.map((profile) => (
                            <div key={profile.profileId} className="log-profile-row">
                              <div className="log-profile-meta">
                                <strong title={profile.profileId}>
                                  {shortProfileId(profile.profileId)}
                                </strong>
                                <span>
                                  v{profile.lastVersion}
                                  {activeProfileId === profile.profileId
                                    ? ` · ${t.logsProfileActive}`
                                    : ''}
                                </span>
                              </div>
                              <div className="log-profile-actions" role="group">
                                <button
                                  type="button"
                                  className={`wipe-start-option log-profile-mode-btn${profile.mode === 'regular' ? ' active' : ''}`}
                                  onClick={() => onAssignProfileMode(profile.profileId, 'regular')}
                                >
                                  {t.logsProfileRegular}
                                </button>
                                <button
                                  type="button"
                                  className={`wipe-start-option log-profile-mode-btn${profile.mode === 'seasonal' ? ' active' : ''}`}
                                  onClick={() => onAssignProfileMode(profile.profileId, 'seasonal')}
                                >
                                  {t.logsProfileSeasonal}
                                </button>
                              </div>
                              {profile.mode == null && (
                                <span className="log-profile-unassigned">{t.logsProfileUnassigned}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="logs-panel-block">
                    <div className="logs-panel-block-head">
                      <strong>{t.logsWipeStartTitle}</strong>
                      <button
                        type="button"
                        className="btn-icon-ghost"
                        title={t.logsWipeStartTitle}
                        aria-expanded={wipeMenuOpen}
                        onClick={() => {
                          setWipeMenuOpen((open) => !open);
                          setProfilesMenuOpen(false);
                        }}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                          <circle cx="8" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                          <path d="M8 5.5v3l2.2 1.3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                    {wipeMenuOpen && (
                      <div className="logs-panel-submenu">
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
                            title={bp.profileId}
                          >
                            {t.logsWipeStartOption(new Date(bp.timestamp).toLocaleString(locale), bp.version)}
                            {` · ${shortProfileId(bp.profileId)}`}
                            {resolvedWipeStartSession === bp.session && wipeStartSelection == null && (
                              <span className="wipe-start-auto-tag">{t.logsWipeStartAutoTag}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="logs-panel-actions">
                    <button type="button" className="btn btn-connect-logs" onClick={onConnect}>
                      {canLivePoll ? t.logsChangeFolder : t.logsRefreshFolder}
                    </button>
                    <button
                      type="button"
                      className="btn btn-wipe"
                      onClick={() => {
                        onDisconnect();
                        setPanelOpen(false);
                      }}
                    >
                      {t.logsDisconnect}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
