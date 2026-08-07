import type { Lang } from '../i18n/translations';
import type { Task } from '../types';

interface TasksFallbackFile {
  source: string;
  fetchedAt: string;
  note: string;
  lang: Lang;
  tasks: Task[];
}

/** Snapshot empaquetado (origen SPT) para cuando api.tarkov.dev no responde. */
export async function loadBundledFallbackTasks(lang: Lang): Promise<Task[]> {
  const mod = lang === 'en'
    ? await import('./tasks-fallback-en.json')
    : await import('./tasks-fallback-es.json');
  const data = mod.default as TasksFallbackFile;
  return data.tasks;
}
