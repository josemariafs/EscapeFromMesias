import type { Task } from '../types';
import { BOREAS_API_TASK_IDS } from './boreasTasks';

export type TaskCategory = 'story' | 'side';

/** Capítulo Story (TarkovBuddy) al que enlazan misiones de API del Laberinto. */
export const LABYRINTH_STORY_CHAPTER_ID = 9;
/** Capítulo Story para la campaña Boreas / mapa Icebreaker (API tarkov.dev). */
export const ICEBREAKER_STORY_CHAPTER_ID = 10;

function taskSearchText(task: Task): string {
  const objectiveText = task.objectives.map((o) => o.description).join(' ');
  return `${task.name} ${objectiveText}`;
}

export function isLightkeeperStoryTask(task: Task): boolean {
  return task.trader.normalizedName === 'lightkeeper';
}

export function isLabyrinthStoryTask(task: Task): boolean {
  if (task.map?.normalizedName === 'the-labyrinth') return true;
  return /labyrinth/i.test(taskSearchText(task));
}

export function isIcebreakerStoryTask(task: Task): boolean {
  return BOREAS_API_TASK_IDS.has(task.id);
}

/** Misiones de comerciantes que pertenecen a la campaña Story (API tarkov.dev). */
export function isStoryApiTask(task: Task): boolean {
  return (
    isLightkeeperStoryTask(task) ||
    isLabyrinthStoryTask(task) ||
    isIcebreakerStoryTask(task)
  );
}

export function isSideTask(task: Task): boolean {
  return !isStoryApiTask(task);
}

export function getStoryApiChapterId(task: Task): number | null {
  if (isLabyrinthStoryTask(task)) return LABYRINTH_STORY_CHAPTER_ID;
  if (isIcebreakerStoryTask(task)) return ICEBREAKER_STORY_CHAPTER_ID;
  return null;
}

export function storyApiTaskMatchesChapter(
  task: Task,
  chapterFilter: number | 'all',
): boolean {
  if (chapterFilter === 'all') return true;
  return getStoryApiChapterId(task) === chapterFilter;
}
