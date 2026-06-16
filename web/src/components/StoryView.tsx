import { useMemo } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import type { StoryNodeFlat } from '../types/storyline';
import { storyApiTaskMatchesChapter } from '../utils/taskCategory';
import { sortStoryNodesForDisplay } from '../utils/storylineUnlock';
import { sortTasksForDisplay } from '../utils/unlock';
import { StoryNodeCard } from './StoryNodeCard';
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
  getRequirementNames,
  onSelect,
  onStartNode,
  onCompleteNode,
  onResetNode,
  onStartTask,
  onCompleteTask,
  onResetTask,
}: StoryViewProps) {
  const q = search.trim().toLowerCase();

  const filteredNodes = useMemo(() => {
    const filtered = nodes.filter((node) => {
      if (chapterFilter !== 'all' && node.chapterId !== chapterFilter) return false;
      if (q && !node.name.toLowerCase().includes(q) && !node.chapterTitle.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    return sortStoryNodesForDisplay(filtered, nodeStates, locale);
  }, [nodes, nodeStates, q, chapterFilter, locale]);

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

  if (filteredNodes.length === 0 && filteredApiTasks.length === 0) {
    return <p className="empty-list">{t.noTasksFilter}</p>;
  }

  return (
    <>
      {filteredNodes.map((node) => {
        const state = nodeStates[node.id] ?? 'locked';
        return (
          <StoryNodeCard
            key={node.id}
            node={node}
            state={state}
            selected={selectedId === node.id}
            requirementNames={getRequirementNames(node)}
            t={t}
            onSelect={() => onSelect(node.id)}
            onStart={() => onStartNode(node.id)}
            onComplete={() => onCompleteNode(node.id)}
            onReset={() => onResetNode(node.id)}
          />
        );
      })}
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
    </>
  );
}
