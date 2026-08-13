import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActiveTasksView } from './components/ActiveTasksView';
import { AppFooter } from './components/AppFooter';
import { KbDocumentReportModal } from './components/KbDocumentReportModal';
import { DataSourceControl } from './components/DataSourceControl';
import { CrtViewTransition } from './components/CrtViewTransition';
import { FeedbackModal } from './components/FeedbackModal';
import { HeaderAccessCode } from './components/HeaderAccessCode';
import { HeaderAppMenu } from './components/HeaderAppMenu';
import { HomeUsageScreen, type HomeUsageChoice } from './components/HomeUsageScreen';
import { useSiteAuthContext } from './context/SiteAuthContext';
import { useCrtViewTransition } from './hooks/useCrtViewTransition';
import { RouteMapsView } from './components/RouteMapsView';
import { StoryView } from './components/StoryView';
import { getChapterDesc } from './utils/storylineData';
import { StoryDetail } from './components/StoryDetail';
import { TaskCard } from './components/TaskCard';
import { TaskTableView } from './components/TaskTableView';
import { TaskDetail } from './components/TaskDetail';
import { TraderLevelsPanel } from './components/TraderLevelsPanel';
import { getTranslations } from './i18n/translations';
import { useLanguage } from './i18n/useLanguage';
import { useDataSource } from './hooks/useDataSource';
import { useGameMode } from './hooks/useGameMode';
import { useViewMode } from './hooks/useViewMode';
import { useProgress } from './hooks/useProgress';
import { useLogsOverrides } from './hooks/useLogsOverrides';
import { useFixedRouteMaps } from './hooks/useFixedRouteMaps';
import { useMapExtracts } from './hooks/useMapExtracts';
import { useRouteMaps } from './hooks/useRouteMaps';
import { useStoryProgress } from './hooks/useStoryProgress';
import { useTarkovLogSync } from './hooks/useTarkovLogSync';
import { useTasks } from './hooks/useTasks';
import { storylineData } from './utils/storylineData';
import { recalculateStates, sortTasksForDisplay } from './utils/unlock';
import { isSideTask, isStoryApiTask } from './utils/taskCategory';
import { MIN_VALID_TASK_COUNT } from './types';
import type { RouteEnvironment } from './types/routes';
import {
  flushUsageEvents,
  setUsageContext,
  trackSessionStartOnce,
  trackUsage,
} from './utils/usageAnalytics';
import './App.css';

