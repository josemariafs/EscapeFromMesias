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

/** Input webkitdirectory vivo: Firefox invalida los File si se desmonta antes de leerlos. */
let retainedFileInput: HTMLInputElement | null = null;

export function releaseLogsFileInput(): void {
  retainedFileInput?.remove();
  retainedFileInput = null;
}

function retainFileInput(input: HTMLInputElement): void {
  if (retainedFileInput === input) return;
  releaseLogsFileInput();
  retainedFileInput = input;
}

function relativePathParts(file: File): string[] {
  const rel = (file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
  return rel.split('/').filter(Boolean);
}

function fileBaseName(file: File): string {
  const parts = relativePathParts(file);
  return parts[parts.length - 1] || file.name;
}

function readFileWithFileReader(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('FileReader did not return ArrayBuffer'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsArrayBuffer(file);
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    try {
      const buffer = await file.arrayBuffer();
      if (buffer.byteLength > 0 || file.size === 0) return buffer;
    } catch {
      /* FileReader: más fiable en Firefox con webkitdirectory */
    }
  }
  return readFileWithFileReader(file);
}

function decodeLogBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  const sample = bytes.subarray(0, Math.min(64, bytes.length));
  let nuls = 0;
  for (let i = 1; i < sample.length; i += 2) {
    if (sample[i] === 0) nuls += 1;
  }
  if (sample.length >= 8 && nuls >= sample.length / 4) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

async function readFileAsText(file: File): Promise<string> {
  try {
    return decodeLogBuffer(await readFileAsArrayBuffer(file));
  } catch {
    try {
      return await file.text();
    } catch {
      return '';
    }
  }
}

/** Arranca la lectura de todos los archivos en este turno (crítico en Firefox). */
function readMatchingFilesText(
  files: File[],
  matches: (fileName: string) => boolean,
): Promise<string> {
  const matching = files
    .filter((f) => matches(fileBaseName(f)))
    .sort((a, b) => fileBaseName(a).localeCompare(fileBaseName(b)));
  return Promise.all(matching.map((file) => readFileAsText(file))).then((chunks) =>
    chunks.filter(Boolean).join('\n'),
  );
}

function groupFilesBySession(files: File[]): Map<string, File[]> {
  const bySession = new Map<string, File[]>();
  for (const file of files) {
    const sessionName = relativePathParts(file).find((part) => isSessionFolderName(part));
    if (!sessionName) continue;
    const list = bySession.get(sessionName);
    if (list) list.push(file);
    else bySession.set(sessionName, [file]);
  }
  return bySession;
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
  const folders: SessionFolderInfo[] = [];
  for (const [name, sessionFiles] of groupFilesBySession(files)) {
    const timestamp = parseSessionFolderTimestamp(name);
    if (timestamp == null) continue;
    folders.push(sessionFromFiles(name, sessionFiles, timestamp));
  }
  folders.sort((a, b) => a.timestamp - b.timestamp);
  return folders;
}

/**
 * Copia application.log y notifications.log a memoria en el mismo gesto del selector.
 * Firefox suele vaciar los File de webkitdirectory si se leen más tarde o tras quitar el input.
 */
export async function materializeFileListLogsDirectory(files: File[]): Promise<LogsDirectory> {
  const firstRel = (files[0]?.webkitRelativePath || files[0]?.name || '').replace(/\\/g, '/');
  const rootName = firstRel.split('/').filter(Boolean)[0] || 'Logs';
  const jobs = [...groupFilesBySession(files).entries()].flatMap(([name, sessionFiles]) => {
    const timestamp = parseSessionFolderTimestamp(name);
    if (timestamp == null) return [];
    return [{
      name,
      timestamp,
      notifications: readMatchingFilesText(sessionFiles, isNotificationsLogFile),
      application: readMatchingFilesText(sessionFiles, isApplicationLogFile),
    }];
  });

  const folders: SessionFolderInfo[] = [];
  for (const job of jobs) {
    const [notificationsText, applicationText] = await Promise.all([
      job.notifications,
      job.application,
    ]);
    folders.push({
      name: job.name,
      timestamp: job.timestamp,
      readNotificationsText: async () => notificationsText,
      readApplicationText: async () => applicationText,
    });
  }
  folders.sort((a, b) => a.timestamp - b.timestamp);

  return {
    name: rootName,
    canPoll: false,
    listSessionFolders: async () => folders,
    queryReadPermission: async () => 'granted',
    ensureReadPermission: async () => 'granted',
  };
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
 * Importante (Firefox):
 * - Al elegir carpeta el foco vuelve a la ventana *antes* de disparar `change`.
 * - Los File del input se invalidan si se desmonta o si se leen muchos ticks después.
 *   Hay que arrancar la lectura en el propio gesto y dejar el input montado.
 */
export function pickLogsDirectoryViaInput(): Promise<LogsDirectory> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    // Firefox es más fiable con el input montado en el DOM.
    input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
    document.body.appendChild(input);

    let settled = false;
    let cancelTimer: number | null = null;

    const cleanupListeners = () => {
      if (cancelTimer != null) {
        window.clearTimeout(cancelTimer);
        cancelTimer = null;
      }
      window.removeEventListener('focus', onWindowFocus);
    };

    const settle = (fn: () => void, removeInput: boolean) => {
      if (settled) return;
      settled = true;
      cleanupListeners();
      if (removeInput) input.remove();
      fn();
    };

    const onPicked = () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return false;
      // Arranca arrayBuffer/FileReader en este turno, con el input aún vivo.
      const directoryPromise = materializeFileListLogsDirectory(files);
      settle(() => {
        retainFileInput(input);
        void directoryPromise.then(resolve, reject);
      }, false);
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
          settle(
            () => reject(new DOMException('The user aborted a request.', 'AbortError')),
            true,
          );
          return;
        }
        cancelTimer = window.setTimeout(poll, 200);
      };
      cancelTimer = window.setTimeout(poll, 250);
    };

    input.addEventListener('change', () => {
      if (!onPicked()) {
        settle(
          () => reject(new DOMException('The user aborted a request.', 'AbortError')),
          true,
        );
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
