import type { Lang } from '../i18n/translations';
import type { GameMode, Task } from '../types';

interface TasksFallbackFile {
  source: string;
  fetchedAt: string;
  note: string;
  lang: Lang;
  gameMode?: GameMode;
  tasks: Task[];
}

/**
 * Snapshot empaquetado para cuando las APIs online no responden.
 * Seasonal usa el dump de json.tarkov.dev/pvp-season (Kord Breach);
 * Regular/PvE el snapshot general.
 */
export async function loadBundledFallbackTasks(
  lang: Lang,
  gameMode: GameMode = 'regular',
): Promise<Task[]> {
  if (gameMode === 'seasonal') {
    const mod = lang === 'en'
      ? await import('./tasks-fallback-seasonal-en.json')
      : await import('./tasks-fallback-seasonal-es.json');
    const data = mod.default as TasksFallbackFile;
    return data.tasks;
  }

  const mod = lang === 'en'
    ? await import('./tasks-fallback-en.json')
    : await import('./tasks-fallback-es.json');
  const data = mod.default as TasksFallbackFile;
  return data.tasks;
}
