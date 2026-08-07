import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CustomMapMarkerPin,
  CustomMapMarkers,
  GameMode,
  PlayerProgress,
  Task,
  TaskProgressState,
} from '../types';
import { progressStorageKey } from '../types';
import {
  DEFAULT_TRADER_LOYALTY,
  inferPlayerLevel,
  inferTraderLoyaltyLevels,
  raisePlayerLevelToInferred,
  raiseTraderLevelsToInferred,
  recalculateStates,
} from '../utils/unlock';

function withInferredTraderLevels(
  progress: PlayerProgress,
  tasks: Task[],
  taskStates: Record<string, TaskProgressState> = progress.taskStates,
): PlayerProgress {
  const inferred = inferTraderLoyaltyLevels(tasks, taskStates);
  const { traderLevels, changed } = raiseTraderLevelsToInferred(progress.traderLevels, inferred);
  if (!changed) return progress;
  return {
    ...progress,
    traderLevels,
    updatedAt: new Date().toISOString(),
  };
}

const defaultProgress = (): PlayerProgress => ({
  playerLevel: 1,
  traderLevels: {},
  traderReputation: {},
  taskStates: {},
  completedObjectives: {},
  customMapMarkers: {},
  updatedAt: new Date().toISOString(),
});

function normalizeProgress(raw: PlayerProgress): PlayerProgress {
  return {
    ...raw,
    traderLevels: raw.traderLevels ?? {},
    traderReputation: raw.traderReputation ?? {},
    completedObjectives: raw.completedObjectives ?? {},
    customMapMarkers: raw.customMapMarkers ?? {},
  };
}

function readProgress(mode: GameMode): PlayerProgress {
  try {
    const raw = localStorage.getItem(progressStorageKey(mode));
    if (raw) return normalizeProgress(JSON.parse(raw) as PlayerProgress);
  } catch {
    /* ignore */
  }
  return defaultProgress();
}

