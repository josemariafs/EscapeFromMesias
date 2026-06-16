import type { TaskProgressState } from '../types';
import type { StoryNodeFlat } from '../types/storyline';
import { compareByDisplayState } from './unlock';

export function recalculateStoryStates(
  nodes: StoryNodeFlat[],
  states: Record<string, TaskProgressState>,
): Record<string, TaskProgressState> {
  const next: Record<string, TaskProgressState> = { ...states };

  for (const node of nodes) {
    const current = next[node.id];
    if (current === 'completed' || current === 'started') continue;

    const reqsMet =
      node.taskRequirements.length === 0
      || node.taskRequirements.every((r) => next[r.task.id] === 'completed');

    next[node.id] = reqsMet ? 'available' : 'locked';
  }

  return next;
}

export function countStoryByState(
  nodes: StoryNodeFlat[],
  states: Record<string, TaskProgressState>,
) {
  const counts = {
    available: 0,
    started: 0,
    completed: 0,
    locked: 0,
    failed: 0,
  };

  for (const node of nodes) {
    const state = states[node.id] ?? 'locked';
    counts[state]++;
  }

  return counts;
}

export function sortStoryNodesForDisplay(
  nodes: StoryNodeFlat[],
  states: Record<string, TaskProgressState>,
  locale = 'es',
): StoryNodeFlat[] {
  return [...nodes].sort((a, b) =>
    compareByDisplayState(
      states[a.id] ?? 'locked',
      states[b.id] ?? 'locked',
      a.name,
      b.name,
      locale,
    ),
  );
}
