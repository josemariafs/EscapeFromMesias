import { useCallback, useEffect, useState } from 'react';
import { fetchTasks } from '../api/tarkov';
import type { Lang } from '../i18n/translations';
import type { Task } from '../types';
import { englishNamesFromTasks, loadEnglishTaskNames } from '../utils/englishTaskNames';
import {
  isCacheValid,
  purgeLegacyLocalStorageCache,
  readTaskCache,
  writeTaskCache,
} from '../utils/taskCache';

export function useTasks(lang: Lang) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [englishNamesById, setEnglishNamesById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    try {
      purgeLegacyLocalStorageCache();

      if (!force) {
        const cached = await readTaskCache(lang);
        if (cached && isCacheValid(cached, lang)) {
          setTasks(cached.tasks);
          setLoading(false);
          return;
        }
      }

      const data = await fetchTasks(lang);
      setTasks(data);

      try {
        await writeTaskCache(lang, {
          lang,
          fetchedAt: new Date().toISOString(),
          tasks: data,
        });
      } catch {
        // La carga desde la API ya funcionó; ignorar fallos de caché.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (lang === 'en') {
      setEnglishNamesById(englishNamesFromTasks(tasks));
      return;
    }

    let cancelled = false;
    void loadEnglishTaskNames()
      .then((names) => {
        if (!cancelled) setEnglishNamesById(names);
      })
      .catch(() => {
        if (!cancelled) setEnglishNamesById(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [lang, tasks]);

  return { tasks, englishNamesById, loading, error, reload: () => load(true) };
}
