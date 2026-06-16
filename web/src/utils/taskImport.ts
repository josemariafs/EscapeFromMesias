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
  'side',
  'story',
  'operational',
  'task',
  'trader',
  'type',
  'location',
  'status',
  'progress',
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

function extractPartNumber(name: string): number | null {
  const match = name.match(/(?:parte?|pt)\s*(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function extractSeriesBase(name: string): string {
  return name.replace(/\s*(?:parte?|pt)\s*\d+.*$/i, '').trim();
}

function isEmbeddedPrefix(questNorm: string, line: string): boolean {
  const idx = line.indexOf(questNorm);
  if (idx < 0) return false;
  const after = line[idx + questNorm.length];
  return Boolean(after && /[a-z0-9]/.test(after));
}

function partsMismatch(questNorm: string, line: string): boolean {
  const questPart = extractPartNumber(questNorm);
  const linePart = extractPartNumber(line);

  if (questPart != null) {
    if (linePart == null) return true;
    if (linePart !== questPart) return true;

    const questBase = extractSeriesBase(questNorm);
    const lineBase = extractSeriesBase(line);
    if (questBase && lineBase && similarityRatio(questBase, lineBase) < 0.55) {
      return true;
    }
  }

  if (linePart != null && questPart == null) {
    const lineBase = extractSeriesBase(line);
    if (lineBase.length > questNorm.length * 1.4) return true;
  }

  return false;
}

function isNoiseLine(line: string): boolean {
  if (LOCATION_NOISE.has(line)) return true;
  if (/^\d+%?$/.test(line)) return true;
  if (line.length < 4) return true;
  return false;
}

function stripLocationSuffix(line: string): string {
  for (const location of LOCATION_NOISE) {
    if (line === location) return '';
    if (line.endsWith(` ${location}`)) {
      return line.slice(0, -(location.length + 1)).trim();
    }
  }
  return line;
}

function cleanOcrLine(line: string): string {
  let cleaned = line
    .replace(/^\d+\s+/, '')
    .replace(/^[^a-z0-9]+/i, '')
    .trim();

  if (/^[a-z]\s+[a-z]/i.test(cleaned)) {
    cleaned = cleaned.slice(2).trim();
  }

  return cleaned;
}

function isGarbageLine(line: string): boolean {
  const letters = (line.match(/[a-z]/g) ?? []).length;
  if (letters < 5) return true;
  const compact = line.replace(/\s+/g, '');
  return letters / compact.length < 0.55;
}

/** Líneas OCR que parecen nombres de misión (una por fila del listado). */
export function extractOcrQuestLines(text: string): string[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => cleanOcrLine(normalizeQuestName(line)))
    .map(stripLocationSuffix)
    .filter((line) => line.length >= 4 && !isNoiseLine(line) && !isGarbageLine(line));

  const lines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    const next = rawLines[i + 1];

    if (
      next
      && /(?:pvp|fvp)\s*$/i.test(line)
      && /^(?:\d+\s*)?zone/i.test(next)
    ) {
      line = normalizeQuestName(`${line} ${next}`);
      i += 1;
    }

    if (line.length >= 4 && !isNoiseLine(line) && !isGarbageLine(line)) {
      lines.push(line);
    }
  }

  return lines;
}

/** Parte líneas que el OCR fusionó: "painkiller any location golden swag customs" → dos misiones. */
function expandMergedLines(lines: string[]): string[] {
  const locationSplit = /\s+(?:any location|customs|ground zero|factory|woods|shoreline|interchange|reserve|lighthouse|streets of tarkov|the lab|laboratory)\s+/i;
  const expanded: string[] = [];

  for (const line of lines) {
    if (locationSplit.test(line)) {
      const parts = line
        .split(locationSplit)
        .map((part) => part.trim())
        .filter((part) => part.length >= 4 && !isNoiseLine(part) && !isGarbageLine(part));
      expanded.push(...parts);
    } else {
      expanded.push(line);
    }
  }

  return expanded;
}

function bestLineScoreForTask(
  task: Task,
  lines: string[],
  englishNamesById?: Map<string, string>,
): { score: number; nameLength: number } {
  let bestScore = 0;
  let nameLength = 0;

  for (const line of lines) {
    for (const name of getTaskMatchNames(task, englishNamesById)) {
      const norm = normalizeQuestName(name);
      const compact = compactQuestName(name);
      if (norm.length < 4) continue;

      bestScore = Math.max(bestScore, lineMatchScore(norm, compact, line));
      nameLength = Math.max(nameLength, norm.length);
    }
  }

  return { score: bestScore, nameLength };
}

function lineMatchScore(questNorm: string, questCompact: string, line: string): number {
  if (partsMismatch(questNorm, line)) return 0;

  if (questNorm.length < line.length * 0.65) {
    if (line.includes(questNorm) && isEmbeddedPrefix(questNorm, line)) return 0;
  }

  const lineCompact = line.replace(/\s+/g, '');

  if (line === questNorm || lineCompact === questCompact) return 1;

  const ratio = similarityRatio(questNorm, line);
  const compactRatio = similarityRatio(questCompact, lineCompact);
  let score = Math.max(ratio, compactRatio);

  const shorter = Math.min(questNorm.length, line.length);
  const longer = Math.max(questNorm.length, line.length);

  if (longer > shorter * 1.35) {
    if (line.includes(questNorm) && shorter >= 10 && !isEmbeddedPrefix(questNorm, line)) {
      score = Math.max(score, 0.92);
    } else if (questNorm.includes(line) && line.length < questNorm.length * 0.75) {
      return 0;
    } else if (line.includes(questNorm) && questNorm.length < line.length * 0.75) {
      return 0;
    }
  }

  // Evita que "gunsmith part 1" coincida con "gunsmith part 2" por similitud alta.
  const questPart = extractPartNumber(questNorm);
  const linePart = extractPartNumber(line);
  if (questPart != null && linePart != null && questPart === linePart) {
    return score;
  }

  if (questPart != null && linePart != null) {
    return 0;
  }

  return score;
}

function minLineMatchThreshold(nameLength: number): number {
  if (nameLength >= 24) return 0.72;
  if (nameLength >= 14) return 0.8;
  if (nameLength >= 8) return 0.86;
  return 0.92;
}

function normalizeOcrText(text: string): string {
  return text
    .replace(/(\w)\s*=\s*(\w)/g, '$1 - $2')
    .replace(/(\w)\s*—\s*(\w)/g, '$1 - $2')
    .replace(/\[?\s*fvp/gi, '[pvp');
}

function getTaskMatchNames(task: Task, englishNamesById?: Map<string, string>): string[] {
  const names = new Set<string>([task.name]);
  const englishName = englishNamesById?.get(task.id);
  if (englishName) names.add(englishName);
  return [...names];
}

export function matchTasksInText(
  text: string,
  tasks: Task[],
  englishNamesById?: Map<string, string>,
): Task[] {
  const cleanedText = normalizeOcrText(text);
  const lines = expandMergedLines(extractOcrQuestLines(cleanedText));
  if (lines.length === 0) return [];

  const matched: Task[] = [];

  for (const task of tasks) {
    const { score, nameLength } = bestLineScoreForTask(task, lines, englishNamesById);
    if (nameLength < 4) continue;
    if (score >= minLineMatchThreshold(nameLength)) {
      matched.push(task);
    }
  }

  return matched;
}

function isCompleteRequirement(statuses: string[]): boolean {
  return statuses.some((status) => {
    switch (status) {
      case 'complete':
      case 'completed':
        return true;
      default:
        return false;
    }
  });
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
    if (!isCompleteRequirement(req.status)) continue;

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
