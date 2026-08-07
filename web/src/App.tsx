import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActiveTasksView } from './components/ActiveTasksView';
import { AppFooter } from './components/AppFooter';
import { DataSourceControl } from './components/DataSourceControl';
import { HomeUsageScreen, type HomeUsageChoice } from './components/HomeUsageScreen';
import { RouteMapsView } from './components/RouteMapsView';
import { StoryView } from './components/StoryView';
import { getChapterDesc } from './utils/storylineData';
import { StoryDetail } from './components/StoryDetail';
import { TaskCard } from './components/TaskCard';
import { TaskTableView } from './components/TaskTableView';
import { TaskDetail } from './components/TaskDetail';
import { TraderLevelsPanel } from './components/TraderLevelsPanel';
import { useLanguage } from './i18n/useLanguage';
import { useDataSource } from './hooks/useDataSource';
import { useGameMode } from './hooks/useGameMode';
import { useViewMode } from './hooks/useViewMode';
import { useProgress } from './hooks/useProgress';
import { useLogsOverrides } from './hooks/useLogsOverrides';
import { useFixedRouteMaps } from './hooks/useFixedRouteMaps';
import { useRouteMaps } from './hooks/useRouteMaps';
import { useStoryProgress } from './hooks/useStoryProgress';
import { useTarkovLogSync } from './hooks/useTarkovLogSync';
import { useTasks } from './hooks/useTasks';
import { storylineData } from './utils/storylineData';
import { recalculateStates, sortTasksForDisplay } from './utils/unlock';
import { isSideTask, isStoryApiTask } from './utils/taskCategory';
import { MIN_VALID_TASK_COUNT } from './types';
import './App.css';

