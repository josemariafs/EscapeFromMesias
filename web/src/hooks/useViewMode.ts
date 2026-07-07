import { useCallback, useState } from 'react';

export type ViewMode = 'normal' | 'compact' | 'table';

export const VIEW_MODE_STORAGE_KEY = 'efg-view-mode';

function readStoredViewMode(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === 'compact' || stored === 'table' ? stored : 'normal';
}

export function useViewMode() {
  const [viewMode, setViewModeState] = useState<ViewMode>(readStoredViewMode);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }, []);

  return {
    viewMode,
    setViewMode,
    isCompact: viewMode === 'compact',
    isTable: viewMode === 'table',
  };
}