type AppUsage = 'home' | 'quests' | 'routes';
type ViewTab = 'all' | 'active' | 'completed';
type AllQuestTab = 'story' | 'side';

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const { isTable: isTableView } = useViewMode();
  const { gameMode, setGameMode } = useGameMode();
  const { dataSource, setDataSource, isLogsMode } = useDataSource();
  const {
    kind: accessKind,
    canRevealDailyCode,
    canAccessAdmin,
    useGorditosLogo,
    logout: siteLogout,
  } = useSiteAuthContext();
  const brandLogoSrc = useGorditosLogo ? '/gorditos-logo.png' : '/logo.png';
  const brandLogoClass = useGorditosLogo ? ' brand-logo--gorditos' : '';
  const seasonalGameLogoSrc = '/brand/kord-breach-season1.png';
  const { active: crtActive, playId: crtPlayId, transitionTo } = useCrtViewTransition();
  const [appUsage, setAppUsage] = useState<AppUsage>('home');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [kbReportOpen, setKbReportOpen] = useState(false);
  /** Routes y Seasonal comparten mapas; PVP Zone (regular) tiene los suyos. */
  const routeEnvironment: RouteEnvironment =
    appUsage === 'routes' || gameMode === 'seasonal' ? 'seasonal' : 'regular';
  const { tasks, loading, error, usingStaleCache, apiError, reload } = useTasks(lang, gameMode);
  const {
    progress,
    traders,
    setPlayerLevel,
    setTraderLevel,
    syncTraderLevelsFromTaskStates,
    syncPlayerLevelFromTaskStates,
    startTask,
    completeTask,
    resetTask,
    toggleObjective,
    setCustomMapMarker,
    clearCustomMapMarker,
  } = useProgress(tasks, gameMode);
  const logSync = useTarkovLogSync(isLogsMode, gameMode);
  const logsOverrides = useLogsOverrides(gameMode);
  // El estado solo se bloquea a edición manual una vez la sincronización con los
  // logs está realmente activa; mientras se conecta o falla, se permite edición manual.
  const isLogsLocked = isLogsMode && logSync.status === 'syncing';
  const {
    nodes: storyNodes,
    progress: storyProgress,
    startNode,
    completeNode,
    resetNode,
    getRequirementNames,
  } = useStoryProgress(gameMode);
  const {
    routes,
    colorLabels,
    selectedColor,
    setSelectedColor,
    setColorLabel,
    getPoints,
    getArrows,
    arrows: routeArrowsData,
    addPoint,
    removePoint,
    movePoint,
    updatePointLabel,
    addArrow,
    removeArrow,
    undoLast,
    clearMap,
  } = useRouteMaps(routeEnvironment);
  const fixedRoutes = useFixedRouteMaps(routeEnvironment);
  const mapExtracts = useMapExtracts(lang, gameMode);

  // En modo Logs, el estado de las misiones se deriva de los eventos leídos de los logs de
  // Tarkov; no debe heredar ni mezclarse con el progreso manual guardado en localStorage
  // (modo Local). El juego solo conserva un número limitado de sesiones recientes, así que
  // las misiones iniciadas/completadas antes de esa ventana no dejan rastro en los logs
  // disponibles: para esos casos concretos (sin ningún evento detectado) se admite un
  // "override" manual como respaldo, que los eventos de logs siempre pueden sobrescribir.
  const effectiveTaskStates = useMemo(() => {
    if (!isLogsMode) return progress.taskStates;
    const merged = { ...logsOverrides.overrides, ...logSync.taskStatusMap };
    return recalculateStates(tasks, { ...progress, taskStates: merged });
  }, [isLogsMode, progress, logSync.taskStatusMap, logsOverrides.overrides, tasks]);

  // LL automático: misiones started/completed prueban el Loyalty Level mínimo de cada trader.
  // Nivel PJ automático (solo Logs): el mayor minPlayerLevel de esas misiones fija el suelo.
  useEffect(() => {
    if (tasks.length === 0) return;
    syncTraderLevelsFromTaskStates(effectiveTaskStates);
    if (isLogsMode) {
      syncPlayerLevelFromTaskStates(effectiveTaskStates);
    }
  }, [
    tasks,
    effectiveTaskStates,
    isLogsMode,
    syncTraderLevelsFromTaskStates,
    syncPlayerLevelFromTaskStates,
  ]);

  // Conjunto de misiones cuyo estado viene directamente de un evento real en los logs:
  // esas se bloquean a edición manual (los logs mandan). El resto se puede editar a mano
  // como respaldo mientras el modo Logs esté activo.
  const logLockedIds = useMemo(() => {
    if (!isLogsLocked) return undefined;
    return new Set(Object.keys(logSync.taskStatusMap));
  }, [isLogsLocked, logSync.taskStatusMap]);

  const guardedStartTask = useCallback(
    (id: string) => {
      if (!isLogsMode) {
        startTask(id);
        trackUsage('task_started', { taskId: id });
        return;
      }
      if (logLockedIds?.has(id)) return;
      logsOverrides.startOverride(id);
      trackUsage('task_started', { taskId: id, source: 'logs_override' });
    },
    [isLogsMode, logLockedIds, startTask, logsOverrides],
  );
  const guardedCompleteTask = useCallback(
    (id: string) => {
      if (!isLogsMode) {
        completeTask(id);
        trackUsage('task_completed', { taskId: id });
        return;
      }
      if (logLockedIds?.has(id)) return;
      logsOverrides.completeOverride(id);
      trackUsage('task_completed', { taskId: id, source: 'logs_override' });
    },
    [isLogsMode, logLockedIds, completeTask, logsOverrides],
  );
  const guardedResetTask = useCallback(
    (id: string) => {
      if (!isLogsMode) {
        resetTask(id);
        trackUsage('task_reset', { taskId: id });
        return;
      }
      if (logLockedIds?.has(id)) return;
      logsOverrides.resetOverride(id);
      trackUsage('task_reset', { taskId: id, source: 'logs_override' });
    },
    [isLogsMode, logLockedIds, resetTask, logsOverrides],
  );

  const [viewTab, setViewTab] = useState<ViewTab>('all');
  const [allQuestTab, setAllQuestTab] = useState<AllQuestTab>('side');
  const [search, setSearch] = useState('');
  const [traderFilter, setTraderFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState<number | 'all'>(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTraderLevels, setShowTraderLevels] = useState(false);
  const [selectedRouteMapKey, setSelectedRouteMapKey] = useState<string | null>(null);

  useEffect(() => {
    setUsageContext({
      gameMode,
      appUsage,
      dataSource,
      lang,
      ...(accessKind ? { accessKind } : {}),
    });
  }, [gameMode, appUsage, dataSource, lang, accessKind]);

  useEffect(() => {
    if (!accessKind) return;
    setUsageContext({ accessKind });
    trackSessionStartOnce();
  }, [accessKind]);

  useEffect(() => {
    if (!search.trim()) return;
    const timer = window.setTimeout(() => {
      trackUsage('search_used', { tab: viewTab, category: allQuestTab });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [search, viewTab, allQuestTab]);

  const trackSelectEntity = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) return;
    if (storyNodes.some((n) => n.id === id)) {
      trackUsage('story_node_selected', { nodeId: id });
    } else {
      trackUsage('task_selected', { taskId: id });
    }
  }, [storyNodes]);

  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  const isHome = appUsage === 'home';
  const isRoutesUsage = appUsage === 'routes';
  const isQuestsUsage = appUsage === 'quests';
  const isStoryTab = isQuestsUsage && viewTab === 'all' && allQuestTab === 'story';
  const isSideTableView = isQuestsUsage && isTableView && viewTab === 'all' && allQuestTab === 'side';
  const isActiveTableView =
    isQuestsUsage && isTableView && (viewTab === 'active' || viewTab === 'completed');
  const routePoints = selectedRouteMapKey ? getPoints(selectedRouteMapKey) : [];
  const routeMapArrows = selectedRouteMapKey ? getArrows(selectedRouteMapKey) : [];
  const fixedRoutePoints = selectedRouteMapKey
    ? fixedRoutes.getPoints(selectedRouteMapKey)
    : [];

  const sideTasks = useMemo(() => tasks.filter(isSideTask), [tasks]);
  const storyApiTasks = useMemo(() => tasks.filter(isStoryApiTask), [tasks]);

  const sideTraders = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const task of sideTasks) {
      map.set(task.trader.id, { id: task.trader.id, name: task.trader.name });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [sideTasks, locale]);

  const startedCount = useMemo(
    () => tasks.filter((task) => (effectiveTaskStates[task.id] ?? 'locked') === 'started').length,
    [tasks, effectiveTaskStates],
  );

  const completedCount = useMemo(
    () => tasks.filter((task) => (effectiveTaskStates[task.id] ?? 'locked') === 'completed').length,
    [tasks, effectiveTaskStates],
  );

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  // Diagnóstico: IDs presentes en los logs que no corresponden a ninguna misión conocida
  // (p.ej. porque tarkov.dev aún no ha añadido esa misión a su base de datos).
  const unmatchedLogTaskIds = useMemo(() => {
    if (!isLogsMode) return [];
    return Object.keys(logSync.taskStatusMap).filter((id) => !tasksById.has(id));
  }, [isLogsMode, logSync.taskStatusMap, tasksById]);

  const unmatchedLogTaskStates = useMemo(() => {
    const out: Record<string, string> = {};
    for (const id of unmatchedLogTaskIds) {
      const state = logSync.taskStatusMap[id];
      if (state) out[id] = state;
    }
    return out;
  }, [unmatchedLogTaskIds, logSync.taskStatusMap]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = sideTasks.filter((task) => {
      if (traderFilter !== 'all' && task.trader.id !== traderFilter) return false;
      if (q && !task.name.toLowerCase().includes(q) && !task.trader.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    return sortTasksForDisplay(filtered, effectiveTaskStates, locale);
  }, [sideTasks, effectiveTaskStates, search, traderFilter, locale]);

  const selectedStoryApiTask = storyApiTasks.find((task) => task.id === selectedId) ?? null;

  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;
  const selectedStoryNode = storyNodes.find((node) => node.id === selectedId) ?? null;
  const selectedTaskState = selectedId
    ? (effectiveTaskStates[selectedId] ?? 'locked')
    : 'locked';
  const selectedStoryState = selectedId
    ? (storyProgress.nodeStates[selectedId] ?? 'locked')
    : 'locked';

  const handleQuestTabChange = (tab: AllQuestTab) => {
    setAllQuestTab(tab);
    setSelectedId(null);
    setSearch('');
    setTraderFilter('all');
    trackUsage('quest_category', { category: tab });
  };

  const handleWipeAll = () => {
    if (!window.confirm(t.confirmWipeAll)) return;
    trackUsage('local_data_wiped');
    void flushUsageEvents(true).finally(() => {
      localStorage.clear();
      window.location.reload();
    });
  };

  const goHome = () => {
    trackUsage('go_home');
    transitionTo(() => {
      setAppUsage('home');
      setSelectedRouteMapKey(null);
      setSelectedId(null);
      setShowTraderLevels(false);
    });
  };

  const handleHomeChoice = (choice: HomeUsageChoice) => {
    trackUsage('home_choice', { choice });
    transitionTo(() => {
      if (choice === 'routes') {
        // Routes comparte datos de mapa con Seasonal.
        setGameMode('seasonal');
        setAppUsage('routes');
        return;
      }
      setGameMode(choice === 'seasonal' ? 'seasonal' : 'regular');
      // PVP Regular / Seasonal: Logs es la fuente por defecto al entrar.
      setDataSource('logs');
      setViewTab('active');
      setAppUsage('quests');
    });
  };

  const handleSelectRouteMap = (mapKey: string | null) => {
    setSelectedRouteMapKey(mapKey);
    if (mapKey) trackUsage('route_map_opened', { mapKey });
  };

  // En modo Logs: Activas y Completadas (progreso desde logs).
  useEffect(() => {
    if (isLogsMode && viewTab !== 'active' && viewTab !== 'completed') {
      setViewTab('active');
      setSelectedId(null);
    }
    if (isLogsMode) setShowTraderLevels(false);
  }, [isLogsMode, viewTab]);

  useEffect(() => {
    setSelectedRouteMapKey(null);
  }, [routeEnvironment]);

  const feedbackFooter = (
    <>
      <AppFooter
        locale={locale}
        formatVisits={t.footerVisits}
        formatOnline={t.footerOnline}
        feedbackLabel={t.feedbackButton}
        onOpenFeedback={() => setFeedbackOpen(true)}
        kbReportLabel={t.kbReportFooterButton}
        onOpenKbReport={() => setKbReportOpen(true)}
        lastUpdateLabel={t.footerLastUpdate}
        logoutLabel={t.footerLogout}
        onLogout={siteLogout}
      />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} t={t} />
      <KbDocumentReportModal
        open={kbReportOpen}
        onClose={() => setKbReportOpen(false)}
        defaultEnvironment={routeEnvironment}
        t={t}
      />
    </>
  );

  if (isQuestsUsage && loading) {
    return (
      <div className="app loading-screen">
        <div className="loader" />
        <p>{t.loading}</p>
        {feedbackFooter}
      </div>
    );
  }

  if (isQuestsUsage && error) {
    return (
      <div className="app error-screen">
        <h1>{t.loadError}</h1>
        <p>{error}</p>
        <button type="button" className="btn btn-start" onClick={() => reload()}>
          {t.retry}
        </button>
        {feedbackFooter}
      </div>
    );
  }

  // Defensa extra: si por lo que sea (versión antigua en caché, respuesta rara de la API, etc.)
  // llega aquí una lista de misiones sospechosamente incompleta, no seguimos mostrando la app
  // con todo a cero sin explicación: se avisa explícitamente de la causa real, en vez de dejar
  // que parezca un problema del lector de logs.
  if (isQuestsUsage && tasks.length < MIN_VALID_TASK_COUNT) {
    return (
      <div className="app error-screen">
        <h1>{t.incompleteTasksTitle}</h1>
        <p>{t.incompleteTasksBody(tasks.length)}</p>
        <button type="button" className="btn btn-start" onClick={() => reload()}>
          {t.retry}
        </button>
        {feedbackFooter}
      </div>
    );
  }

  return (
    <div
      className={[
        'app',
        isHome ? 'app--home' : '',
        !isHome && isQuestsUsage ? 'app--header-contextual' : '',
        isLogsLocked ? 'logs-locked' : '',
        gameMode === 'seasonal' ? 'app--seasonal' : '',
      ].filter(Boolean).join(' ')}
    >
      <CrtViewTransition active={crtActive} playId={crtPlayId} logoSrc={brandLogoSrc} />
      {!isHome && (
      <header className={`app-header${isQuestsUsage ? ' app-header--contextual' : ''}`}>
        <div className={`header-logo${canRevealDailyCode ? ' header-logo--with-access' : ''}`}>
          <button
            type="button"
            className="header-logo-btn"
            onClick={goHome}
            title={t.homeBack}
            aria-label={t.homeBack}
          >
            <img
              src={brandLogoSrc}
              alt={t.appTitle}
              className={`brand-logo${brandLogoClass}`}
            />
          </button>
          {isQuestsUsage && gameMode !== 'seasonal' && (
            <span
              className="header-mode-badge"
              title={t.gameModeHint[gameMode === 'pve' ? 'regular' : gameMode]}
            >
              PVP
            </span>
          )}
          {isRoutesUsage && (
            <span className="header-mode-badge routes" title={t.routeEnvironmentHint}>
              {t.tabRoutes}
            </span>
          )}
          <HeaderAccessCode enabled={canRevealDailyCode} />
        </div>

        {isQuestsUsage && gameMode === 'seasonal' && (
          <div className="header-season" title={t.gameModeHint.seasonal}>
            <img
              src={seasonalGameLogoSrc}
              alt="Kord Breach Season 1"
              className="header-season-logo"
            />
          </div>
        )}

        <div className="header-main">
        <div className="header-primary">
          <div className="header-tabs">
            {isQuestsUsage && (
              <div className="segmented" role="tablist" aria-label={t.tabAll}>
                {!isLogsMode && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewTab === 'all'}
                    className={`segmented-item${viewTab === 'all' ? ' active' : ''}`}
                    onClick={() => {
                      setViewTab('all');
                      trackUsage('quest_tab', { tab: 'all' });
                    }}
                  >
                    {t.tabAll}
                  </button>
                )}
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewTab === 'active'}
                  className={`segmented-item${viewTab === 'active' ? ' active' : ''}`}
                  onClick={() => {
                    setViewTab('active');
                    trackUsage('quest_tab', { tab: 'active' });
                  }}
                >
                  {t.tabActive}
                  {startedCount > 0 && <span className="seg-count">{startedCount}</span>}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewTab === 'completed'}
                  className={`segmented-item${viewTab === 'completed' ? ' active' : ''}`}
                  onClick={() => {
                    setViewTab('completed');
                    setSelectedId(null);
                    trackUsage('quest_tab', { tab: 'completed' });
                  }}
                >
                  {t.tabCompleted}
                  {completedCount > 0 && <span className="seg-count">{completedCount}</span>}
                </button>
              </div>
            )}
          </div>

          <div className="header-right">
            <div className="lang-flags" role="group" aria-label={t.language}>
              <button
                type="button"
                className={`lang-flag${lang === 'es' ? ' active' : ''}`}
                onClick={() => {
                  setLang('es');
                  trackUsage('language_changed', { lang: 'es' });
                }}
                aria-pressed={lang === 'es'}
                title="Español"
              >
                <img src="/flags/es.svg" alt="Español" />
              </button>
              <button
                type="button"
                className={`lang-flag${lang === 'en' ? ' active' : ''}`}
                onClick={() => {
                  setLang('en');
                  trackUsage('language_changed', { lang: 'en' });
                }}
                aria-pressed={lang === 'en'}
                title="English"
              >
                <img src="/flags/en.svg" alt="English" />
              </button>
            </div>
            <HeaderAppMenu
              menuLabel={t.headerAppMenu}
              adminLabel={t.openAdminPanel}
              wipeLabel={t.wipeAll}
              canAccessAdmin={canAccessAdmin}
              onWipeAll={handleWipeAll}
            />
          </div>
        </div>

        {isQuestsUsage && (
          <div className="header-secondary">
            <div className="header-secondary-left">
              {!isLogsMode && (
                <div className="header-secondary-progress" aria-label={t.playerLevel}>
                  <label className="header-level" title={t.playerLevel}>
                    <span className="header-level-label">Lv</span>
                    <input
                      type="number"
                      min={0}
                      max={79}
                      value={progress.playerLevel}
                      onChange={(e) => setPlayerLevel(Number(e.target.value))}
                    />
                  </label>
                  <button
                    type="button"
                    className={`btn-trader-levels${showTraderLevels ? ' active' : ''}`}
                    onClick={() => setShowTraderLevels((v) => !v)}
                    aria-pressed={showTraderLevels}
                    title={t.traderLevels}
                  >
                    LL
                  </button>
                </div>
              )}

              {!isLogsMode && viewTab === 'all' && (
                <div className="segmented segmented-sub" role="tablist" aria-label={t.tabAll}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={allQuestTab === 'story'}
                    className={`segmented-item${allQuestTab === 'story' ? ' active' : ''}`}
                    onClick={() => handleQuestTabChange('story')}
                  >
                    {t.tabStory}
                    <span className="seg-count">{storyNodes.length + storyApiTasks.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={allQuestTab === 'side'}
                    className={`segmented-item${allQuestTab === 'side' ? ' active' : ''}`}
                    onClick={() => handleQuestTabChange('side')}
                  >
                    {t.tabSideQuest}
                    <span className="seg-count">{sideTasks.length}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="header-secondary-right">
              <DataSourceControl
                dataSource={dataSource}
                onChangeDataSource={(next) => {
                  setDataSource(next);
                  trackUsage('data_source_changed', { source: next });
                }}
                status={logSync.status}
                folderName={logSync.folderName}
                lastSyncedAt={logSync.lastSyncedAt}
                errorMessage={logSync.errorMessage}
                sessionCount={logSync.sessionCount}
                totalSessionCount={logSync.totalSessionCount}
                taskCount={Object.keys(logSync.taskStatusMap).length}
                wipeVersion={logSync.wipeVersion}
                unmatchedTaskIds={unmatchedLogTaskIds}
                unmatchedTaskStates={unmatchedLogTaskStates}
                breakpoints={logSync.breakpoints}
                wipeStartSelection={logSync.wipeStartSelection}
                resolvedWipeStartSession={logSync.resolvedWipeStartSession}
                onChangeWipeStart={logSync.setWipeStart}
                knownProfiles={logSync.knownProfiles}
                activeProfileId={logSync.activeProfileId}
                onAssignProfileMode={logSync.assignProfileMode}
                canLivePoll={logSync.canLivePoll}
                locale={locale}
                t={t}
                onConnect={() => {
                  trackUsage('logs_connect');
                  void logSync.connect();
                }}
                onReconnect={logSync.reconnect}
                onDisconnect={() => {
                  trackUsage('logs_disconnect');
                  logSync.disconnect();
                }}
              />
            </div>
          </div>
        )}
        </div>
      </header>
      )}

      {showTraderLevels && isQuestsUsage && !isLogsMode && (
        <TraderLevelsPanel
          traders={traders}
          traderLevels={progress.traderLevels}
          onChange={setTraderLevel}
          t={t}
          onClose={() => setShowTraderLevels(false)}
        />
      )}

      <main className={`main-layout${isRoutesUsage || isHome ? ' main-layout--routes' : ''}`}>
        {isHome ? (
          <HomeUsageScreen
            t={getTranslations('en')}
            onChoose={handleHomeChoice}
            canRevealDailyCode={canRevealDailyCode}
            canAccessAdmin={canAccessAdmin}
            logoSrc={brandLogoSrc}
          />
        ) : isRoutesUsage ? (
          <RouteMapsView
            routes={routes}
            fixedRoutes={fixedRoutes.routes}
            selectedMapKey={selectedRouteMapKey}
            onSelectMap={handleSelectRouteMap}
            points={routePoints}
            arrows={routeMapArrows}
            fixedPoints={fixedRoutePoints}
            mapExtracts={
              selectedRouteMapKey
                ? mapExtracts.extracts[selectedRouteMapKey] ?? []
                : []
            }
            selectedColor={selectedColor}
            colorLabels={colorLabels}
            onChangeColor={setSelectedColor}
            onChangeColorLabel={setColorLabel}
            onAddPoint={(left, top) => {
              if (!selectedRouteMapKey) return;
              addPoint(selectedRouteMapKey, left, top);
              trackUsage('route_point_added', { mapKey: selectedRouteMapKey });
            }}
            onRemovePoint={(pointId) => {
              if (!selectedRouteMapKey) return;
              removePoint(selectedRouteMapKey, pointId);
              trackUsage('route_point_removed', { mapKey: selectedRouteMapKey });
            }}
            onUpdatePointLabel={(pointId, label) => {
              if (!selectedRouteMapKey) return;
              updatePointLabel(selectedRouteMapKey, pointId, label);
            }}
            onAddArrow={(fromLeft, fromTop, toLeft, toTop) => {
              if (!selectedRouteMapKey) return;
              addArrow(selectedRouteMapKey, fromLeft, fromTop, toLeft, toTop);
              trackUsage('route_arrow_added', { mapKey: selectedRouteMapKey });
            }}
            onRemoveArrow={(arrowId) => {
              if (!selectedRouteMapKey) return;
              removeArrow(selectedRouteMapKey, arrowId);
              trackUsage('route_arrow_removed', { mapKey: selectedRouteMapKey });
            }}
            onMovePoint={(pointId, left, top) => {
              if (selectedRouteMapKey) movePoint(selectedRouteMapKey, pointId, left, top);
            }}
            onUndoLast={() => {
              if (selectedRouteMapKey) undoLast(selectedRouteMapKey);
            }}
            onClearMap={() => {
              if (!selectedRouteMapKey) return;
              clearMap(selectedRouteMapKey);
              trackUsage('route_map_cleared', { mapKey: selectedRouteMapKey });
            }}
            fixedLoading={fixedRoutes.loading}
            fixedError={fixedRoutes.error}
            t={t}
          />
        ) : (
        <>
        <div
          className={`task-list${viewTab === 'active' || viewTab === 'completed' ? ' active-tab' : ''}${isStoryTab ? ' story-tree-tab' : ''}${isSideTableView || isActiveTableView ? ' table-view-tab' : ''}`}
        >
          {viewTab === 'all' && (
            <div className="view-filters">
              <input
                type="search"
                placeholder={isStoryTab ? t.searchStoryPlaceholder : t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
              {isStoryTab ? (
                <select
                  className="view-filter-select"
                  value={chapterFilter === 'all' ? 'all' : String(chapterFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = v === 'all' ? 'all' : Number(v);
                    setChapterFilter(next);
                    trackUsage('filter_changed', {
                      filter: 'chapter',
                      value: String(next),
                    });
                  }}
                >
                  <option value="all">{t.allChapters}</option>
                  {storylineData.chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.title}</option>
                  ))}
                </select>
              ) : (
                <select
                  className="view-filter-select"
                  value={traderFilter}
                  onChange={(e) => {
                    setTraderFilter(e.target.value);
                    trackUsage('filter_changed', {
                      filter: 'trader',
                      value: e.target.value,
                    });
                  }}
                >
                  <option value="all">{t.allTraders}</option>
                  {sideTraders.map((tr) => (
                    <option key={tr.id} value={tr.id}>{tr.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          {viewTab === 'active' || viewTab === 'completed' ? (
            <ActiveTasksView
              tasks={tasks}
              taskStates={effectiveTaskStates}
              completedObjectives={progress.completedObjectives}
              customMapMarkers={progress.customMapMarkers ?? {}}
              routeMaps={routes}
              routeArrows={routeArrowsData}
              routeDrawColor={selectedColor}
              fixedRouteMaps={fixedRoutes.routes}
              mapExtracts={mapExtracts.extracts}
              routeColorLabels={colorLabels}
              selectedId={selectedId}
              t={t}
              isTable={isActiveTableView}
              listMode={viewTab === 'completed' ? 'completed' : 'started'}
              onSelect={trackSelectEntity}
              onStart={guardedStartTask}
              onComplete={guardedCompleteTask}
              onReset={guardedResetTask}
              onSetCustomMapMarker={setCustomMapMarker}
              onClearCustomMapMarker={clearCustomMapMarker}
              onAddRoutePoint={(mapKey, left, top) => {
                addPoint(mapKey, left, top);
                trackUsage('route_point_added', { mapKey, source: 'quest_map' });
              }}
              onRemoveRoutePoint={(mapKey, pointId) => {
                removePoint(mapKey, pointId);
                trackUsage('route_point_removed', { mapKey, source: 'quest_map' });
              }}
              onUpdateRoutePointLabel={(mapKey, pointId, label) => {
                updatePointLabel(mapKey, pointId, label);
              }}
              onAddRouteArrow={(mapKey, fromLeft, fromTop, toLeft, toTop) => {
                addArrow(mapKey, fromLeft, fromTop, toLeft, toTop);
                trackUsage('route_arrow_added', { mapKey, source: 'quest_map' });
              }}
              onRemoveRouteArrow={(mapKey, arrowId) => {
                removeArrow(mapKey, arrowId);
                trackUsage('route_arrow_removed', { mapKey, source: 'quest_map' });
              }}
              lockedIds={logLockedIds}
              showActionsColumn={!isLogsMode}
            />
          ) : isStoryTab ? (
            <StoryView
              nodes={storyNodes}
              storyApiTasks={storyApiTasks}
              nodeStates={storyProgress.nodeStates}
              taskStates={effectiveTaskStates}
              search={search}
              chapterFilter={chapterFilter}
              selectedId={selectedId}
              locale={locale}
              t={t}
              getRequirementNames={getRequirementNames}
              onSelect={trackSelectEntity}
              onStartNode={startNode}
              onCompleteNode={completeNode}
              onResetNode={resetNode}
              onStartTask={guardedStartTask}
              onCompleteTask={guardedCompleteTask}
              onResetTask={guardedResetTask}
              lockedIds={logLockedIds}
            />
          ) : isSideTableView ? (
            <TaskTableView
              tasks={filteredTasks}
              taskStates={effectiveTaskStates}
              selectedId={selectedId}
              t={t}
              onSelect={trackSelectEntity}
              onStart={guardedStartTask}
              onComplete={guardedCompleteTask}
              onReset={guardedResetTask}
              lockedIds={logLockedIds}
              showActionsColumn={!isLogsMode}
            />
          ) : filteredTasks.length === 0 ? (
            <p className="empty-list">{t.noTasksFilter}</p>
          ) : (
            filteredTasks.map((task) => {
              const state = effectiveTaskStates[task.id] ?? 'locked';
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  state={state}
                  selected={selectedId === task.id}
                  t={t}
                  onSelect={() => trackSelectEntity(task.id)}
                  onStart={() => guardedStartTask(task.id)}
                  onComplete={() => guardedCompleteTask(task.id)}
                  onReset={() => guardedResetTask(task.id)}
                  locked={logLockedIds?.has(task.id) ?? false}
                />
              );
            })
          )}
        </div>

        {isStoryTab ? (
          selectedStoryApiTask ? (
            <TaskDetail
              task={selectedStoryApiTask}
              state={selectedTaskState}
              tasksById={tasksById}
              taskStates={effectiveTaskStates}
              completedObjectives={progress.completedObjectives}
              t={t}
              locale={locale}
              onStart={() => selectedId && guardedStartTask(selectedId)}
              onComplete={() => selectedId && guardedCompleteTask(selectedId)}
              onReset={() => selectedId && guardedResetTask(selectedId)}
              onToggleObjective={(objectiveId) => {
                if (selectedId) toggleObjective(selectedId, objectiveId);
              }}
              isLogsMode={isLogsMode}
              logRawState={selectedId ? logSync.taskStatusMap[selectedId] ?? null : null}
            />
          ) : (
            <StoryDetail
              node={selectedStoryNode}
              chapterDesc={selectedStoryNode ? getChapterDesc(selectedStoryNode.chapterId) : null}
              state={selectedStoryState}
              requirementNames={selectedStoryNode ? getRequirementNames(selectedStoryNode) : []}
              t={t}
              onStart={() => selectedId && startNode(selectedId)}
              onComplete={() => selectedId && completeNode(selectedId)}
              onReset={() => selectedId && resetNode(selectedId)}
            />
          )
        ) : (
          <TaskDetail
            task={selectedTask}
            state={selectedTaskState}
            tasksById={tasksById}
            taskStates={effectiveTaskStates}
            completedObjectives={progress.completedObjectives}
            t={t}
            locale={locale}
            onStart={() => selectedId && guardedStartTask(selectedId)}
            onComplete={() => selectedId && guardedCompleteTask(selectedId)}
            onReset={() => selectedId && guardedResetTask(selectedId)}
            onToggleObjective={(objectiveId) => {
              if (selectedId) toggleObjective(selectedId, objectiveId);
            }}
            isLogsMode={isLogsMode}
            logRawState={selectedId ? logSync.taskStatusMap[selectedId] ?? null : null}
          />
        )}
        </>
        )}
      </main>

      <AppFooter
        locale={locale}
        formatVisits={t.footerVisits}
        formatOnline={t.footerOnline}
        feedbackLabel={t.feedbackButton}
        onOpenFeedback={() => setFeedbackOpen(true)}
        kbReportLabel={t.kbReportFooterButton}
        onOpenKbReport={() => setKbReportOpen(true)}
        lastUpdateLabel={t.footerLastUpdate}
        logoutLabel={t.footerLogout}
        onLogout={siteLogout}
        notices={usingStaleCache ? (
          <p className="footer-notice footer-notice--warn">
            {t.staleCacheNotice}
            {apiError ? ` ${t.staleCacheNoticeDetail(apiError)}` : ''}{' '}
            <button type="button" className="link-btn" onClick={() => reload()}>
              {t.retry}
            </button>
          </p>
        ) : undefined}
      />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} t={t} />
      <KbDocumentReportModal
        open={kbReportOpen}
        onClose={() => setKbReportOpen(false)}
        defaultEnvironment={routeEnvironment}
        t={t}
      />
    </div>
  );
}
