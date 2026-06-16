import type { ItemRef, PlayerProgress, Task, TaskProgressState } from '../types';

const MAX_TRADER_LEVEL = 4;
const MAX_TRADER_REPUTATION = 4;

function compareValue(actual: number, method: string, expected: number): boolean {
  switch (method) {
    case '>=':
      return actual >= expected;
    case '>':
      return actual > expected;
    case '<=':
      return actual <= expected;
    case '<':
      return actual < expected;
    case '==':
    case '=':
      return actual === expected;
    default:
      return actual >= expected;
  }
}

function requirementStatusMet(
  requiredStatuses: string[],
  taskState: TaskProgressState | undefined,
): boolean {
  if (!taskState || taskState === 'locked' || taskState === 'available') {
    return false;
  }

  return requiredStatuses.some((status) => {
    switch (status) {
      case 'complete':
        return taskState === 'completed';
      case 'failed':
        return taskState === 'failed';
      case 'started':
      case 'active':
        return taskState === 'started' || taskState === 'completed';
      default:
        return taskState === 'completed';
    }
  });
}

export function areTaskRequirementsMet(
  task: Task,
  progress: PlayerProgress,
): boolean {
  if (
    progress.playerLevel > 0
    && task.minPlayerLevel
    && progress.playerLevel < task.minPlayerLevel
  ) {
    return false;
  }

  for (const req of task.traderRequirements) {
    const actual = req.requirementType === 'reputation'
      ? MAX_TRADER_REPUTATION
      : MAX_TRADER_LEVEL;
    if (!compareValue(actual, req.compareMethod, req.value)) return false;
  }

  for (const req of task.taskRequirements) {
    const prereqState = progress.taskStates[req.task.id];
    if (!requirementStatusMet(req.status, prereqState)) {
      return false;
    }
  }

  return true;
}

export function computeEffectiveState(
  task: Task,
  progress: PlayerProgress,
): TaskProgressState {
  const stored = progress.taskStates[task.id];

  if (stored === 'started' || stored === 'completed' || stored === 'failed') {
    return stored;
  }

  if (areTaskRequirementsMet(task, progress)) {
    return stored === 'available' ? 'available' : 'available';
  }

  return 'locked';
}

export function recalculateStates(
  tasks: Task[],
  progress: PlayerProgress,
): Record<string, TaskProgressState> {
  const next: Record<string, TaskProgressState> = { ...progress.taskStates };

  for (const task of tasks) {
    const current = next[task.id];

    if (current === 'started' || current === 'completed' || current === 'failed') {
      continue;
    }

    next[task.id] = areTaskRequirementsMet(task, progress) ? 'available' : 'locked';
  }

  return next;
}

export function getRequiredKeys(task: Task): ItemRef[] {
  const keys = new Map<string, ItemRef>();

  for (const obj of task.objectives) {
    for (const key of obj.requiredKeys ?? []) {
      keys.set(key.id, key);
    }
  }

  return [...keys.values()];
}

export interface QuestItemRequirement {
  item?: ItemRef;
  count?: number;
  anyItem?: boolean;
  /** Etiqueta legible cuando el objetivo acepta varios ítems (categoría, marca, etc.). */
  groupLabel?: string;
}

const ANY_ITEM_ID = '__any_item__';

/** Extrae una etiqueta de grupo/categoría desde la descripción del objetivo (EN/ES). */
export function extractItemGroupLabel(description: string): string | null {
  const d = description.trim();

  const rules = [
    /from the (.+?) categor(?:y|ies)/i,
    /categor[ií]a:?\s*(.+?)$/i,
    /found in raid items?:\s*(.+?)$/i,
    /incursi[oó]n:\s*(.+?)$/i,
    /(?:any )?found in raid (.+?) items$/i,
    /objetos? de (.+?) encontrados? en incursi[oó]n/i,
    /objeto de (.+?) encontrado en incursi[oó]n/i,
    /(?:Hand over|Entrega) any (.+?)(?:\.|$)/i,
    /found in raid (.+ brand equipment)$/i,
    /(?:Hand over|Entrega) the found in raid (.+?)(?:\.|$)/i,
    /Stash a pack of any (.+?) at/i,
    /Find any (.+?) in raid/i,
    /(?:Hand over|Entrega) the (.+?)(?:\.|$)/i,
  ];

  for (const rule of rules) {
    const match = d.match(rule);
    const label = match?.[1]?.trim().replace(/\.$/, '');
    if (label && label.length > 0 && label.length < 80) {
      return label;
    }
  }

  return null;
}

