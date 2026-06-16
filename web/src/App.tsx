import { useMemo, useState } from 'react';
import { ActiveTasksView } from './components/ActiveTasksView';
import { StoryView } from './components/StoryView';
import { getChapterDesc } from './utils/storylineData';
import { StoryDetail } from './components/StoryDetail';
import { TaskCard } from './components/TaskCard';
import { TaskDetail } from './components/TaskDetail';
import { useLanguage } from './i18n/useLanguage';
import { useProgress } from './hooks/useProgress';
import { useStoryProgress } from './hooks/useStoryProgress';
import { useTasks } from './hooks/useTasks';
import type { TaskProgressState } from './types';
import { storylineData } from './utils/storylineData';
import { countStoryByState } from './utils/storylineUnlock';
import { countByState, sortTasksForDisplay } from './utils/unlock';
import { isSideTask, isStoryApiTask } from './utils/taskCategory';
import './App.css';

type StatusFilter = 'all' | TaskProgressState;
type ViewTab = 'all' | 'active';
type AllQuestTab = 'story' | 'side';

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const { tasks, loading, error, reload } = useTasks(lang);
  const {
    progress,
    setPlayerLevel,
    startTask,
    completeTask,
    resetTask,
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
  const [traderFilter, setTraderFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  const isStoryTab = viewTab === 'all' && allQuestTab === 'story';

  const sideTasks = useMemo(() => tasks.filter(isSideTask), [tasks]);
  const storyApiTasks = useMemo(() => tasks.filter(isStoryApiTask), [tasks]);

  const sideTraders = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const task of sideTasks) {
      map.set(task.trader.id, { id: task.trader.id, name: task.trader.name });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [sideTasks, locale]);

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
      const state = progress.taskStates[task.id] ?? 'locked';
      if (traderFilter !== 'all' && task.trader.id !== traderFilter) return false;
      if (statusFilter !== 'all' && state !== statusFilter) return false;
      if (q && !task.name.toLowerCase().includes(q) && !task.trader.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    return sortTasksForDisplay(filtered, progress.taskStates, locale);
  }, [sideTasks, progress.taskStates, search, traderFilter, statusFilter, locale]);

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
    setStatusFilter('all');
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
    <div className="app">
      <header className="top-bar">
        <div className="top-bar-brand">
          <img src="/logo.png" alt={t.appTitle} className="brand-logo" />
        </div>

        <div className="top-bar-center">
          <nav className="view-tabs header-tabs">
            <button
              type="button"
              className={`view-tab${viewTab === 'all' ? ' active' : ''}`}
              onClick={() => setViewTab('all')}
            >
              {t.tabAll}
            </button>
            <button
              type="button"
              className={`view-tab${viewTab === 'active' ? ' active' : ''}`}
              onClick={() => setViewTab('active')}
            >
              {t.tabActive}
              {taskCounts.started > 0 && <span className="tab-badge">{taskCounts.started}</span>}
            </button>
          </nav>

          {viewTab === 'all' && (
            <nav className="view-tabs sub-tabs header-sub-tabs">
              <button
                type="button"
                className={`view-tab${allQuestTab === 'story' ? ' active' : ''}`}
                onClick={() => handleQuestTabChange('story')}
              >
                {t.tabStory}
                <span className="tab-badge muted">{storyNodes.length + storyApiTasks.length}</span>
              </button>
              <button
                type="button"
                className={`view-tab${allQuestTab === 'side' ? ' active' : ''}`}
                onClick={() => handleQuestTabChange('side')}
              >
                {t.tabSideQuest}
                <span className="tab-badge muted">{sideTasks.length}</span>
              </button>
            </nav>
          )}
        </div>

        <div className="top-bar-right">
          <p className="subtitle">{t.subtitle(sideTasks.length)}</p>
          <div className="top-bar-actions">
            <div className="stats-bar">
              <span className="stat available">{t.statAvailable(counts.available)}</span>
              <span className="stat started">{t.statStarted(counts.started)}</span>
              <span className="stat completed">{t.statCompleted(counts.completed)}</span>
              <span className="stat locked">{t.statLocked(counts.locked)}</span>
            </div>
            <button type="button" className="btn btn-wipe" onClick={handleWipeAll}>
              {t.wipeAll}
            </button>
          </div>
        </div>
      </header>

      <div className="toolbar">
        {viewTab === 'all' && (
          <>
            <input
              type="search"
              placeholder={isStoryTab ? t.searchStoryPlaceholder : t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />

            {isStoryTab ? (
              <select
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
              <select value={traderFilter} onChange={(e) => setTraderFilter(e.target.value)}>
                <option value="all">{t.allTraders}</option>
                {sideTraders.map((tr) => (
                  <option key={tr.id} value={tr.id}>{tr.name}</option>
                ))}
              </select>
            )}

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">{t.allStatuses}</option>
              <option value="available">{t.statusAvailable}</option>
              <option value="started">{t.statusStarted}</option>
              <option value="completed">{t.statusCompleted}</option>
              <option value="locked">{t.statusLocked}</option>
            </select>
          </>
        )}

        {!isStoryTab && (
          <label className="level-control">
            {t.playerLevel}
            <input
              type="number"
              min={0}
              max={79}
              value={progress.playerLevel}
              onChange={(e) => setPlayerLevel(Number(e.target.value))}
            />
          </label>
        )}

        <label className="lang-control">
          {t.language}
          <select value={lang} onChange={(e) => setLang(e.target.value as 'es' | 'en')}>
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </label>
      </div>

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
              statusFilter={statusFilter}
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
