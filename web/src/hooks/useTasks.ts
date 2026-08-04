import { useCallback, useEffect, useState } from 'react';
import { fetchTasks } from '../api/tarkov';
import type { Lang } from '../i18n/translations';
import type { GameMode, Task } from '../types';
import { TASKS_CACHE_SCHEMA, toApiGameMode } from '../types';
import { englishNamesFromTasks, loadEnglishTaskNames } from '../utils/englishTaskNames';
import {
  isCacheUsableFallback,
  isCacheValid,
  purgeLegacyLocalStorageCache,
  readTaskCache,
  writeTaskCache,
} from '../utils/taskCache';

export function useTasks(lang: Lang, gameMode: GameMode) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [englishNamesById, setEnglishNamesById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** true si se está mostrando caché porque la API no respondió. */
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
      } catch (apiErr) {
        // Si tarkov.dev está caído, preferir cualquier caché usable a una pantalla de error.
        if (cached && isCacheUsableFallback(cached, lang, gameMode)) {
          setTasks(cached.tasks);
          setUsingStaleCache(true);
          setError(null);
        } else {
          throw apiErr;
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

  useEffect(() => {
    if (lang === 'en') {
      setEnglishNamesById(englishNamesFromTasks(tasks));
      return;
    }

    let cancelled = false;
    void loadEnglishTaskNames(gameMode)
      .then((names) => {
        if (!cancelled) setEnglishNamesById(names);
      })
      .catch(() => {
        if (!cancelled) setEnglishNamesById(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [lang, tasks, gameMode]);

  return {
    tasks,
    englishNamesById,
    loading,
    error,
    usingStaleCache,
    reload: () => load(true),
  };
}
