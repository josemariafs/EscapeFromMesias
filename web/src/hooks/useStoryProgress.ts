import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode, TaskProgressState } from '../types';
import type { StoryNodeFlat, StoryProgress } from '../types/storyline';
import { storyProgressStorageKey } from '../types/storyline';
import { flattenStoryNodes } from '../utils/storylineData';
import { recalculateStoryStates } from '../utils/storylineUnlock';

const defaultProgress = (): StoryProgress => ({
  nodeStates: {},
  updatedAt: new Date().toISOString(),
});

function readStoryProgress(mode: GameMode): StoryProgress {
  try {
    const raw = localStorage.getItem(storyProgressStorageKey(mode));
    if (raw) return JSON.parse(raw) as StoryProgress;
  } catch {
    /* ignore */
  }
  return defaultProgress();
}

export function useStoryProgress(gameMode: GameMode) {
  const nodes = useMemo(() => flattenStoryNodes(), []);
  const [progress, setProgress] = useState<StoryProgress>(() => readStoryProgress(gameMode));
  const suppressPersistRef = useRef(false);

  useEffect(() => {
    suppressPersistRef.current = true;
    setProgress(readStoryProgress(gameMode));
  }, [gameMode]);

  useEffect(() => {
    setProgress((prev) => ({
      ...prev,
      nodeStates: recalculateStoryStates(nodes, prev.nodeStates),
      updatedAt: new Date().toISOString(),
    }));
  }, [nodes]);

  useEffect(() => {
    if (suppressPersistRef.current) {
      suppressPersistRef.current = false;
      return;
    }
    localStorage.setItem(storyProgressStorageKey(gameMode), JSON.stringify(progress));
  }, [progress, gameMode]);

  const setNodeState = useCallback((nodeId: string, state: TaskProgressState) => {
    setProgress((prev) => {
      const nodeStates = { ...prev.nodeStates, [nodeId]: state };
      const next = { ...prev, nodeStates, updatedAt: new Date().toISOString() };
      return { ...next, nodeStates: recalculateStoryStates(nodes, next.nodeStates) };
    });
  }, [nodes]);

  const startNode = useCallback((nodeId: string) => setNodeState(nodeId, 'started'), [setNodeState]);
  const completeNode = useCallback((nodeId: string) => setNodeState(nodeId, 'completed'), [setNodeState]);
  const resetNode = useCallback((nodeId: string) => {
    setProgress((prev) => {
      const nodeStates = { ...prev.nodeStates };
      delete nodeStates[nodeId];
      const next = { ...prev, nodeStates, updatedAt: new Date().toISOString() };
      return { ...next, nodeStates: recalculateStoryStates(nodes, next.nodeStates) };
    });
  }, [nodes]);

  const getRequirementNames = useCallback((node: StoryNodeFlat): string[] => {
    return node.taskRequirements
      .map((r) => nodes.find((n) => n.id === r.task.id)?.name)
      .filter((name): name is string => Boolean(name));
  }, [nodes]);

  return {
    nodes,
    progress,
    startNode,
    completeNode,
    resetNode,
    getRequirementNames,
  };
}
