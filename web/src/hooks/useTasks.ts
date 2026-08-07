import { useCallback, useEffect, useState } from 'react';
import { fetchTasks } from '../api/tarkov';
import { fetchTasksFromJson } from '../api/tarkovJson';
import { loadBundledFallbackTasks } from '../data/tasksFallback';
import type { Lang } from '../i18n/translations';
import type { GameMode, Task } from '../types';
import { TASKS_CACHE_SCHEMA } from '../types';
import {
  isCacheUsableFallback,
  isCacheValid,
  purgeLegacyLocalStorageCache,
  readTaskCache,
  writeTaskCache,
} from '../utils/taskCache';

async function fetchTasksPreferLive(lang: Lang, gameMode: GameMode): Promise<{
  tasks: Task[];
  source: 'graphql' | 'json';
  graphqlError?: string;
}> {
  // Preferir JSON: incluye possibleLocations (marcadores de quest items) y pvp-season.
  // GraphQL a menudo está caído o incompleto para ubicaciones.
  try {
    const tasks = await fetchTasksFromJson(lang, gameMode);
    return { tasks, source: 'json' };
  } catch (jsonErr) {
    const jsonError = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
    if (gameMode === 'seasonal') {
      // GraphQL no expone Seasonal; no contaminar con Regular.
      throw jsonErr;
    }
    try {
      const tasks = await fetchTasks(lang, gameMode);
      return { tasks, source: 'graphql', graphqlError: jsonError };
    } catch (graphqlErr) {
      const graphqlError = graphqlErr instanceof Error ? graphqlErr.message : String(graphqlErr);
      throw new Error(`${jsonError} | GraphQL: ${graphqlError}`);
    }
  }
}

export function useTasks(lang: Lang, gameMode: GameMode) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** true si se está mostrando caché/snapshot porque ninguna API online respondió. */
  const [usingStaleCache, setUsingStaleCache] = useState(false);
  /** Motivo concreto del fallo de APIs online (si hubo fallback offline). */
  const [apiError, setApiError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    setApiError(null);
    setUsingStaleCache(false);

    try {
      purgeLegacyLocalStorageCache();

      const cached = await readTaskCache(lang, gameMode);

      if (!force && cached && isCacheValid(cached, lang, gameMode)) {
        setTasks(cached.tasks);
        setLoading(false);
        return;
      }

      try {
        const { tasks: data } = await fetchTasksPreferLive(lang, gameMode);
        setTasks(data);
        setUsingStaleCache(false);
        setApiError(null);

        try {
          await writeTaskCache(lang, gameMode, {
            schema: TASKS_CACHE_SCHEMA,
            lang,
            gameMode,
            fetchedAt: new Date().toISOString(),
            tasks: data,
          });
        } catch {
          // La carga online ya funcionó; ignorar fallos de caché.
        }
      } catch (apiErr) {
        const message = apiErr instanceof Error ? apiErr.message : String(apiErr);
        setApiError(message);
        // Orden de respaldo offline: caché IndexedDB → snapshot empaquetado.
        if (cached && isCacheUsableFallback(cached, lang, gameMode)) {
          setTasks(cached.tasks);
          setUsingStaleCache(true);
          setError(null);
        } else {
          const bundled = await loadBundledFallbackTasks(lang);
          setTasks(bundled);
          setUsingStaleCache(true);
          setError(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [lang, gameMode]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    tasks,
    loading,
    error,
    usingStaleCache,
    apiError,
    reload: () => load(true),
  };
}
