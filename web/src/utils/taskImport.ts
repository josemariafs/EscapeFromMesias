import type { Task } from '../types';

const LOCATION_NOISE = new Set([
  'any location',
  'customs',
  'ground zero',
  'factory',
  'woods',
  'shoreline',
  'interchange',
  'reserve',
  'lighthouse',
  'streets of tarkov',
  'the lab',
  'laboratory',
  'active',
]);

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

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);

  for (let j = 1; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

function similarityRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function isNoiseLine(line: string): boolean {
  if (LOCATION_NOISE.has(line)) return true;
  if (/^\d+%?$/.test(line)) return true;
  if (/^(task|trader|type|location|status|progress)$/i.test(line)) return true;
  return false;
}

function extractCandidateLines(text: string): string[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => normalizeQuestName(line))
    .filter((line) => line.length >= 4 && !isNoiseLine(line));

  const candidates = new Set<string>(rawLines);
  const joined = normalizeQuestName(text.replace(/\r?\n/g, ' '));
  if (joined.length >= 4) candidates.add(joined);

  for (let i = 0; i < rawLines.length - 1; i++) {
    const merged = normalizeQuestName(`${rawLines[i]} ${rawLines[i + 1]}`);
    if (merged.length >= 4) candidates.add(merged);
  }

  return [...candidates];
}

function bestTaskSimilarity(norm: string, compact: string, text: string): number {
  const normalizedText = normalizeQuestName(text);
  const compactText = compactQuestName(text);
  const lines = extractCandidateLines(text);

  let best = 0;

  if (normalizedText.includes(norm) || compactText.includes(compact)) {
    return 1;
  }

  best = Math.max(best, similarityRatio(norm, normalizedText));

  for (const line of lines) {
    const lineCompact = line.replace(/\s+/g, '');
    best = Math.max(best, similarityRatio(norm, line));
    best = Math.max(best, similarityRatio(compact, lineCompact));
    if (line.includes(norm) || norm.includes(line)) {
      best = Math.max(best, 0.88);
    }
  }

  const minWindow = Math.max(6, compact.length - 2);
  const maxWindow = compact.length + 4;
  for (let size = minWindow; size <= maxWindow; size++) {
    for (let i = 0; i <= compactText.length - size; i++) {
      best = Math.max(best, similarityRatio(compact, compactText.slice(i, i + size)));
    }
  }

  return best;
}

function minSimilarityThreshold(nameLength: number): number {
  if (nameLength >= 20) return 0.68;
  if (nameLength >= 12) return 0.72;
  return 0.78;
}

export function matchTasksInText(text: string, tasks: Task[]): Task[] {
  if (!text.trim()) return [];

  const matched = new Set<string>();
  const sorted = [...tasks].sort((a, b) => b.name.length - a.name.length);

  for (const task of sorted) {
    const norm = normalizeQuestName(task.name);
    const compact = compactQuestName(task.name);
    if (norm.length < 4) continue;

    const score = bestTaskSimilarity(norm, compact, text);
    if (score >= minSimilarityThreshold(norm.length)) {
      matched.add(task.id);
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
