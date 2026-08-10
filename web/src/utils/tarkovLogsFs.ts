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

/** Carpeta de sesión con lectura de logs (independiente del backend del navegador). */
export interface SessionFolderInfo {
  name: string;
  timestamp: number;
  readNotificationsText: () => Promise<string>;
  readApplicationText: () => Promise<string>;
}

/**
 * Raíz de logs (carpeta "Logs" de Tarkov).
 * - Chromium/Edge: File System Access API (persistencia + sondeo en vivo).
 * - Firefox/Safari: input webkitdirectory (instantánea; hay que volver a elegir para refrescar).
 */
export interface LogsDirectory {
  name: string;
  canPoll: boolean;
  listSessionFolders: () => Promise<SessionFolderInfo[]>;
  ensureReadPermission: () => Promise<PermissionState>;
  queryReadPermission: () => Promise<PermissionState>;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export function isWebkitDirectorySupported(): boolean {
  if (typeof document === 'undefined') return false;
  const input = document.createElement('input');
  return 'webkitdirectory' in input;
}

export function isLogSyncSupported(): boolean {
  return isFileSystemAccessSupported() || isWebkitDirectorySupported();
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

async function pickDirectoryHandle(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ id: 'eft-tracker-logs', mode: 'read' });
}

/** Lee y concatena archivos de una carpeta FS Access que cumplan `matches`. */
async function readSessionLogTextFromHandle(
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

function sessionFromHandle(
  name: string,
  handle: FileSystemDirectoryHandle,
  timestamp: number,
): SessionFolderInfo {
  return {
    name,
    timestamp,
    readNotificationsText: () => readSessionLogTextFromHandle(handle, isNotificationsLogFile),
    readApplicationText: () => readSessionLogTextFromHandle(handle, isApplicationLogFile),
  };
}

async function listSessionFoldersFromHandle(
  root: FileSystemDirectoryHandle,
): Promise<SessionFolderInfo[]> {
  const folders: SessionFolderInfo[] = [];

  for await (const [name, handle] of root.entries()) {
    if (handle.kind !== 'directory' || !isSessionFolderName(name)) continue;
    const timestamp = parseSessionFolderTimestamp(name);
    if (timestamp == null) continue;
    folders.push(sessionFromHandle(name, handle as FileSystemDirectoryHandle, timestamp));
  }

  folders.sort((a, b) => a.timestamp - b.timestamp);
  return folders;
}

export function createHandleLogsDirectory(handle: FileSystemDirectoryHandle): LogsDirectory {
  return {
    name: handle.name,
    canPoll: true,
    listSessionFolders: () => listSessionFoldersFromHandle(handle),
    queryReadPermission: () => handle.queryPermission({ mode: 'read' }),
    ensureReadPermission: () => handle.requestPermission({ mode: 'read' }),
  };
}

function relativePathParts(file: File): string[] {
  const rel = (file.webkitRelativePath || '').replace(/\\/g, '/');
  if (rel) return rel.split('/').filter(Boolean);
  return file.name ? [file.name] : [];
}

function fileBaseName(file: File): string {
  const parts = relativePathParts(file);
  return parts[parts.length - 1] || file.name;
}

async function readMatchingFilesText(
  files: File[],
  matches: (fileName: string) => boolean,
): Promise<string> {
  const matching = files
    .filter((f) => matches(fileBaseName(f)))
    .sort((a, b) => fileBaseName(a).localeCompare(fileBaseName(b)));

  const chunks: string[] = [];
  for (const file of matching) {
    try {
      chunks.push(await file.text());
    } catch {
      /* ignorar archivos ilegibles */
    }
  }
  return chunks.join('\n');
}

function sessionFromFiles(name: string, files: File[], timestamp: number): SessionFolderInfo {
  return {
    name,
    timestamp,
    readNotificationsText: () => readMatchingFilesText(files, isNotificationsLogFile),
    readApplicationText: () => readMatchingFilesText(files, isApplicationLogFile),
  };
}

/** Agrupa archivos de un input webkitdirectory en carpetas de sesión Tarkov. */
export function buildSessionsFromFileList(files: File[]): SessionFolderInfo[] {
  const bySession = new Map<string, File[]>();

  for (const file of files) {
    const parts = relativePathParts(file);
    const sessionName = parts.find((part) => isSessionFolderName(part));
    if (!sessionName) continue;
    const list = bySession.get(sessionName);
    if (list) list.push(file);
    else bySession.set(sessionName, [file]);
  }

  const folders: SessionFolderInfo[] = [];
  for (const [name, sessionFiles] of bySession) {
    const timestamp = parseSessionFolderTimestamp(name);
    if (timestamp == null) continue;
    folders.push(sessionFromFiles(name, sessionFiles, timestamp));
  }

  folders.sort((a, b) => a.timestamp - b.timestamp);
  return folders;
}

export function createFileListLogsDirectory(rootName: string, files: File[]): LogsDirectory {
  const sessions = buildSessionsFromFileList(files);
  return {
    name: rootName,
    canPoll: false,
    listSessionFolders: async () => sessions,
    queryReadPermission: async () => 'granted',
    ensureReadPermission: async () => 'granted',
  };
}

/**
 * Abre el selector de carpeta nativo vía &lt;input webkitdirectory&gt;.
 * Compatible con Firefox (y Safari). No permite sondeo en vivo ni recordar la carpeta.
 *
 * Importante (Firefox): al elegir carpeta el foco vuelve a la ventana *antes* de
 * disparar `change`. Un timeout corto en `focus` abortaba la selección y dejaba
 * la UI en "conectar carpeta" aunque el usuario sí hubiera elegido Logs.
 */
export function pickLogsDirectoryViaInput(): Promise<LogsDirectory> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    // Firefox es más fiable con el input montado en el DOM.
    input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
    document.body.appendChild(input);

    let settled = false;
    let cancelTimer: number | null = null;

    const cleanup = () => {
      if (cancelTimer != null) {
        window.clearTimeout(cancelTimer);
        cancelTimer = null;
      }
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onPicked = () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return false;
      const firstRel = (files[0]?.webkitRelativePath || files[0]?.name || '').replace(/\\/g, '/');
      const rootName = firstRel.split('/').filter(Boolean)[0] || 'Logs';
      settle(() => resolve(createFileListLogsDirectory(rootName, files)));
      return true;
    };

    const onWindowFocus = () => {
      // Firefox restaura el foco antes de rellenar `input.files` / disparar `change`.
      // Sondeamos un rato; solo si sigue vacío asumimos cancelación.
      if (cancelTimer != null) window.clearTimeout(cancelTimer);
      const startedAt = Date.now();
      const poll = () => {
        if (settled) return;
        if (onPicked()) return;
        if (Date.now() - startedAt >= 12_000) {
          settle(() => reject(new DOMException('The user aborted a request.', 'AbortError')));
          return;
        }
        cancelTimer = window.setTimeout(poll, 200);
      };
      cancelTimer = window.setTimeout(poll, 250);
    };

    input.addEventListener('change', () => {
      if (!onPicked()) {
        settle(() => reject(new DOMException('The user aborted a request.', 'AbortError')));
      }
    });
    input.addEventListener('input', () => {
      void onPicked();
    });
    window.addEventListener('focus', onWindowFocus);
    // Deja que el click síncrono del gesto del usuario abra el diálogo.
    input.click();
  });
}

/** Elige la carpeta Logs con el mejor método disponible en el navegador. */
export async function pickLogsDirectory(): Promise<LogsDirectory> {
  if (isFileSystemAccessSupported()) {
    const handle = await pickDirectoryHandle();
    await saveLogsDirHandle(handle);
    return createHandleLogsDirectory(handle);
  }
  if (isWebkitDirectorySupported()) {
    return pickLogsDirectoryViaInput();
  }
  throw new Error('Log folder access is not supported in this browser');
}

/** Intenta restaurar una carpeta persistida (solo File System Access / Chromium). */
export async function tryRestoreLogsDirectory(): Promise<LogsDirectory | null> {
  if (!isFileSystemAccessSupported()) return null;
  const handle = await loadLogsDirHandle();
  if (!handle) return null;
  return createHandleLogsDirectory(handle);
}
