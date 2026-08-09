import { useCallback, useEffect, useState } from 'react';
import { fetchTasksFromSite } from '../api/siteTasks';
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

export function useTasks(lang: Lang, gameMode: GameMode) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** true si se está mostrando caché/snapshot porque la API local no respondió. */
  const [usingStaleCache, setUsingStaleCache] = useState(false);
  /** Motivo concreto del fallo de la API local (si hubo fallback offline). */
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
        // Fuente principal: snapshot en nuestro servidor (cron diario desde tarkov.dev).
        const data = await fetchTasksFromSite(lang, gameMode);
        setTasks(data.tasks);
        setUsingStaleCache(false);
        setApiError(null);

        try {
          await writeTaskCache(lang, gameMode, {
            schema: TASKS_CACHE_SCHEMA,
            lang,
            gameMode,
            fetchedAt: data.fetchedAt || new Date().toISOString(),
            tasks: data.tasks,
          });
        } catch {
          // La carga online ya funcionó; ignorar fallos de caché.
        }
      } catch (apiErr) {
        const message = apiErr instanceof Error ? apiErr.message : String(apiErr);
        setApiError(message);
        // Respaldo: IndexedDB → snapshot empaquetado (nunca tarkov.dev en el cliente).
        if (cached && isCacheUsableFallback(cached, lang, gameMode)) {
          setTasks(cached.tasks);
          setUsingStaleCache(true);
          setError(null);
        } else {
          const bundled = await loadBundledFallbackTasks(lang, gameMode);
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
