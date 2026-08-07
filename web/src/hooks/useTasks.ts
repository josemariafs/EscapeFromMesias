import { useCallback, useEffect, useState } from 'react';
import { fetchTasks } from '../api/tarkov';
import { loadBundledFallbackTasks } from '../data/tasksFallback';
import type { Lang } from '../i18n/translations';
import type { GameMode, Task } from '../types';
import { TASKS_CACHE_SCHEMA, toApiGameMode } from '../types';
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
  /** true si se está mostrando caché/snapshot porque la API no respondió. */
  const [usingStaleCache, setUsingStaleCache] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
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
        const data = await fetchTasks(lang, gameMode);
        setTasks(data);
        setUsingStaleCache(false);

        try {
          await writeTaskCache(lang, gameMode, {
            schema: TASKS_CACHE_SCHEMA,
            lang,
            gameMode: toApiGameMode(gameMode),
            fetchedAt: new Date().toISOString(),
            tasks: data,
          });
        } catch {
          // La carga desde la API ya funcionó; ignorar fallos de caché.
        }
      } catch {
        // Orden de respaldo: caché IndexedDB → snapshot empaquetado en la app.
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
    reload: () => load(true),
  };
}
