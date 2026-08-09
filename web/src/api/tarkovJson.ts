import {
  MIN_VALID_TASK_COUNT,
  toJsonGameMode,
  type GameMode,
  type GameMap,
  type ItemRef,
  type Task,
  type TaskObjective,
  type TaskRewards,
  type Trader,
} from '../types';

const JSON_API_BASE = 'https://json.tarkov.dev';

type LocaleDict = Record<string, string>;

interface JsonMap {
  id: string;
  name: string;
  normalizedName: string;
}

interface JsonTrader {
  id: string;
  name: string;
  normalizedName: string;
}

interface JsonItem {
  id: string;
  name: string;
  shortName: string;
  normalizedName?: string;
  iconLink?: string | null;
}

interface JsonQuestItem {
  id: string;
  name: string;
  shortName: string;
  normalizedName?: string;
  iconLink?: string | null;
}

interface JsonTaskRequirement {
  task: string;
  status: string[];
}

interface JsonTraderRequirement {
  requirementType: string;
  compareMethod: string;
  value: number;
  trader: string;
}

interface JsonZone {
  id: string;
  map: string;
  position?: { x: number; y: number; z?: number } | null;
}

interface JsonMapPosition {
  x: number;
  y: number;
  z?: number;
}

/** Ubicaciones de quest items (findQuestItem) en json.tarkov.dev. */
interface JsonPossibleLocation {
  map: string;
  positions?: JsonMapPosition[] | null;
}

interface JsonObjective {
  id: string;
  description: string;
  type: string;
  optional?: boolean;
  maps?: string[];
  zones?: JsonZone[];
  possibleLocations?: JsonPossibleLocation[];
  count?: number;
  foundInRaid?: boolean;
  item?: string;
  items?: string[];
  requiredKeys?: unknown;
  targetNames?: string[];
  bodyParts?: string[];
  useAny?: string[];
  markerItem?: string;
  exitName?: string | null;
  exitStatus?: string[] | string | null;
  questItem?: string;
}

interface JsonTask {
  id: string;
  name: string;
  normalizedName: string;
  minPlayerLevel?: number | null;
  wikiLink?: string | null;
  experience?: number;
  kappaRequired?: boolean | null;
  factionName?: string | null;
  trader: string;
  map?: string | null;
  taskRequirements?: JsonTaskRequirement[];
  traderRequirements?: JsonTraderRequirement[];
  objectives?: JsonObjective[];
  finishRewards?: {
    traderStanding?: { standing: number; trader: string }[];
    items?: { item: string; count: number }[];
  } | null;
}

function translate(dict: LocaleDict | undefined, key: string | null | undefined, fallback = ''): string {
  if (!key) return fallback;
  return dict?.[key] ?? (fallback || key);
}

async function fetchJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${JSON_API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('No se pudo contactar con json.tarkov.dev (error de red).');
  }

  if (!response.ok) {
    throw new Error(`json.tarkov.dev error (HTTP ${response.status}) en ${path}`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`json.tarkov.dev devolvió JSON inválido en ${path}`);
  }
}

function flattenIds(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') out.push(entry);
    else if (Array.isArray(entry)) {
      for (const nested of entry) {
        if (typeof nested === 'string') out.push(nested);
      }
    }
  }
  return out;
}

function resolveMap(
  mapId: string | null | undefined,
  mapsById: Map<string, JsonMap>,
  mapsLocale: LocaleDict,
): GameMap | null {
  if (!mapId) return null;
  const map = mapsById.get(mapId);
  if (!map) {
    return { normalizedName: mapId, name: mapId };
  }
  return {
    normalizedName: map.normalizedName,
    name: translate(mapsLocale, map.name, map.normalizedName),
  };
}

function resolveTrader(
  traderId: string,
  tradersById: Map<string, JsonTrader>,
  tradersLocale: LocaleDict,
): Trader {
  const trader = tradersById.get(traderId);
  if (!trader) {
    return { id: traderId, name: traderId, normalizedName: traderId };
  }
  return {
    id: trader.id,
    name: translate(tradersLocale, trader.name, trader.normalizedName),
    normalizedName: trader.normalizedName,
  };
}

