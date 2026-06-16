import { fetchTasks } from '../api/tarkov';
import type { Task } from '../types';
import { isCacheValid, readTaskCache, writeTaskCache } from './taskCache';

/** Nombres en inglés para emparejar capturas del juego (siempre en EN). */
export async function loadEnglishTaskNames(): Promise<Map<string, string>> {
  const cached = await readTaskCache('en');
  if (cached && isCacheValid(cached, 'en')) {
    return new Map(cached.tasks.map((task) => [task.id, task.name]));
  }

  const data = await fetchTasks('en');
  try {
    await writeTaskCache('en', {
      lang: 'en',
      fetchedAt: new Date().toISOString(),
      tasks: data,
    });
  } catch {
    /* ignore */
  }

  return new Map(data.map((task) => [task.id, task.name]));
}

export function englishNamesFromTasks(tasks: Task[]): Map<string, string> {
  return new Map(tasks.map((task) => [task.id, task.name]));
}
