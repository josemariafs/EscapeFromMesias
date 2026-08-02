import { useCallback, useState } from 'react';
import type { TaskProgressState } from '../types';

const STORAGE_KEY = 'efg-logs-manual-overrides';

function readStoredOverrides(): Record<string, TaskProgressState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TaskProgressState>) : {};
  } catch {
    return {};
  }
}

function persistOverrides(overrides: Record<string, TaskProgressState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore storage errors (e.g. quota, privacy mode).
  }
}

/**
 * En modo Logs, la mayoría de misiones se rastrean automáticamente a partir de los eventos
 * detectados en los logs de Tarkov. Pero el juego solo conserva un número limitado de sesiones
 * recientes: cualquier misión iniciada/completada antes de esa ventana es invisible para los logs
 * actualmente disponibles. Este hook guarda un pequeño conjunto de "overrides" manuales,
 * usados ÚNICAMENTE como respaldo para misiones que no tienen ningún evento en los logs.
 */
export function useLogsOverrides() {
  const [overrides, setOverrides] = useState<Record<string, TaskProgressState>>(readStoredOverrides);

  const startOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: 'started' as TaskProgressState };
      persistOverrides(next);
      return next;
    });
  }, []);

  const completeOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: 'completed' as TaskProgressState };
      persistOverrides(next);
      return next;
    });
  }, []);

  const resetOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      persistOverrides(next);
      return next;
    });
  }, []);

  return { overrides, startOverride, completeOverride, resetOverride };
}