function mergeAnyItem(
  byId: Map<string, QuestItemRequirement>,
  count = 1,
) {
  const existing = byId.get(ANY_ITEM_ID);
  if (existing?.anyItem) {
    existing.count = Math.max(existing.count ?? 1, count);
  } else {
    byId.set(ANY_ITEM_ID, {
      anyItem: true,
      count: count > 1 ? count : undefined,
    });
  }
}

function addGroupLabel(
  byId: Map<string, QuestItemRequirement>,
  label: string,
  count = 1,
) {
  const key = `__group__:${label.toLowerCase()}`;
  const existing = byId.get(key);
  if (existing) {
    existing.count = Math.max(existing.count ?? 1, count);
  } else {
    byId.set(key, {
      groupLabel: label,
      count: count > 1 ? count : undefined,
    });
  }
}

/** Llaves e ítems necesarios para completar la misión (objectives). */
export function getQuestItemRequirements(task: Task): QuestItemRequirement[] {
  const byId = new Map<string, QuestItemRequirement>();

  const add = (item: ItemRef | null | undefined, count = 1) => {
    if (!item) return;
    const existing = byId.get(item.id);
    if (existing) {
      const prev = existing.count ?? 1;
      existing.count = Math.max(prev, count);
    } else {
      byId.set(item.id, { item, count: count > 1 ? count : undefined });
    }
  };

  const addFlexibleItemObjective = (
    description: string,
    count: number | undefined,
    alternativeCount: number,
  ) => {
    const qty = count ?? 1;
    if (alternativeCount > 1) {
      const groupLabel = extractItemGroupLabel(description);
      if (groupLabel) {
        addGroupLabel(byId, groupLabel, qty);
      } else {
        mergeAnyItem(byId, qty);
      }
      return;
    }
  };

  for (const obj of task.objectives) {
    for (const key of obj.requiredKeys ?? []) add(key);
    if (obj.markerItem) add(obj.markerItem);
    if (obj.questItem) add(obj.questItem, obj.count);

    const alternativeCount = obj.items?.length ?? 0;

    if (obj.useAny && obj.useAny.length > 0) {
      addFlexibleItemObjective(obj.description, obj.count, obj.useAny.length);
    } else if (alternativeCount > 1) {
      addFlexibleItemObjective(obj.description, obj.count, alternativeCount);
    } else if (obj.item) {
      add(obj.item, obj.count);
    } else {
      for (const entry of obj.items ?? []) add(entry, obj.count);
    }
  }

  return [...byId.values()];
}

export function countByState(
  tasks: Task[],
  states: Record<string, TaskProgressState>,
): Record<TaskProgressState, number> {
  const counts: Record<TaskProgressState, number> = {
    locked: 0,
    available: 0,
    started: 0,
    completed: 0,
    failed: 0,
  };

  for (const task of tasks) {
    const state = states[task.id] ?? 'locked';
    counts[state]++;
  }

  return counts;
}

export function displayStateSortRank(state: TaskProgressState): number {
  switch (state) {
    case 'started':
      return 0;
    case 'available':
      return 1;
    case 'locked':
    case 'failed':
      return 2;
    case 'completed':
      return 3;
    default:
      return 2;
  }
}

export function compareByDisplayState(
  aState: TaskProgressState,
  bState: TaskProgressState,
  aName: string,
  bName: string,
  locale = 'es',
): number {
  const rankA = displayStateSortRank(aState);
  const rankB = displayStateSortRank(bState);
  if (rankA !== rankB) return rankA - rankB;
  return aName.localeCompare(bName, locale, { sensitivity: 'base' });
}

export function sortTasksForDisplay(
  tasks: Task[],
  states: Record<string, TaskProgressState>,
  locale = 'es',
): Task[] {
  return [...tasks].sort((a, b) =>
    compareByDisplayState(
      states[a.id] ?? 'locked',
      states[b.id] ?? 'locked',
      a.name,
      b.name,
      locale,
    ),
  );
}
