import { useMemo } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import type { StoryNodeFlat } from '../types/storyline';
import { storyApiTaskMatchesChapter } from '../utils/taskCategory';
import { sortTasksForDisplay } from '../utils/unlock';
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
  locale,
  t,
  onSelect,
  onStartTask,
  onCompleteTask,
  onResetTask,
}: StoryViewProps) {
  const q = search.trim().toLowerCase();

  const filteredApiTasks = useMemo(() => {
    const filtered = storyApiTasks.filter((task) => {
      if (!storyApiTaskMatchesChapter(task, chapterFilter)) return false;
      if (q && !task.name.toLowerCase().includes(q) && !task.trader.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    return sortTasksForDisplay(filtered, taskStates, locale);
  }, [storyApiTasks, taskStates, q, chapterFilter, locale]);

  const hasStoryNodes = useMemo(() => {
    return nodes.some((node) => {
      if (chapterFilter !== 'all' && node.chapterId !== chapterFilter) return false;
      if (q && !node.name.toLowerCase().includes(q) && !node.chapterTitle.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [nodes, chapterFilter, q]);

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
      {filteredApiTasks.length > 0 && (
        <section className="story-api-tasks">
          <h3 className="story-api-tasks-title">{t.storyApiTasksTitle}</h3>
          <div className="story-api-tasks-grid">
            {filteredApiTasks.map((task) => {
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
