import { useMemo } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import type { StoryNodeFlat } from '../types/storyline';
import { storylineData } from '../utils/storylineData';
import {
  getStoryApiChapterId,
  isLightkeeperStoryTask,
  storyApiTaskMatchesChapter,
} from '../utils/taskCategory';
import { StoryApiTreeView } from './StoryApiTreeView';
import { StoryTreeView } from './StoryTreeView';
import { TaskCard } from './TaskCard';

interface StoryViewProps {
  nodes: StoryNodeFlat[];
  storyApiTasks: Task[];
  nodeStates: Record<string, TaskProgressState>;
  taskStates: Record<string, TaskProgressState>;
  search: string;
  chapterFilter: number | 'all';
  selectedId: string | null;
  locale: string;
  t: Translations;
  getRequirementNames: (node: StoryNodeFlat) => string[];
  onSelect: (id: string) => void;
  onStartNode: (id: string) => void;
  onCompleteNode: (id: string) => void;
  onResetNode: (id: string) => void;
  onStartTask: (id: string) => void;
  onCompleteTask: (id: string) => void;
  onResetTask: (id: string) => void;
}

export function StoryView({
  nodes,
  storyApiTasks,
  nodeStates,
  taskStates,
  search,
  chapterFilter,
  selectedId,
  t,
  onSelect,
  onStartTask,
  onCompleteTask,
  onResetTask,
}: StoryViewProps) {
  const q = search.trim().toLowerCase();

  const filteredApiTasks = useMemo(() => {
    return storyApiTasks.filter((task) => {
      if (!storyApiTaskMatchesChapter(task, chapterFilter)) return false;
      if (q && !task.name.toLowerCase().includes(q) && !task.trader.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [storyApiTasks, q, chapterFilter]);

  const apiTasksByChapter = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const task of filteredApiTasks) {
      const chapterId = getStoryApiChapterId(task);
      if (chapterId == null) continue;
      if (!map.has(chapterId)) map.set(chapterId, []);
      map.get(chapterId)!.push(task);
    }
    return map;
  }, [filteredApiTasks]);

  const lightkeeperTasks = useMemo(
    () => filteredApiTasks.filter((task) => isLightkeeperStoryTask(task)),
    [filteredApiTasks],
  );

  const hasStoryNodes = useMemo(() => {
    return nodes.some((node) => {
      if (chapterFilter !== 'all' && node.chapterId !== chapterFilter) return false;
      if (q && !node.name.toLowerCase().includes(q) && !node.chapterTitle.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [nodes, chapterFilter, q]);

  const apiChapterOrder = useMemo(() => {
    if (chapterFilter !== 'all') {
      return apiTasksByChapter.has(chapterFilter) ? [chapterFilter] : [];
    }
    return [...apiTasksByChapter.keys()].sort((a, b) => a - b);
  }, [chapterFilter, apiTasksByChapter]);

  const chapterTitle = (id: number) =>
    storylineData.chapters.find((c) => c.id === id)?.title ?? `Chapter ${id}`;

  if (!hasStoryNodes && filteredApiTasks.length === 0) {
    return <p className="empty-list">{t.noTasksFilter}</p>;
  }

  return (
    <div className="story-view-tree">
      {hasStoryNodes && (
        <StoryTreeView
          nodes={nodes}
          nodeStates={nodeStates}
          chapterFilter={chapterFilter}
          selectedId={selectedId}
          search={search}
          t={t}
          onSelect={onSelect}
        />
      )}
      {apiChapterOrder.map((chapterId) => (
        <StoryApiTreeView
          key={`api-${chapterId}`}
          tasks={apiTasksByChapter.get(chapterId) ?? []}
          taskStates={taskStates}
          selectedId={selectedId}
          title={chapterFilter === 'all' ? `${chapterTitle(chapterId)} (API)` : undefined}
          t={t}
          onSelect={onSelect}
        />
      ))}
      {lightkeeperTasks.length > 0 && (
        <section className="story-api-tasks">
          <h3 className="story-api-tasks-title">{t.storyLightkeeperTitle}</h3>
          <div className="story-api-tasks-grid">
            {lightkeeperTasks.map((task) => {
              const state = taskStates[task.id] ?? 'locked';
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  state={state}
                  selected={selectedId === task.id}
                  t={t}
                  onSelect={() => onSelect(task.id)}
                  onStart={() => onStartTask(task.id)}
                  onComplete={() => onCompleteTask(task.id)}
                  onReset={() => onResetTask(task.id)}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