function resolveItem(
  itemId: string | null | undefined,
  itemsById: Map<string, JsonItem>,
  questItemsById: Map<string, JsonQuestItem>,
  itemsLocale: LocaleDict,
  tasksLocale: LocaleDict,
): ItemRef | null {
  if (!itemId) return null;

  const questItem = questItemsById.get(itemId);
  if (questItem) {
    return {
      id: questItem.id,
      name: translate(tasksLocale, questItem.name, questItem.normalizedName ?? itemId),
      shortName: translate(tasksLocale, questItem.shortName, questItem.id),
      iconLink: questItem.iconLink ?? `https://assets.tarkov.dev/${itemId}-icon.webp`,
    };
  }

  const item = itemsById.get(itemId);
  if (item) {
    return {
      id: item.id,
      name: translate(itemsLocale, item.name, item.normalizedName ?? itemId),
      shortName: translate(itemsLocale, item.shortName, item.id),
      iconLink: item.iconLink ?? `https://assets.tarkov.dev/${itemId}-icon.webp`,
    };
  }

  return {
    id: itemId,
    name: itemId,
    shortName: itemId,
    iconLink: `https://assets.tarkov.dev/${itemId}-icon.webp`,
  };
}

function expandPossibleLocations(
  objectiveId: string,
  possibleLocations: JsonPossibleLocation[] | undefined,
  mapsById: Map<string, JsonMap>,
  mapsLocale: LocaleDict,
): { zones: NonNullable<TaskObjective['zones']>; maps: GameMap[] } {
  const zones: NonNullable<TaskObjective['zones']> = [];
  const mapsByKey = new Map<string, GameMap>();

  for (const [locIndex, entry] of (possibleLocations ?? []).entries()) {
    const map = resolveMap(entry.map, mapsById, mapsLocale) ?? {
      normalizedName: entry.map,
      name: entry.map,
    };
    mapsByKey.set(map.normalizedName, map);

    for (const [posIndex, position] of (entry.positions ?? []).entries()) {
      if (!position || !Number.isFinite(position.x)) continue;
      // En EFT/tarkov.dev, lat ≈ z (o y si z falta).
      const z = Number.isFinite(position.z) ? Number(position.z) : position.y;
      if (!Number.isFinite(z)) continue;

      zones.push({
        id: `${objectiveId}:possible:${locIndex}:${posIndex}`,
        map,
        position: { x: position.x, y: position.y, z },
      });
    }
  }

  return { zones, maps: [...mapsByKey.values()] };
}

