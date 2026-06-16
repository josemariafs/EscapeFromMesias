import { useCallback, useState } from 'react';

export type ViewMode = 'normal' | 'compact';

export const VIEW_MODE_STORAGE_KEY = 'efg-view-mode';

export function useViewMode() {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'compact' ? 'compact' : 'normal';
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }, []);

  return {
    viewMode,
    setViewMode,
    isCompact: viewMode === 'compact',
  };
}
