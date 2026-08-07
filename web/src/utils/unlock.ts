import type {
  ItemRef,
  PlayerProgress,
  Task,
  TaskProgressState,
  TraderRequirement,
} from '../types';

/** Loyalty Level por defecto al crear un personaje (EFT 1.1: side quests ligadas a LL). */
export const DEFAULT_TRADER_LOYALTY = 1;
const DEFAULT_TRADER_REPUTATION = 0;
const MAX_TRADER_LOYALTY = 4;

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

function isReputationRequirement(requirementType: string): boolean {
  return requirementType === 'reputation' || requirementType === 'standing';
}

/** Loyalty Level mínimo exigido por los requisitos de comerciante de la misión (0 = sin requisito LL). */
export function getRequiredLoyaltyLevel(task: Task): number {
  let max = 0;
  for (const req of task.traderRequirements) {
    const implied = minLoyaltyImpliedByRequirement(req);
    if (implied != null) max = Math.max(max, implied);
  }
  return max;
}

/**
 * LL mínimo que implica un requisito (null si no fija un suelo, p. ej. `<=`).
 * Tener la misión activa/completada prueba que el jugador cumple al menos ese valor.
 */
function minLoyaltyImpliedByRequirement(req: TraderRequirement): number | null {
  if (isReputationRequirement(req.requirementType)) return null;
  const value = Number(req.value);
  if (!Number.isFinite(value)) return null;

  switch (req.compareMethod) {
    case '>':
      return Math.max(1, Math.min(MAX_TRADER_LOYALTY, Math.floor(value) + 1));
    case '>=':
    case '==':
    case '=':
    case '':
    case undefined:
      return Math.max(1, Math.min(MAX_TRADER_LOYALTY, Math.round(value)));
    default:
      return null;
  }
}

/**
 * Infiere el LL de cada trader a partir de misiones started/completed:
 * el máximo requisito de LL de esas misiones es un suelo seguro del LL real.
 */
export function inferTraderLoyaltyLevels(
  tasks: Task[],
  taskStates: Record<string, TaskProgressState>,
): Record<string, number> {
  const levels: Record<string, number> = {};

  for (const task of tasks) {
    const state = taskStates[task.id];
    if (state !== 'started' && state !== 'completed') continue;

    for (const req of task.traderRequirements) {
      const min = minLoyaltyImpliedByRequirement(req);
      if (min == null) continue;
      const traderId = req.trader.id;
      levels[traderId] = Math.max(levels[traderId] ?? DEFAULT_TRADER_LOYALTY, min);
    }
  }

  return levels;
}

/** Sube los LL guardados hasta el suelo inferido; nunca los baja. */
export function raiseTraderLevelsToInferred(
  current: Record<string, number>,
  inferred: Record<string, number>,
): { traderLevels: Record<string, number>; changed: boolean } {
  const traderLevels = { ...current };
  let changed = false;

  for (const [traderId, level] of Object.entries(inferred)) {
    const next = Math.max(1, Math.min(MAX_TRADER_LOYALTY, level));
    const prev = traderLevels[traderId] ?? DEFAULT_TRADER_LOYALTY;
    if (next > prev) {
      traderLevels[traderId] = next;
      changed = true;
    }
  }

  return { traderLevels, changed };
}

const MAX_PLAYER_LEVEL = 79;

/**
 * Nivel de jugador mínimo inferido: el mayor `minPlayerLevel` entre misiones
 * started/completed. 0 si ninguna impone nivel.
 */
export function inferPlayerLevel(
  tasks: Task[],
  taskStates: Record<string, TaskProgressState>,
): number {
  let max = 0;
  for (const task of tasks) {
    const state = taskStates[task.id];
    if (state !== 'started' && state !== 'completed') continue;
    const required = task.minPlayerLevel;
    if (required == null || required <= 0) continue;
    max = Math.max(max, required);
  }
  return Math.max(0, Math.min(MAX_PLAYER_LEVEL, max));
}

/** Sube el nivel de jugador hasta el suelo inferido; nunca lo baja. */
export function raisePlayerLevelToInferred(
  current: number,
  inferred: number,
): { playerLevel: number; changed: boolean } {
  const floor = Math.max(0, Math.min(MAX_PLAYER_LEVEL, inferred));
  if (floor <= 0 || floor <= current) {
    return { playerLevel: current, changed: false };
  }
  return { playerLevel: floor, changed: true };
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
    const actual = isReputationRequirement(req.requirementType)
      ? (progress.traderReputation[req.trader.id] ?? DEFAULT_TRADER_REPUTATION)
      : (progress.traderLevels[req.trader.id] ?? DEFAULT_TRADER_LOYALTY);
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

/**
 * Orden EFT 1.1: estado → comerciante → Loyalty Level → nombre.
 * Refleja el desbloqueo no lineal por grupos de side quests según LL.
 */
export function sortTasksForDisplay(
  tasks: Task[],
  states: Record<string, TaskProgressState>,
  locale = 'es',
): Task[] {
  return [...tasks].sort((a, b) => {
    const rankA = displayStateSortRank(states[a.id] ?? 'locked');
    const rankB = displayStateSortRank(states[b.id] ?? 'locked');
    if (rankA !== rankB) return rankA - rankB;

    const traderCmp = a.trader.name.localeCompare(b.trader.name, locale, { sensitivity: 'base' });
    if (traderCmp !== 0) return traderCmp;

    const llCmp = getRequiredLoyaltyLevel(a) - getRequiredLoyaltyLevel(b);
    if (llCmp !== 0) return llCmp;

    return a.name.localeCompare(b.name, locale, { sensitivity: 'base' });
  });
}