function mapObjective(
  objective: JsonObjective,
  mapsById: Map<string, JsonMap>,
  mapsLocale: LocaleDict,
  itemsById: Map<string, JsonItem>,
  questItemsById: Map<string, JsonQuestItem>,
  itemsLocale: LocaleDict,
  tasksLocale: LocaleDict,
): TaskObjective {
  const mapsFromIds = (objective.maps ?? [])
    .map((id) => resolveMap(id, mapsById, mapsLocale))
    .filter((m): m is GameMap => m != null);

  const zonesFromApi = (objective.zones ?? []).map((zone) => ({
    id: zone.id,
    map: resolveMap(zone.map, mapsById, mapsLocale) ?? {
      normalizedName: zone.map,
      name: zone.map,
    },
    position: zone.position ?? null,
  }));

  const fromPossible = expandPossibleLocations(
    objective.id,
    objective.possibleLocations,
    mapsById,
    mapsLocale,
  );

  const mapsByKey = new Map<string, GameMap>();
  for (const map of [...mapsFromIds, ...fromPossible.maps]) {
    mapsByKey.set(map.normalizedName, map);
  }
  const maps = [...mapsByKey.values()];
  const zones = [...zonesFromApi, ...fromPossible.zones];

  const itemIds = flattenIds(objective.items);
  const keyIds = flattenIds(objective.requiredKeys);
  const useAnyIds = flattenIds(objective.useAny);
  const mappedItems = itemIds.length > 0
    ? itemIds
      .map((id) => resolveItem(id, itemsById, questItemsById, itemsLocale, tasksLocale))
      .filter((x): x is ItemRef => x != null)
    : [];
  // JSON a menudo trae giveItem/findItem solo en `items[]`; la UI usa `item`.
  const primaryItem =
    resolveItem(objective.item, itemsById, questItemsById, itemsLocale, tasksLocale)
    ?? mappedItems[0]
    ?? undefined;

  const exitStatus = Array.isArray(objective.exitStatus)
    ? objective.exitStatus.map((s) => translate(tasksLocale, s, s)).join(', ')
    : objective.exitStatus
      ? translate(tasksLocale, objective.exitStatus, objective.exitStatus)
      : null;

  return {
    id: objective.id,
    type: objective.type,
    description: translate(tasksLocale, objective.description, objective.description),
    optional: Boolean(objective.optional),
    maps,
    zones: zones.length > 0 ? zones : undefined,
    count: objective.count,
    foundInRaid: objective.foundInRaid,
    item: primaryItem,
    items: mappedItems.length > 0 ? mappedItems : undefined,
    requiredKeys: keyIds.length > 0
      ? keyIds
        .map((id) => resolveItem(id, itemsById, questItemsById, itemsLocale, tasksLocale))
        .filter((x): x is ItemRef => x != null)
      : null,
    targetNames: objective.targetNames,
    bodyParts: objective.bodyParts,
    useAny: useAnyIds.length > 0
      ? useAnyIds
        .map((id) => resolveItem(id, itemsById, questItemsById, itemsLocale, tasksLocale))
        .filter((x): x is ItemRef => x != null)
      : undefined,
    markerItem: resolveItem(objective.markerItem, itemsById, questItemsById, itemsLocale, tasksLocale),
    exitName: objective.exitName
      ? translate(tasksLocale, objective.exitName, objective.exitName)
      : null,
    exitStatus,
    questItem: resolveItem(objective.questItem, itemsById, questItemsById, itemsLocale, tasksLocale),
  };
}

function mapFinishRewards(
  rewards: JsonTask['finishRewards'],
  tradersById: Map<string, JsonTrader>,
  tradersLocale: LocaleDict,
  itemsById: Map<string, JsonItem>,
  questItemsById: Map<string, JsonQuestItem>,
  itemsLocale: LocaleDict,
  tasksLocale: LocaleDict,
): TaskRewards | null {
  if (!rewards) return null;

  return {
    traderStanding: (rewards.traderStanding ?? []).map((entry) => ({
      standing: entry.standing,
      trader: { name: resolveTrader(entry.trader, tradersById, tradersLocale).name },
    })),
    items: (rewards.items ?? [])
      .map((entry) => {
        const item = resolveItem(entry.item, itemsById, questItemsById, itemsLocale, tasksLocale);
        if (!item) return null;
        return { item, count: entry.count };
      })
      .filter((x): x is { item: ItemRef; count: number } => x != null),
  };
}

function mapTask(
  raw: JsonTask,
  taskNameById: Map<string, string>,
  mapsById: Map<string, JsonMap>,
  mapsLocale: LocaleDict,
  tradersById: Map<string, JsonTrader>,
  tradersLocale: LocaleDict,
  itemsById: Map<string, JsonItem>,
  questItemsById: Map<string, JsonQuestItem>,
  itemsLocale: LocaleDict,
  tasksLocale: LocaleDict,
): Task {
  return {
    id: raw.id,
    name: translate(tasksLocale, raw.name, raw.normalizedName || raw.id),
    normalizedName: raw.normalizedName,
    minPlayerLevel: raw.minPlayerLevel ?? null,
    wikiLink: raw.wikiLink ?? null,
    experience: raw.experience ?? 0,
    kappaRequired: raw.kappaRequired ?? null,
    factionName: raw.factionName ?? null,
    trader: resolveTrader(raw.trader, tradersById, tradersLocale),
    map: resolveMap(raw.map, mapsById, mapsLocale),
    taskRequirements: (raw.taskRequirements ?? []).map((req) => ({
      status: req.status ?? ['complete'],
      task: {
        id: req.task,
        name: taskNameById.get(req.task) ?? req.task,
      },
    })),
    traderRequirements: (raw.traderRequirements ?? []).map((req) => ({
      requirementType: req.requirementType,
      compareMethod: req.compareMethod,
      value: req.value,
      trader: {
        id: req.trader,
        name: resolveTrader(req.trader, tradersById, tradersLocale).name,
      },
    })),
    objectives: (raw.objectives ?? []).map((objective) => mapObjective(
      objective,
      mapsById,
      mapsLocale,
      itemsById,
      questItemsById,
      itemsLocale,
      tasksLocale,
    )),
    finishRewards: mapFinishRewards(
      raw.finishRewards,
      tradersById,
      tradersLocale,
      itemsById,
      questItemsById,
      itemsLocale,
      tasksLocale,
    ),
  };
}