export function useProgress(tasks: Task[], gameMode: GameMode) {
  const [progress, setProgress] = useState<PlayerProgress>(() => readProgress(gameMode));
  const suppressPersistRef = useRef(false);

  // Al cambiar de modo (PvP / PvE / Seasonal), cargar su progreso aislado.
  useEffect(() => {
    suppressPersistRef.current = true;
    setProgress(readProgress(gameMode));
  }, [gameMode]);

  useEffect(() => {
    if (tasks.length === 0) return;
    setProgress((prev) => {
      const withStates = {
        ...prev,
        taskStates: recalculateStates(tasks, prev),
        updatedAt: new Date().toISOString(),
      };
      const withLl = withInferredTraderLevels(withStates, tasks);
      if (withLl === withStates) return withStates;
      return {
        ...withLl,
        taskStates: recalculateStates(tasks, withLl),
      };
    });
  }, [tasks]);

  useEffect(() => {
    // Tras un cambio de modo, el primer pass aún tiene el progreso anterior en memoria:
    // se omite ese write para no contaminar la clave del modo nuevo.
    if (suppressPersistRef.current) {
      suppressPersistRef.current = false;
      return;
    }
    localStorage.setItem(progressStorageKey(gameMode), JSON.stringify(progress));
  }, [progress, gameMode]);

  const setPlayerLevel = useCallback((level: number) => {
    setProgress((prev) => {
      const next = {
        ...prev,
        playerLevel: Math.max(0, Math.min(79, level)),
        updatedAt: new Date().toISOString(),
      };
      return { ...next, taskStates: recalculateStates(tasks, next) };
    });
  }, [tasks]);

  const setTraderLevel = useCallback((traderId: string, level: number) => {
    setProgress((prev) => {
      const inferred = inferTraderLoyaltyLevels(tasks, prev.taskStates);
      const floor = inferred[traderId] ?? DEFAULT_TRADER_LOYALTY;
      const traderLevels = {
        ...prev.traderLevels,
        [traderId]: Math.max(
          floor,
          Math.max(1, Math.min(4, Math.round(level) || DEFAULT_TRADER_LOYALTY)),
        ),
      };
      const next = { ...prev, traderLevels, updatedAt: new Date().toISOString() };
      return { ...next, taskStates: recalculateStates(tasks, next) };
    });
  }, [tasks]);

  /** Sube LL según misiones started/completed (p. ej. estados efectivos del modo Logs). */
  const syncTraderLevelsFromTaskStates = useCallback((
    taskStates: Record<string, TaskProgressState>,
  ) => {
    if (tasks.length === 0) return;
    setProgress((prev) => {
      const raised = withInferredTraderLevels(prev, tasks, taskStates);
      if (raised === prev) return prev;
      return {
        ...raised,
        taskStates: recalculateStates(tasks, raised),
      };
    });
  }, [tasks]);

  /** Sube nivel PJ según minPlayerLevel de misiones started/completed (modo Logs). */
  const syncPlayerLevelFromTaskStates = useCallback((
    taskStates: Record<string, TaskProgressState>,
  ) => {
    if (tasks.length === 0) return;
    setProgress((prev) => {
      const inferred = inferPlayerLevel(tasks, taskStates);
      const { playerLevel, changed } = raisePlayerLevelToInferred(prev.playerLevel, inferred);
      if (!changed) return prev;
      const next = {
        ...prev,
        playerLevel,
        updatedAt: new Date().toISOString(),
      };
      return { ...next, taskStates: recalculateStates(tasks, next) };
    });
  }, [tasks]);

  const setTaskState = useCallback((taskId: string, state: TaskProgressState) => {
    setProgress((prev) => {
      const taskStates = { ...prev.taskStates, [taskId]: state };
      let next = { ...prev, taskStates, updatedAt: new Date().toISOString() };
      next = withInferredTraderLevels(next, tasks);
      return { ...next, taskStates: recalculateStates(tasks, next) };
    });
  }, [tasks]);

  const startTask = useCallback((taskId: string) => setTaskState(taskId, 'started'), [setTaskState]);
  const completeTask = useCallback((taskId: string) => setTaskState(taskId, 'completed'), [setTaskState]);
  const resetTask = useCallback((taskId: string) => {
    setProgress((prev) => {
      const taskStates = { ...prev.taskStates };
      delete taskStates[taskId];
      const completedObjectives = { ...prev.completedObjectives };
      delete completedObjectives[taskId];
      const customMapMarkers = { ...prev.customMapMarkers };
      for (const mapKey of Object.keys(customMapMarkers)) {
        if (customMapMarkers[mapKey]?.[taskId]) {
          const nextMap = { ...customMapMarkers[mapKey] };
          delete nextMap[taskId];
          if (Object.keys(nextMap).length === 0) {
            delete customMapMarkers[mapKey];
          } else {
            customMapMarkers[mapKey] = nextMap;
          }
        }
      }
      let next: PlayerProgress = {
        ...prev,
        taskStates,
        completedObjectives,
        customMapMarkers,
        updatedAt: new Date().toISOString(),
      };
      next = withInferredTraderLevels(next, tasks);
      return { ...next, taskStates: recalculateStates(tasks, next) };
    });
  }, [tasks]);

  const toggleObjective = useCallback((taskId: string, objectiveId: string) => {
    setProgress((prev) => {
      const current = new Set(prev.completedObjectives[taskId] ?? []);
      if (current.has(objectiveId)) {
        current.delete(objectiveId);
      } else {
        current.add(objectiveId);
      }

      return {
        ...prev,
        completedObjectives: {
          ...prev.completedObjectives,
          [taskId]: [...current],
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const setCustomMapMarker = useCallback((
    mapKey: string,
    taskId: string,
    pin: CustomMapMarkerPin,
  ) => {
    setProgress((prev) => ({
      ...prev,
      customMapMarkers: {
        ...prev.customMapMarkers,
        [mapKey]: {
          ...prev.customMapMarkers?.[mapKey],
          [taskId]: pin,
        },
      },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const clearCustomMapMarker = useCallback((mapKey: string, taskId: string) => {
    setProgress((prev) => {
      const mapPins = prev.customMapMarkers?.[mapKey];
      if (!mapPins?.[taskId]) return prev;

      const nextMap = { ...mapPins };
      delete nextMap[taskId];
      const customMapMarkers = { ...prev.customMapMarkers } as CustomMapMarkers;
      if (Object.keys(nextMap).length === 0) {
        delete customMapMarkers[mapKey];
      } else {
        customMapMarkers[mapKey] = nextMap;
      }

      return {
        ...prev,
        customMapMarkers,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const traders = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const task of tasks) {
      map.set(task.trader.id, { id: task.trader.id, name: task.trader.name });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  return {
    progress,
    traders,
    setPlayerLevel,
    setTraderLevel,
    syncTraderLevelsFromTaskStates,
    syncPlayerLevelFromTaskStates,
    startTask,
    completeTask,
    resetTask,
    toggleObjective,
    setCustomMapMarker,
    clearCustomMapMarker,
  };
}
