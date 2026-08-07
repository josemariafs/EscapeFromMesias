export type TaskProgressState = 'locked' | 'available' | 'started' | 'completed' | 'failed';

export interface Trader {
  id: string;
  name: string;
  normalizedName: string;
}

export interface GameMap {
  normalizedName: string;
  name: string;
}

export interface ItemRef {
  id: string;
  name: string;
  shortName: string;
  iconLink?: string | null;
}

export interface TaskRequirement {
  status: string[];
  task: { id: string; name: string };
}

export interface TraderRequirement {
  requirementType: string;
  compareMethod: string;
  value: number;
  trader: { id: string; name: string };
}

export interface MapPosition {
  x: number;
  y: number;
  z?: number;
}

export interface TaskZone {
  id: string;
  map: GameMap;
  position?: MapPosition | null;
}

export interface TaskObjective {
  id: string;
  type: string;
  description: string;
  optional: boolean;
  maps: GameMap[];
  item?: ItemRef | null;
  items?: ItemRef[];
  count?: number;
  foundInRaid?: boolean;
  requiredKeys?: ItemRef[] | null;
  targetNames?: string[];
  bodyParts?: string[];
  useAny?: ItemRef[];
  markerItem?: ItemRef | null;
  exitName?: string | null;
  exitStatus?: string | null;
  questItem?: ItemRef | null;
  zones?: TaskZone[];
}

export interface TaskRewardItem {
  count: number;
  item: ItemRef;
}

export interface TaskRewards {
  traderStanding?: { standing: number; trader: { name: string } }[];
  items?: TaskRewardItem[];
}

export interface Task {
  id: string;
  name: string;
  normalizedName: string;
  minPlayerLevel: number | null;
  wikiLink: string | null;
  experience: number;
  kappaRequired: boolean | null;
  factionName: string | null;
  trader: Trader;
  map: GameMap | null;
  taskRequirements: TaskRequirement[];
  traderRequirements: TraderRequirement[];
  objectives: TaskObjective[];
  finishRewards: TaskRewards | null;
}

export interface CustomMapMarkerPin {
  left: number;
  top: number;
}

/** mapKey → taskId → posición en % sobre la imagen del mapa */
export type CustomMapMarkers = Record<string, Record<string, CustomMapMarkerPin>>;

export interface PlayerProgress {
  playerLevel: number;
  traderLevels: Record<string, number>;
  traderReputation: Record<string, number>;
  taskStates: Record<string, TaskProgressState>;
  /** taskId → objectiveIds marcados como hechos */
  completedObjectives: Record<string, string[]>;
  /** Posiciones de misión colocadas manualmente por el usuario */
  customMapMarkers?: CustomMapMarkers;
  updatedAt: string;
}

/**
 * Modos de personaje de EFT 1.1+.
 * - regular: PvP permanente (zona PvP)
 * - pve: PvE permanente
 * - seasonal: personaje de temporada (Kord Breach, etc.); progreso independiente
 */
export type GameMode = 'regular' | 'pve' | 'seasonal';

/** Todos los modos conocidos (incluye `pve` por compatibilidad con datos guardados). */
export const GAME_MODES: GameMode[] = ['regular', 'pve', 'seasonal'];

/** Modos seleccionables en la UI actual (sin PvE). */
export const SELECTABLE_GAME_MODES: GameMode[] = ['regular', 'seasonal'];

export const GAME_MODE_STORAGE_KEY = 'efg-game-mode';
export const DEFAULT_GAME_MODE: GameMode = 'regular';

/** Valor aceptado por la API de tarkov.dev (aún no expone `seasonal` como GameMode). */
export type ApiGameMode = 'regular' | 'pve';

/** Mapea el modo de la app al `gameMode` de tarkov.dev. */
export function toApiGameMode(mode: GameMode): ApiGameMode {
  return mode === 'pve' ? 'pve' : 'regular';
}

export const STORAGE_KEY = 'eft-quest-tracker-progress';
export const TASKS_CACHE_KEY = 'eft-quest-tracker-tasks-cache';
/** Incrementar al cambiar el esquema de datos cacheados (p. ej. zonas con posición), o para
 * invalidar de golpe cachés corruptos guardados por versiones anteriores (p. ej. una respuesta
 * parcial de la API de tarkov.dev con muy pocas misiones). */
export const TASKS_CACHE_SCHEMA = 4;

/** Clave de progreso local por modo (regular reutiliza la clave histórica sin sufijo). */
export function progressStorageKey(mode: GameMode): string {
  return mode === 'regular' ? STORAGE_KEY : `${STORAGE_KEY}:${mode}`;
}
/** Por debajo de este número de misiones, se asume que la respuesta de la API está incompleta
 * (caída parcial del servicio) y no se usa ni se guarda en caché. EFT tiene siempre varios
 * cientos de misiones, así que este umbral deja margen de sobra sin arriesgarse a aceptar datos
 * truncados. */
export const MIN_VALID_TASK_COUNT = 100;
