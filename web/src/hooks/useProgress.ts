import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerProgress, Task, TaskProgressState } from '../types';
import { STORAGE_KEY } from '../types';
import { recalculateStates } from '../utils/unlock';

const defaultProgress = (): PlayerProgress => ({
  playerLevel: 1,
  traderLevels: {},
  traderReputation: {},
  taskStates: {},
  updatedAt: new Date().toISOString(),
});

export function useProgress(tasks: Task[]) {
  const [progress, setProgress] = useState<PlayerProgress>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as PlayerProgress;
    } catch {
      /* ignore */
    }
    return defaultProgress();
  });

  useEffect(() => {
    if (tasks.length === 0) return;
    setProgress((prev) => ({
      ...prev,
      taskStates: recalculateStates(tasks, prev),
      updatedAt: new Date().toISOString(),
    }));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

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
      const next = { ...prev, taskStates, updatedAt: new Date().toISOString() };
      return { ...next, taskStates: recalculateStates(tasks, next) };
    });
  }, [tasks]);

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
    startTask,
    completeTask,
    resetTask,
  };
}
