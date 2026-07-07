import {
  isApplicationLogFile,
  isNotificationsLogFile,
  isSessionFolderName,
  parseSessionFolderTimestamp,
} from './tarkovLogParser';

const DB_NAME = 'eft-tracker-fs';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const LOGS_DIR_KEY = 'tarkovLogsDir';

export function isLogSyncSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function pickTarkovLogsDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ id: 'eft-tracker-logs', mode: 'read' });
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLogsDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, LOGS_DIR_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadLogsDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDb();
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(LOGS_DIR_KEY);
    request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return handle;
}

export async function clearLogsDirHandle(): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(LOGS_DIR_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function queryReadPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  return handle.queryPermission({ mode: 'read' });
}

export function requestReadPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  return handle.requestPermission({ mode: 'read' });
}

export interface SessionFolderInfo {
  name: string;
  handle: FileSystemDirectoryHandle;
  timestamp: number;
}

/** Lista las carpetas de sesión (log_YYYY.MM.DD_H-mm-ss...) ordenadas de más antigua a más reciente. */
export async function listSessionFolders(root: FileSystemDirectoryHandle): Promise<SessionFolderInfo[]> {
  const folders: SessionFolderInfo[] = [];

  for await (const [name, handle] of root.entries()) {
    if (handle.kind !== 'directory' || !isSessionFolderName(name)) continue;
    const timestamp = parseSessionFolderTimestamp(name);
    if (timestamp == null) continue;
    folders.push({ name, handle: handle as FileSystemDirectoryHandle, timestamp });
  }

  folders.sort((a, b) => a.timestamp - b.timestamp);
  return folders;
}

/** Lee y concatena el contenido de los archivos de una carpeta de sesión que cumplan `matches`. */
async function readSessionLogText(
  folder: FileSystemDirectoryHandle,
  matches: (fileName: string) => boolean,
): Promise<string> {
  const fileNames: string[] = [];

  for await (const [name, handle] of folder.entries()) {
    if (handle.kind === 'file' && matches(name)) {
      fileNames.push(name);
    }
  }

  fileNames.sort();

  const chunks: string[] = [];
  for (const name of fileNames) {
    try {
      const fileHandle = await folder.getFileHandle(name);
      const file = await fileHandle.getFile();
      chunks.push(await file.text());
    } catch {
      /* archivo eliminado o inaccesible entre el listado y la lectura; se ignora */
    }
  }

  return chunks.join('\n');
}

/** Lee y concatena el contenido de los archivos notifications*.log de una carpeta de sesión. */
export function readSessionNotificationsText(folder: FileSystemDirectoryHandle): Promise<string> {
  return readSessionLogText(folder, isNotificationsLogFile);
}

/** Lee y concatena el contenido de los archivos application*.log de una carpeta de sesión. */
export function readSessionApplicationText(folder: FileSystemDirectoryHandle): Promise<string> {
  return readSessionLogText(folder, isApplicationLogFile);
}