/**
 * Carga misiones desde json.tarkov.dev (API REST alternativa a GraphQL).
 * Seasonal (Kord Breach) → `pvp-season`; Regular → `regular`; PvE → `pve`.
 * @see https://json.tarkov.dev/endpoints
 */
export async function fetchTasksFromJson(
  lang: 'es' | 'en' = 'es',
  gameMode: GameMode = 'regular',
): Promise<Task[]> {
  const mode = toJsonGameMode(gameMode);

  const [
    tasksPayload,
    tasksLocalePayload,
    mapsPayload,
    mapsLocalePayload,
    tradersPayload,
    tradersLocalePayload,
    itemsPayload,
    itemsLocalePayload,
  ] = await Promise.all([
    fetchJson<{ data: { tasks: Record<string, JsonTask>; questItems?: Record<string, JsonQuestItem> } }>(
      `/${mode}/tasks`,
    ),
    fetchJson<{ data: LocaleDict }>(`/${mode}/tasks_${lang}`),
    fetchJson<{ data: { maps: Record<string, JsonMap> } }>(`/${mode}/maps`),
    fetchJson<{ data: LocaleDict }>(`/${mode}/maps_${lang}`),
    // traders viene plano en data[id], a diferencia de maps/items/tasks.
    fetchJson<{ data: Record<string, JsonTrader> }>(`/${mode}/traders`),
    fetchJson<{ data: LocaleDict }>(`/${mode}/traders_${lang}`),
    fetchJson<{ data: { items: Record<string, JsonItem> } }>(`/${mode}/items`),
    fetchJson<{ data: LocaleDict }>(`/${mode}/items_${lang}`),
  ]);

  const tasksLocale = tasksLocalePayload.data ?? {};
  const mapsLocale = mapsLocalePayload.data ?? {};
  const tradersLocale = tradersLocalePayload.data ?? {};
  const itemsLocale = itemsLocalePayload.data ?? {};

  const mapsById = new Map(Object.values(mapsPayload.data.maps ?? {}).map((m) => [m.id, m]));
  const tradersById = new Map(
    Object.values(tradersPayload.data ?? {})
      .filter((t): t is JsonTrader => Boolean(t && typeof t === 'object' && 'id' in t && 'normalizedName' in t))
      .map((t) => [t.id, t]),
  );
  const itemsById = new Map(Object.values(itemsPayload.data.items ?? {}).map((i) => [i.id, i]));
  const questItemsById = new Map(
    Object.values(tasksPayload.data.questItems ?? {}).map((q) => [q.id, q]),
  );

  const rawTasks = Object.values(tasksPayload.data.tasks ?? {});
  if (rawTasks.length < MIN_VALID_TASK_COUNT) {
    throw new Error(
      `json.tarkov.dev devolvió una lista incompleta (${rawTasks.length} misiones).`,
    );
  }

  const taskNameById = new Map<string, string>();
  for (const raw of rawTasks) {
    taskNameById.set(raw.id, translate(tasksLocale, raw.name, raw.normalizedName || raw.id));
  }

  return rawTasks
    .map((raw) => mapTask(
      raw,
      taskNameById,
      mapsById,
      mapsLocale,
      tradersById,
      tradersLocale,
      itemsById,
      questItemsById,
      itemsLocale,
      tasksLocale,
    ))
    .sort((a, b) => a.name.localeCompare(b.name));
}
