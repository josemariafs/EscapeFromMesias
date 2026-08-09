import type { Lang } from '../i18n/translations';
import type { GameMode, Task } from '../types';

export interface SiteTasksResponse {
  tasks: Task[];
  fetchedAt: string;
  updatedAt?: string;
  source: string;
  taskCount: number;
  schemaVersion?: number;
  gameMode: GameMode;
  lang: Lang;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return res.statusText || 'Request failed';
  }
}

/** Lee misiones desde nuestra API/Turso (sincronizadas diariamente desde tarkov.dev). */
export async function fetchTasksFromSite(
  lang: Lang,
  gameMode: GameMode,
): Promise<SiteTasksResponse> {
  const params = new URLSearchParams({ lang, gameMode });
  const res = await fetch(`/api/tasks?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = (await res.json()) as SiteTasksResponse;
  if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
    throw new Error('La API local devolvió una lista de misiones vacía.');
  }
  return data;
}