type AppUsage = 'home' | 'quests' | 'routes';
type ViewTab = 'all' | 'active';
type AllQuestTab = 'story' | 'side';

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const { viewMode, setViewMode } = useViewMode();
  const { gameMode, setGameMode } = useGameMode();
  const { dataSource, setDataSource, isLogsMode } = useDataSource();
  const [appUsage, setAppUsage] = useState<AppUsage>('home');
  const { tasks, loading, error, usingStaleCache, reload } = useTasks(lang, gameMode);
  const {
    progress,
    traders,
    setPlayerLevel,
    setTraderLevel,
    startTask,
    completeTask,
    resetTask,
    toggleObjective,
    setCustomMapMarker,
    clearCustomMapMarker,
  } = useProgress(tasks, gameMode);
  const logSync = useTarkovLogSync(isLogsMode);
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
    addPoint,
    removePoint,
    undoLast,
    clearMap,
  } = useRouteMaps();
  const fixedRoutes = useFixedRouteMaps();

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

  // Conjunto de misiones cuyo estado viene directamente de un evento real en los logs:
  // esas se bloquean a edición manual (los logs mandan). El resto se puede editar a mano
  // como respaldo mientras el modo Logs esté activo.
  const logLockedIds = useMemo(() => {
    if (!isLogsLocked) return undefined;
    return new Set(Object.keys(logSync.taskStatusMap));
  }, [isLogsLocked, logSync.taskStatusMap]);

  const guardedStartTask = useCallback(
    (id: string) => {
      if (!isLogsMode) { startTask(id); return; }
      if (logLockedIds?.has(id)) return;
      logsOverrides.startOverride(id);
    },
    [isLogsMode, logLockedIds, startTask, logsOverrides],
  );
  const guardedCompleteTask = useCallback(
    (id: string) => {
      if (!isLogsMode) { completeTask(id); return; }
      if (logLockedIds?.has(id)) return;
      logsOverrides.completeOverride(id);
    },
    [isLogsMode, logLockedIds, completeTask, logsOverrides],
  );
  const guardedResetTask = useCallback(
    (id: string) => {
      if (!isLogsMode) { resetTask(id); return; }
      if (logLockedIds?.has(id)) return;
      logsOverrides.resetOverride(id);
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

  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  const isHome = appUsage === 'home';
  const isRoutesUsage = appUsage === 'routes';
  const isQuestsUsage = appUsage === 'quests';
  const isStoryTab = isQuestsUsage && viewTab === 'all' && allQuestTab === 'story';
  const isTableView = viewMode === 'table';
  const isSideTableView = isQuestsUsage && isTableView && viewTab === 'all' && allQuestTab === 'side';
  const isActiveTableView = isQuestsUsage && isTableView && viewTab === 'active';
  const routePoints = selectedRouteMapKey ? getPoints(selectedRouteMapKey) : [];
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
    () => sideTasks.filter((task) => (effectiveTaskStates[task.id] ?? 'locked') === 'started').length,
    [sideTasks, effectiveTaskStates],
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
  };

  const handleWipeAll = () => {
    if (window.confirm(t.confirmWipeAll)) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const goHome = () => {
    setAppUsage('home');
    setSelectedRouteMapKey(null);
    setSelectedId(null);
    setShowTraderLevels(false);
  };

  const handleHomeChoice = (choice: HomeUsageChoice) => {
    if (choice === 'routes') {
      setAppUsage('routes');
      return;
    }
    setGameMode(choice === 'seasonal' ? 'seasonal' : 'regular');
    setViewTab(isLogsMode ? 'active' : 'all');
    setAppUsage('quests');
  };

  // En modo Logs solo tiene sentido la pestaña Active (progreso desde logs).
  useEffect(() => {
    if (isLogsMode && viewTab !== 'active') {
      setViewTab('active');
      setSelectedId(null);
    }
  }, [isLogsMode, viewTab]);

  if (isQuestsUsage && loading) {
    return (
      <div className="app loading-screen">
        <div className="loader" />
        <p>{t.loading}</p>
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
      </div>
    );
  }

  return (
    <div className={`app${viewMode === 'compact' ? ' compact' : ''}${isLogsLocked ? ' logs-locked' : ''}`}>
      <header className="app-header">
        <div className="header-grid">
          <div className="header-logo">
            <button
              type="button"
              className="header-logo-btn"
              onClick={goHome}
              title={t.homeBack}
              aria-label={t.homeBack}
            >
              <img src="/logo.png" alt={t.appTitle} className="brand-logo" />
            </button>
          </div>

          <div className="header-tabs">
            {isQuestsUsage && (
              <>
                <span
                  className={`header-mode-badge${gameMode === 'seasonal' ? ' seasonal' : ''}`}
                  title={t.gameModeHint[gameMode === 'pve' ? 'regular' : gameMode]}
                >
                  {gameMode === 'seasonal' ? 'SEASONAL' : 'PVP'}
                </span>
                <div className="segmented" role="tablist" aria-label={t.tabAll}>
                  {!isLogsMode && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewTab === 'all'}
                      className={`segmented-item${viewTab === 'all' ? ' active' : ''}`}
                      onClick={() => setViewTab('all')}
                    >
                      {t.tabAll}
                    </button>
                  )}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewTab === 'active'}
                    className={`segmented-item${viewTab === 'active' ? ' active' : ''}`}
                    onClick={() => setViewTab('active')}
                  >
                    {t.tabActive}
                    {startedCount > 0 && <span className="seg-count">{startedCount}</span>}
                  </button>
                </div>

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
              </>
            )}
            {isRoutesUsage && (
              <span className="header-mode-badge routes">{t.tabRoutes}</span>
            )}
          </div>

          <div className="header-right">
            <div className="header-controls-top">
              {isQuestsUsage && (
                <>
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
                  <DataSourceControl
                    dataSource={dataSource}
                    onChangeDataSource={setDataSource}
                    status={logSync.status}
                    folderName={logSync.folderName}
                    lastSyncedAt={logSync.lastSyncedAt}
                    errorMessage={logSync.errorMessage}
                    sessionCount={logSync.sessionCount}
                    totalSessionCount={logSync.totalSessionCount}
                    taskCount={Object.keys(logSync.taskStatusMap).length}
                    wipeVersion={logSync.wipeVersion}
                    unmatchedTaskIds={unmatchedLogTaskIds}
                    breakpoints={logSync.breakpoints}
                    wipeStartSelection={logSync.wipeStartSelection}
                    resolvedWipeStartSession={logSync.resolvedWipeStartSession}
                    onChangeWipeStart={logSync.setWipeStart}
                    locale={locale}
                    t={t}
                    onConnect={logSync.connect}
                    onReconnect={logSync.reconnect}
                    onDisconnect={logSync.disconnect}
                  />
                  <div className="view-mode-toggle" role="group" aria-label={t.viewMode}>
                    <button
                      type="button"
                      className={`view-mode-btn${viewMode === 'normal' ? ' active' : ''}`}
                      onClick={() => setViewMode('normal')}
                      aria-pressed={viewMode === 'normal'}
                      title={t.viewModeNormal}
                    >
                      <svg viewBox="0 0 20 14" width="18" height="13" aria-hidden="true">
                        <rect x="1" y="1" width="18" height="5.5" rx="1.2" fill="currentColor" opacity="0.85" />
                        <rect x="1" y="7.5" width="18" height="5.5" rx="1.2" fill="currentColor" opacity="0.85" />
                      </svg>
                      <span className="sr-only">{t.viewModeNormal}</span>
                    </button>
                    <button
                      type="button"
                      className={`view-mode-btn${viewMode === 'compact' ? ' active' : ''}`}
                      onClick={() => setViewMode('compact')}
                      aria-pressed={viewMode === 'compact'}
                      title={t.viewModeCompact}
                    >
                      <svg viewBox="0 0 20 14" width="18" height="13" aria-hidden="true">
                        <rect x="1" y="1" width="18" height="3" rx="0.9" fill="currentColor" />
                        <rect x="1" y="5.5" width="18" height="3" rx="0.9" fill="currentColor" />
                        <rect x="1" y="10" width="18" height="3" rx="0.9" fill="currentColor" />
                      </svg>
                      <span className="sr-only">{t.viewModeCompact}</span>
                    </button>
                    <button
                      type="button"
                      className={`view-mode-btn${viewMode === 'table' ? ' active' : ''}`}
                      onClick={() => setViewMode('table')}
                      aria-pressed={viewMode === 'table'}
                      title={t.viewModeTable}
                    >
                      <svg viewBox="0 0 20 14" width="18" height="13" aria-hidden="true">
                        <rect x="1" y="1" width="18" height="12" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                        <line x1="1" y1="5.5" x2="19" y2="5.5" stroke="currentColor" strokeWidth="1.2" />
                        <line x1="1" y1="9.5" x2="19" y2="9.5" stroke="currentColor" strokeWidth="1.2" />
                        <line x1="10" y1="1" x2="10" y2="13" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                      <span className="sr-only">{t.viewModeTable}</span>
                    </button>
                  </div>
                </>
              )}
              <div className="lang-flags" role="group" aria-label={t.language}>
                <button
                  type="button"
                  className={`lang-flag${lang === 'es' ? ' active' : ''}`}
                  onClick={() => setLang('es')}
                  aria-pressed={lang === 'es'}
                  title="Español"
                >
                  <img src="/flags/es.svg" alt="Español" />
                </button>
                <button
                  type="button"
                  className={`lang-flag${lang === 'en' ? ' active' : ''}`}
                  onClick={() => setLang('en')}
                  aria-pressed={lang === 'en'}
                  title="English"
                >
                  <img src="/flags/en.svg" alt="English" />
                </button>
              </div>
              <div className="header-actions">
                <button type="button" className="btn btn-wipe" onClick={handleWipeAll}>
                  {t.wipeAll}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {showTraderLevels && isQuestsUsage && (
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
          <HomeUsageScreen t={t} onChoose={handleHomeChoice} />
        ) : isRoutesUsage ? (
          <RouteMapsView
            routes={routes}
            fixedRoutes={fixedRoutes.routes}
            selectedMapKey={selectedRouteMapKey}
            onSelectMap={setSelectedRouteMapKey}
            points={routePoints}
            fixedPoints={fixedRoutePoints}
            selectedColor={selectedColor}
            colorLabels={colorLabels}
            onChangeColor={setSelectedColor}
            onChangeColorLabel={setColorLabel}
            onAddPoint={(left, top) => {
              if (selectedRouteMapKey) addPoint(selectedRouteMapKey, left, top);
            }}
            onRemovePoint={(pointId) => {
              if (selectedRouteMapKey) removePoint(selectedRouteMapKey, pointId);
            }}
            onUndoLast={() => {
              if (selectedRouteMapKey) undoLast(selectedRouteMapKey);
            }}
            onClearMap={() => {
              if (selectedRouteMapKey) clearMap(selectedRouteMapKey);
            }}
            fixedLoading={fixedRoutes.loading}
            fixedError={fixedRoutes.error}
            t={t}
          />
        ) : (
        <>
        <div
          className={`task-list${viewTab === 'active' ? ' active-tab' : ''}${isStoryTab ? ' story-tree-tab' : ''}${isSideTableView || isActiveTableView ? ' table-view-tab' : ''}`}
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
                    setChapterFilter(v === 'all' ? 'all' : Number(v));
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
                  onChange={(e) => setTraderFilter(e.target.value)}
                >
                  <option value="all">{t.allTraders}</option>
                  {sideTraders.map((tr) => (
                    <option key={tr.id} value={tr.id}>{tr.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          {viewTab === 'active' ? (
            <ActiveTasksView
              tasks={tasks}
              taskStates={effectiveTaskStates}
              completedObjectives={progress.completedObjectives}
              customMapMarkers={progress.customMapMarkers ?? {}}
              selectedId={selectedId}
              t={t}
              isTable={isActiveTableView}
              onSelect={setSelectedId}
              onStart={guardedStartTask}
              onComplete={guardedCompleteTask}
              onReset={guardedResetTask}
              onSetCustomMapMarker={setCustomMapMarker}
              onClearCustomMapMarker={clearCustomMapMarker}
              lockedIds={logLockedIds}
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
              onSelect={setSelectedId}
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
              onSelect={setSelectedId}
              onStart={guardedStartTask}
              onComplete={guardedCompleteTask}
              onReset={guardedResetTask}
              lockedIds={logLockedIds}
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
                  onSelect={() => setSelectedId(task.id)}
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
        notices={(usingStaleCache || isLogsLocked) ? (
          <>
            {usingStaleCache && (
              <p className="footer-notice footer-notice--warn">
                {t.staleCacheNotice}{' '}
                <button type="button" className="link-btn" onClick={() => reload()}>
                  {t.retry}
                </button>
              </p>
            )}
            {isLogsLocked && (
              <p className="footer-notice">{t.logsReadOnlyNotice}</p>
            )}
            {isLogsLocked && Object.keys(logSync.taskStatusMap).length === 0 && (
              <p className="footer-notice footer-notice--warn">{t.logsNoEventsHint}</p>
            )}
          </>
        ) : undefined}
      />
    </div>
  );
}
