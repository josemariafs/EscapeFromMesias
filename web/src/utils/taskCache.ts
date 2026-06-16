import type { Lang } from '../i18n/translations';
import type { Task } from '../types';
import { TASKS_CACHE_KEY } from '../types';

const DB_NAME = 'eft-quest-tracker';
const STORE_NAME = 'tasks-cache';
const DB_VERSION = 1;

export const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

export interface CachedTasks {
  lang: Lang;
  fetchedAt: string;
  tasks: Task[];
}

function cacheId(lang: Lang) {
  return `${TASKS_CACHE_KEY}-${lang}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function idbSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function readTaskCache(lang: Lang): Promise<CachedTasks | null> {
  try {
    const db = await openDb();
    const cached = await idbGet<CachedTasks>(db, cacheId(lang));
    db.close();
    return cached ?? null;
  } catch {
    return null;
  }
}

export async function writeTaskCache(lang: Lang, payload: CachedTasks): Promise<void> {
  const db = await openDb();
  try {
    await idbSet(db, cacheId(lang), payload);
  } finally {
    db.close();
  }
}

export function isCacheValid(cached: CachedTasks, lang: Lang): boolean {
  if (cached.lang !== lang || cached.tasks.length === 0) return false;
  return Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS;
}

/** Elimina cachés antiguos en localStorage que superaban la cuota. */
export function purgeLegacyLocalStorageCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(TASKS_CACHE_KEY)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
