/** Tipos/constantes compartidos por handlers serverless (sin depender de src/). */

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

export type GameMode = 'regular' | 'pve' | 'seasonal';

export type JsonApiGameMode = 'regular' | 'pve' | 'pvp-season';

export function toJsonGameMode(mode: GameMode): JsonApiGameMode {
  if (mode === 'pve') return 'pve';
  if (mode === 'seasonal') return 'pvp-season';
  return 'regular';
}

/** Mantener alineado con src/types.ts */
export const TASKS_CACHE_SCHEMA = 9;
export const MIN_VALID_TASK_COUNT = 100;
