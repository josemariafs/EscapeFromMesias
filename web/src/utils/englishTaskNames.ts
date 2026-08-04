import { fetchTasks } from '../api/tarkov';
import type { GameMode, Task } from '../types';
import { TASKS_CACHE_SCHEMA, toApiGameMode } from '../types';
import {
  isCacheUsableFallback,
  isCacheValid,
  readTaskCache,
  writeTaskCache,
} from './taskCache';

/** Nombres en inglés para emparejar capturas del juego (siempre en EN). */
export async function loadEnglishTaskNames(
  gameMode: GameMode = 'regular',
): Promise<Map<string, string>> {
  const cached = await readTaskCache('en', gameMode);
  if (cached && isCacheValid(cached, 'en', gameMode)) {
    return new Map(cached.tasks.map((task) => [task.id, task.name]));
  }

  try {
    const data = await fetchTasks('en', gameMode);
    try {
      await writeTaskCache('en', gameMode, {
        schema: TASKS_CACHE_SCHEMA,
        lang: 'en',
        gameMode: toApiGameMode(gameMode),
        fetchedAt: new Date().toISOString(),
        tasks: data,
      });
    } catch {
      /* ignore */
    }
    return new Map(data.map((task) => [task.id, task.name]));
  } catch {
    if (cached && isCacheUsableFallback(cached, 'en', gameMode)) {
      return new Map(cached.tasks.map((task) => [task.id, task.name]));
    }
    throw new Error('Could not load English quest names');
  }
}

export function englishNamesFromTasks(tasks: Task[]): Map<string, string> {
  return new Map(tasks.map((task) => [task.id, task.name]));
}
