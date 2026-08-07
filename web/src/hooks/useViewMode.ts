export type ViewMode = 'table';

const STORAGE_KEY = 'efg-view-mode';

/** Vista fija en tabla (única visualización disponible). */
export function useViewMode() {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== 'table') {
      localStorage.setItem(STORAGE_KEY, 'table');
    }
  } catch {
    // ignore
  }

  return {
    viewMode: 'table' as const,
    setViewMode: (_mode: ViewMode) => {
      // no-op: solo existe la vista tabla
    },
    isCompact: false,
    isTable: true,
  };
}
