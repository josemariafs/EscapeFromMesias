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
import { buildImportStateUpdate } from '../utils/taskImport';
import { DEFAULT_TRADER_LOYALTY, recalculateStates } from '../utils/unlock';

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
    setProgress((prev) => ({
      ...prev,
      taskStates: recalculateStates(tasks, prev),
      updatedAt: new Date().toISOString(),
    }));
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
      const traderLevels = {
        ...prev.traderLevels,
        [traderId]: Math.max(1, Math.min(4, Math.round(level) || DEFAULT_TRADER_LOYALTY)),
      };
      const next = { ...prev, traderLevels, updatedAt: new Date().toISOString() };
      return { ...next, taskStates: recalculateStates(tasks, next) };
    });
  }, [tasks]);

  const setTaskState = useCallback((taskId: string, state: TaskProgressState) => {
    setProgress((prev) => {
      const taskStates = { ...prev.taskStates, [taskId]: state };
      const next = { ...prev, taskStates, updatedAt: new Date().toISOString() };
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
      const next = {
        ...prev,
        taskStates,
        completedObjectives,
        customMapMarkers,
        updatedAt: new Date().toISOString(),
      };
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

  const importActiveTasks = useCallback((activeTaskIds: string[]) => {
    if (activeTaskIds.length === 0) return;

    setProgress((prev) => {
      const { activeIds, completedIds } = buildImportStateUpdate(tasks, activeTaskIds);
      const taskStates = { ...prev.taskStates };

      for (const id of completedIds) {
        taskStates[id] = 'completed';
      }
      for (const id of activeIds) {
        taskStates[id] = 'started';
      }

      const next = { ...prev, taskStates, updatedAt: new Date().toISOString() };
      return { ...next, taskStates: recalculateStates(tasks, next) };
    });
  }, [tasks]);

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
    startTask,
    completeTask,
    resetTask,
    importActiveTasks,
    toggleObjective,
    setCustomMapMarker,
    clearCustomMapMarker,
  };
}
