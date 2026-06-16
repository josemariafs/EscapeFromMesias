import { useMemo, useState } from 'react';
import { ActiveTasksView } from './components/ActiveTasksView';
import { ScreenshotImportButton } from './components/ScreenshotImportButton';
import { StoryView } from './components/StoryView';
import { getChapterDesc } from './utils/storylineData';
import { StoryDetail } from './components/StoryDetail';
import { TaskCard } from './components/TaskCard';
import { TaskDetail } from './components/TaskDetail';
import { useLanguage } from './i18n/useLanguage';
import { useViewMode } from './hooks/useViewMode';
import { useProgress } from './hooks/useProgress';
import { useStoryProgress } from './hooks/useStoryProgress';
import { useTasks } from './hooks/useTasks';
import { storylineData } from './utils/storylineData';
import { countStoryByState } from './utils/storylineUnlock';
import { countByState, sortTasksForDisplay } from './utils/unlock';
import { isSideTask, isStoryApiTask } from './utils/taskCategory';
import './App.css';

type ViewTab = 'all' | 'active';
type AllQuestTab = 'story' | 'side';

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const { viewMode, setViewMode } = useViewMode();
  const { tasks, loading, error, reload } = useTasks(lang);
  const {
    progress,
    setPlayerLevel,
    startTask,
    completeTask,
    resetTask,
    importActiveTasks,
  } = useProgress(tasks);
  const {
    nodes: storyNodes,
    progress: storyProgress,
    startNode,
    completeNode,
    resetNode,
    getRequirementNames,
  } = useStoryProgress();

  const [viewTab, setViewTab] = useState<ViewTab>('all');
  const [allQuestTab, setAllQuestTab] = useState<AllQuestTab>('side');
  const [search, setSearch] = useState('');
  const [chapterFilter, setChapterFilter] = useState<number | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  const isStoryTab = viewTab === 'all' && allQuestTab === 'story';

  const sideTasks = useMemo(() => tasks.filter(isSideTask), [tasks]);
  const storyApiTasks = useMemo(() => tasks.filter(isStoryApiTask), [tasks]);

  const taskCounts = useMemo(
    () => countByState(sideTasks, progress.taskStates),
    [sideTasks, progress.taskStates],
  );

  const storyCounts = useMemo(() => {
    const counts = countStoryByState(storyNodes, storyProgress.nodeStates);
    for (const task of storyApiTasks) {
      const state = progress.taskStates[task.id] ?? 'locked';
      counts[state] += 1;
    }
    return counts;
  }, [storyNodes, storyProgress.nodeStates, storyApiTasks, progress.taskStates]);

  const counts = isStoryTab ? storyCounts : taskCounts;

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = sideTasks.filter((task) => {
      if (q && !task.name.toLowerCase().includes(q) && !task.trader.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    return sortTasksForDisplay(filtered, progress.taskStates, locale);
  }, [sideTasks, progress.taskStates, search, locale]);

  const selectedStoryApiTask = storyApiTasks.find((task) => task.id === selectedId) ?? null;

  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;
  const selectedStoryNode = storyNodes.find((node) => node.id === selectedId) ?? null;
  const selectedTaskState = selectedId
    ? (progress.taskStates[selectedId] ?? 'locked')
    : 'locked';
  const selectedStoryState = selectedId
    ? (storyProgress.nodeStates[selectedId] ?? 'locked')
    : 'locked';

  const handleQuestTabChange = (tab: AllQuestTab) => {
    setAllQuestTab(tab);
    setSelectedId(null);
    setSearch('');
  };

  const handleWipeAll = () => {
    if (window.confirm(t.confirmWipeAll)) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loader" />
        <p>{t.loading}</p>
      </div>
    );
  }

  if (error) {
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

  return (
    <div className={`app${viewMode === 'compact' ? ' compact' : ''}`}>
      <header className={`app-header${viewTab === 'all' ? ' app-header--with-search' : ''}`}>
        <div className="header-grid">
          <div className="header-logo">
            <img src="/logo.png" alt={t.appTitle} className="brand-logo" />
          </div>

          <div className="header-tabs">
            <div className="segmented" role="tablist" aria-label={t.tabAll}>
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'all'}
                className={`segmented-item${viewTab === 'all' ? ' active' : ''}`}
                onClick={() => setViewTab('all')}
              >
                {t.tabAll}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'active'}
                className={`segmented-item${viewTab === 'active' ? ' active' : ''}`}
                onClick={() => setViewTab('active')}
              >
                {t.tabActive}
                {taskCounts.started > 0 && <span className="seg-count">{taskCounts.started}</span>}
              </button>
            </div>

            {viewTab === 'all' && (
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

          <div className="header-right">
            <div className="header-controls-top">
              <label className="header-level">
                <span className="header-level-label">{t.playerLevel}</span>
                <input
                  type="number"
                  min={0}
                  max={79}
                  value={progress.playerLevel}
                  onChange={(e) => setPlayerLevel(Number(e.target.value))}
                />
              </label>
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
              </div>
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
                <ScreenshotImportButton
                  tasks={tasks}
                  t={t}
                  onImport={importActiveTasks}
                />
                <button type="button" className="btn btn-wipe" onClick={handleWipeAll}>
                  {t.wipeAll}
                </button>
              </div>
            </div>

            <div className="header-stats">
              <div className="stats-bar">
                <span className="stat available">{t.statAvailable(counts.available)}</span>
                <span className="stat started">{t.statStarted(counts.started)}</span>
                <span className="stat completed">{t.statCompleted(counts.completed)}</span>
                <span className="stat locked">{t.statLocked(counts.locked)}</span>
              </div>
            </div>
          </div>

          {viewTab === 'all' && (
            <div className="header-search">
              <input
                type="search"
                placeholder={isStoryTab ? t.searchStoryPlaceholder : t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
              {isStoryTab && (
                <select
                  className="header-chapter-select"
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
              )}
            </div>
          )}
        </div>
      </header>

      <main className="main-layout">
        <div className={`task-list${viewTab === 'active' ? ' active-tab' : ''}`}>
          {viewTab === 'active' ? (
            <ActiveTasksView
              tasks={tasks}
              taskStates={progress.taskStates}
              selectedId={selectedId}
              t={t}
              onSelect={setSelectedId}
              onStart={startTask}
              onComplete={completeTask}
              onReset={resetTask}
            />
          ) : isStoryTab ? (
            <StoryView
              nodes={storyNodes}
              storyApiTasks={storyApiTasks}
              nodeStates={storyProgress.nodeStates}
              taskStates={progress.taskStates}
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
              onStartTask={startTask}
              onCompleteTask={completeTask}
              onResetTask={resetTask}
            />
          ) : filteredTasks.length === 0 ? (
            <p className="empty-list">{t.noTasksFilter}</p>
          ) : (
            filteredTasks.map((task) => {
              const state = progress.taskStates[task.id] ?? 'locked';
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  state={state}
                  selected={selectedId === task.id}
                  t={t}
                  onSelect={() => setSelectedId(task.id)}
                  onStart={() => startTask(task.id)}
                  onComplete={() => completeTask(task.id)}
                  onReset={() => resetTask(task.id)}
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
              taskStates={progress.taskStates}
              t={t}
              locale={locale}
              onStart={() => selectedId && startTask(selectedId)}
              onComplete={() => selectedId && completeTask(selectedId)}
              onReset={() => selectedId && resetTask(selectedId)}
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
            taskStates={progress.taskStates}
            t={t}
            locale={locale}
            onStart={() => selectedId && startTask(selectedId)}
            onComplete={() => selectedId && completeTask(selectedId)}
            onReset={() => selectedId && resetTask(selectedId)}
          />
        )}
      </main>
    </div>
  );
}
