import { useCallback, useEffect, useState } from 'react';
import type { GameMode, TaskProgressState } from '../types';

const BASE_STORAGE_KEY = 'efg-logs-manual-overrides';

function overridesStorageKey(mode: GameMode): string {
  return mode === 'regular' ? BASE_STORAGE_KEY : `${BASE_STORAGE_KEY}:${mode}`;
}

function readStoredOverrides(mode: GameMode): Record<string, TaskProgressState> {
  try {
    const raw = localStorage.getItem(overridesStorageKey(mode));
    return raw ? (JSON.parse(raw) as Record<string, TaskProgressState>) : {};
  } catch {
    return {};
  }
}

function persistOverrides(mode: GameMode, overrides: Record<string, TaskProgressState>) {
  try {
    localStorage.setItem(overridesStorageKey(mode), JSON.stringify(overrides));
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
export function useLogsOverrides(gameMode: GameMode) {
  const [overrides, setOverrides] = useState<Record<string, TaskProgressState>>(
    () => readStoredOverrides(gameMode),
  );

  useEffect(() => {
    setOverrides(readStoredOverrides(gameMode));
  }, [gameMode]);

  const startOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: 'started' as TaskProgressState };
      persistOverrides(gameMode, next);
      return next;
    });
  }, [gameMode]);

  const completeOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: 'completed' as TaskProgressState };
      persistOverrides(gameMode, next);
      return next;
    });
  }, [gameMode]);

  const resetOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      persistOverrides(gameMode, next);
      return next;
    });
  }, [gameMode]);

  return { overrides, startOverride, completeOverride, resetOverride };
}
