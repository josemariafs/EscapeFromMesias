import type { Task } from '../types';

export function normalizeQuestName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactQuestName(name: string): string {
  return normalizeQuestName(name).replace(/\s+/g, '');
}

export function matchTasksInText(text: string, tasks: Task[]): Task[] {
  const normalizedText = normalizeQuestName(text);
  const compactText = compactQuestName(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeQuestName(line))
    .filter((line) => line.length >= 4);

  const matched = new Set<string>();
  const sorted = [...tasks].sort((a, b) => b.name.length - a.name.length);

  for (const task of sorted) {
    const norm = normalizeQuestName(task.name);
    const compact = compactQuestName(task.name);
    if (norm.length < 4) continue;

    if (normalizedText.includes(norm) || compactText.includes(compact)) {
      matched.add(task.id);
      continue;
    }

    for (const line of lines) {
      const lineCompact = line.replace(/\s+/g, '');
      if (
        line.includes(norm)
        || norm.includes(line)
        || lineCompact.includes(compact)
        || compact.includes(lineCompact)
      ) {
        matched.add(task.id);
        break;
      }
    }
  }

  return tasks.filter((task) => matched.has(task.id));
}

export function collectPrerequisiteTaskIds(
  taskId: string,
  tasksById: Map<string, Task>,
  excludeIds: Set<string>,
  visited = new Set<string>(),
): string[] {
  if (visited.has(taskId)) return [];
  visited.add(taskId);

  const task = tasksById.get(taskId);
  if (!task) return [];

  const result: string[] = [];
  for (const req of task.taskRequirements) {
    const prereqId = req.task.id;
    if (excludeIds.has(prereqId)) continue;
    result.push(prereqId);
    result.push(...collectPrerequisiteTaskIds(prereqId, tasksById, excludeIds, visited));
  }
  return result;
}

export function buildImportStateUpdate(
  tasks: Task[],
  activeTaskIds: string[],
): { activeIds: string[]; completedIds: string[] } {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const activeSet = new Set(activeTaskIds);
  const completedIds = new Set<string>();

  for (const taskId of activeTaskIds) {
    for (const prereqId of collectPrerequisiteTaskIds(taskId, tasksById, activeSet)) {
      completedIds.add(prereqId);
    }
  }

  return {
    activeIds: activeTaskIds,
    completedIds: [...completedIds],
  };
}
