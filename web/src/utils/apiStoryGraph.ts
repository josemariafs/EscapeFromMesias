import type { Task } from '../types';
import type { StoryNodeFlat } from '../types/storyline';
import {
  buildStoryGraph,
  layoutChapterGraph,
  type StoryChapterLayout,
} from './storylineGraph';

export function tasksToStoryGraphNodes(tasks: Task[]): StoryNodeFlat[] {
  return tasks.map((task, orderIndex) => ({
    id: task.id,
    name: task.name,
    type: 'default' as const,
    minPlayerLevel: task.minPlayerLevel ?? 1,
    taskRequirements: task.taskRequirements.map((req) => ({
      task: { id: req.task.id },
    })),
    chapterId: 0,
    chapterTitle: '',
    orderIndex,
  }));
}

export function layoutApiTaskTree(tasks: Task[]): StoryChapterLayout | null {
  if (tasks.length === 0) return null;

  const pseudoNodes = tasksToStoryGraphNodes(tasks);
  const graph = buildStoryGraph(pseudoNodes);
  const laid = layoutChapterGraph(graph, 48);

  return {
    chapterId: 0,
    chapterTitle: '',
    ...laid,
  };
}
