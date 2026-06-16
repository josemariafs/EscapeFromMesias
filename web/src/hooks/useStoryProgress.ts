import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskProgressState } from '../types';
import type { StoryNodeFlat, StoryProgress } from '../types/storyline';
import { STORY_STORAGE_KEY } from '../types/storyline';
import { flattenStoryNodes } from '../utils/storylineData';
import { recalculateStoryStates } from '../utils/storylineUnlock';

const defaultProgress = (): StoryProgress => ({
  nodeStates: {},
  updatedAt: new Date().toISOString(),
});

export function useStoryProgress() {
  const nodes = useMemo(() => flattenStoryNodes(), []);

  const [progress, setProgress] = useState<StoryProgress>(() => {
    try {
      const raw = localStorage.getItem(STORY_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as StoryProgress;
    } catch {
      /* ignore */
    }
    return defaultProgress();
  });

  useEffect(() => {
    setProgress((prev) => ({
      ...prev,
      nodeStates: recalculateStoryStates(nodes, prev.nodeStates),
      updatedAt: new Date().toISOString(),
    }));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

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
