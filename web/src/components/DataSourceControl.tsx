import { useMemo, useState } from 'react';
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
  /** Estado en logs de esas misiones (solo las no emparejadas). */
  unmatchedTaskStates?: Record<string, TaskProgressState | string>;
  breakpoints: WipeBreakpoint[];
  wipeStartSelection: string | null;
  resolvedWipeStartSession: string | null;
  onChangeWipeStart: (selection: string | null) => void;
  knownProfiles: LogProfileInfo[];
  activeProfileId: string | null;
  onAssignProfileMode: (profileId: string, mode: LogProfileGameMode | null) => void;
  /** false en Firefox: hay que volver a elegir la carpeta para refrescar. */
  canLivePoll: boolean;
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
  const [wipeMenuOpen, setWipeMenuOpen] = useState(false);
  const [profilesMenuOpen, setProfilesMenuOpen] = useState(false);
  const [unmatchedTipOpen, setUnmatchedTipOpen] = useState(false);
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
                  !canLivePoll ? t.logsSnapshotHint : null,
                  hasUnassigned ? t.logsProfileNeedsAssign : null,
                ].filter(Boolean).join('\n')}
              >
                {lastSyncedAt ? t.logsSyncedAt(lastSyncedAt.toLocaleTimeString(locale)) : folderName}
              </span>
              {unmatchedTaskIds.length > 0 && (
                <span
                  className="log-sync-unmatched"
                  onMouseEnter={() => setUnmatchedTipOpen(true)}
                  onMouseLeave={() => setUnmatchedTipOpen(false)}
                  onFocus={() => setUnmatchedTipOpen(true)}
                  onBlur={() => setUnmatchedTipOpen(false)}
                  tabIndex={0}
                  aria-label={t.logsUnmatchedTitle(unmatchedTaskIds.length)}
                >
                  <span className="log-sync-stats log-sync-stats--warn">
                    ⚠ {unmatchedTaskIds.length}
                  </span>
                  {unmatchedTipOpen && (
                    <div className="log-sync-unmatched-tip" role="tooltip">
                      <strong className="log-sync-unmatched-tip-title">
                        {t.logsUnmatchedTitle(unmatchedTaskIds.length)}
                      </strong>
                      <p className="log-sync-unmatched-tip-body">{t.logsUnmatchedBody}</p>
                      {unmatchedStatusLine && (
                        <p className="log-sync-unmatched-tip-status">{unmatchedStatusLine}</p>
                      )}
                      <p className="log-sync-unmatched-tip-ok">{t.logsUnmatchedOk}</p>
                    </div>
                  )}
                </span>
              )}
              {knownProfiles.length > 0 && (
                <div className="wipe-start-picker">
                  <button
                    type="button"
                    className={`btn-icon-ghost${hasUnassigned ? ' is-warn' : ''}`}
                    title={t.logsProfilesTitle}
                    aria-label={t.logsProfilesTitle}
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
                  {profilesMenuOpen && (
                    <>
                      <div
                        className="wipe-start-backdrop"
                        onClick={() => setProfilesMenuOpen(false)}
                      />
                      <div className="wipe-start-menu log-profiles-menu">
                        <div className="wipe-start-menu-title">{t.logsProfilesTitle}</div>
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
                    </>
                  )}
                </div>
              )}
              <div className="wipe-start-picker">
                <button
                  type="button"
                  className="btn-icon-ghost"
                  title={t.logsWipeStartTitle}
                  aria-label={t.logsWipeStartTitle}
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
                  </>
                )}
              </div>
              <button
                type="button"
                className="btn-icon-ghost"
                title={canLivePoll ? t.logsChangeFolder : t.logsRefreshFolder}
                aria-label={canLivePoll ? t.logsChangeFolder : t.logsRefreshFolder}
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
