import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildTaskStatusMap,
  extractTaskEventsFromLogText,
  getLatestProfileSelectEvent,
  type ProfileSelectEvent,
  type TarkovLogTaskStatus,
} from '../utils/tarkovLogParser';
import {
  clearLogsDirHandle,
  isLogSyncSupported,
  listSessionFolders,
  loadLogsDirHandle,
  pickTarkovLogsDirectory,
  queryReadPermission,
  readSessionApplicationText,
  readSessionNotificationsText,
  requestReadPermission,
  saveLogsDirHandle,
  type SessionFolderInfo,
} from '../utils/tarkovLogsFs';

export type TarkovLogSyncStatus =
  | 'unsupported'
  | 'disconnected'
  | 'needs-permission'
  | 'connecting'
  | 'syncing'
  | 'error';

const POLL_INTERVAL_MS = 8000;
const WIPE_START_STORAGE_KEY = 'efg-log-wipe-start';

/** Selección especial: no filtrar por temporada, usar todo el historial disponible en los logs. */
export const WIPE_START_ALL = 'ALL';

/**
 * Marcador de error interno: la carpeta elegida no contiene ninguna subcarpeta de sesión
 * "log_AAAA.MM.DD_H-mm-ss…". Normalmente significa que se seleccionó la carpeta equivocada
 * (una carpeta padre, o una subcarpeta de sesión concreta en vez de la carpeta "Logs" en sí).
 * Se traduce a un mensaje localizado en la capa de UI (DataSourceControl).
 */
export const NO_SESSION_FOLDERS_ERROR = 'NO_SESSION_FOLDERS';

export interface WipeBreakpoint {
  /** Carpeta de sesión donde arranca este tramo (cambia la versión del cliente detectada). */
  session: string;
  timestamp: number;
  version: string;
  profileId: string;
}

function readStoredWipeStart(): string | null {
  return localStorage.getItem(WIPE_START_STORAGE_KEY);
}

/**
 * Recorre las sesiones en orden cronológico leyendo application.log y construye:
 * - la lista de "breakpoints" (puntos donde cambia la versión del cliente detectada), y
 * - el perfil/versión activo resuelto para cada sesión (heredando el último conocido).
 * OJO: no todo cambio de versión es un wipe real (los parches/hotfixes también la cambian);
 * por eso se ofrece la lista completa para que el usuario pueda elegir el punto correcto,
 * en vez de asumir que el último cambio de versión es siempre el inicio de temporada.
 */
async function scanWipeBreakpoints(
  folders: SessionFolderInfo[],
): Promise<{ breakpoints: WipeBreakpoint[]; resolvedProfiles: (ProfileSelectEvent | null)[] }> {
  const breakpoints: WipeBreakpoint[] = [];
  const resolvedProfiles: (ProfileSelectEvent | null)[] = new Array(folders.length).fill(null);
  let lastKnown: ProfileSelectEvent | null = null;

  for (let i = 0; i < folders.length; i++) {
    const text = await readSessionApplicationText(folders[i].handle);
    const event = getLatestProfileSelectEvent(text);
    if (event) {
      if (!lastKnown || event.version !== lastKnown.version || event.profileId !== lastKnown.profileId) {
        breakpoints.push({
          session: folders[i].name,
          timestamp: folders[i].timestamp,
          version: event.version,
          profileId: event.profileId,
        });
      }
      lastKnown = event;
    }
    resolvedProfiles[i] = lastKnown;
  }

  return { breakpoints, resolvedProfiles };
}

/**
 * Conecta con la carpeta Logs de Tarkov (File System Access API), reconstruye el historial
 * de misiones a partir del punto de inicio de temporada configurado (automático o elegido
 * manualmente entre los "breakpoints" de versión detectados), y sondea la sesión más
 * reciente periódicamente para reflejar eventos en vivo.
 */
export function useTarkovLogSync(enabled: boolean) {
  const [status, setStatus] = useState<TarkovLogSyncStatus>(() =>
    isLogSyncSupported() ? 'disconnected' : 'unsupported',
  );
  const [folderName, setFolderName] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [taskStatusMap, setTaskStatusMap] = useState<Record<string, TarkovLogTaskStatus>>({});
  /** Diagnóstico: nº de sesiones/eventos de la temporada actual y versión detectada. */
  const [sessionCount, setSessionCount] = useState(0);
  const [totalSessionCount, setTotalSessionCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [wipeVersion, setWipeVersion] = useState<string | null>(null);
  const [breakpoints, setBreakpoints] = useState<WipeBreakpoint[]>([]);
  const [wipeStartSelection, setWipeStartSelectionState] = useState<string | null>(() => readStoredWipeStart());
  const [resolvedWipeStartSession, setResolvedWipeStartSession] = useState<string | null>(null);

  const directoryRef = useRef<FileSystemDirectoryHandle | null>(null);
  const baseMapRef = useRef<Record<string, TarkovLogTaskStatus>>({});
  /** Total de eventos de misión ya consolidados en baseMapRef (sesiones que no son la más reciente). */
  const baseEventCountRef = useRef(0);
  const wipeSessionCountRef = useRef(0);
  const currentWipeRef = useRef<ProfileSelectEvent | null>(null);
  const wipeStartRef = useRef<string | null>(wipeStartSelection);
  const latestFolderRef = useRef<SessionFolderInfo | null>(null);
  const intervalRef = useRef<number | null>(null);
  const runIdRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollLatestFolder = useCallback(async (root: FileSystemDirectoryHandle, runId: number) => {
    try {
      const folders = await listSessionFolders(root);
      if (folders.length === 0) return;

      const latest = folders[folders.length - 1];
      const previousLatest = latestFolderRef.current;
      // El seguimiento dinámico de temporada (auto-reset al detectar nueva versión) solo
      // se aplica cuando el usuario no ha fijado manualmente un punto de inicio.
      const isAutoMode = !wipeStartRef.current;

      if (previousLatest && previousLatest.name !== latest.name) {
        let isNewWipe = false;
        if (isAutoMode) {
          const latestAppText = await readSessionApplicationText(latest.handle);
          const latestProfile = getLatestProfileSelectEvent(latestAppText);
          isNewWipe =
            latestProfile != null &&
            currentWipeRef.current != null &&
            (latestProfile.version !== currentWipeRef.current.version
              || latestProfile.profileId !== currentWipeRef.current.profileId);
          if (isNewWipe) currentWipeRef.current = latestProfile;
        }

        if (isNewWipe) {
          // Ha empezado un nuevo wipe mientras la app estaba conectada: se descarta el historial anterior.
          baseMapRef.current = {};
          baseEventCountRef.current = 0;
          wipeSessionCountRef.current = 1;
        } else {
          // La sesión previa dejó de ser la más reciente: se fija de forma permanente.
          const previousText = await readSessionNotificationsText(previousLatest.handle);
          const previousEvents = extractTaskEventsFromLogText(previousText);
          baseEventCountRef.current += previousEvents.length;
          baseMapRef.current = buildTaskStatusMap(previousEvents, baseMapRef.current);
          wipeSessionCountRef.current += 1;
        }
      }

      latestFolderRef.current = latest;
      const text = await readSessionNotificationsText(latest.handle);
      const events = extractTaskEventsFromLogText(text);
      const combined = buildTaskStatusMap(events, baseMapRef.current);

      if (runIdRef.current !== runId) return;
      setTaskStatusMap(combined);
      setSessionCount(wipeSessionCountRef.current);
      setTotalSessionCount(folders.length);
      setEventCount(baseEventCountRef.current + events.length);
      setWipeVersion(currentWipeRef.current?.version ?? null);
      setLastSyncedAt(new Date());
      setStatus('syncing');
      setErrorMessage(null);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const startSyncing = useCallback((root: FileSystemDirectoryHandle) => {
    const runId = ++runIdRef.current;
    directoryRef.current = root;
    baseMapRef.current = {};
    baseEventCountRef.current = 0;
    wipeSessionCountRef.current = 0;
    currentWipeRef.current = null;
    latestFolderRef.current = null;
    stopPolling();

    void (async () => {
      try {
        const folders = await listSessionFolders(root);
        if (folders.length === 0) {
          throw new Error(NO_SESSION_FOLDERS_ERROR);
        }
        const { breakpoints: bps, resolvedProfiles } = await scanWipeBreakpoints(folders);

        // Índice sugerido por defecto: el tramo de versión más reciente (heurística "auto").
        let boundaryIndex = 0;
        if (bps.length > 0) {
          const lastBp = bps[bps.length - 1];
          const idx = folders.findIndex((f) => f.name === lastBp.session);
          boundaryIndex = idx === -1 ? 0 : idx;
        }

        const selection = wipeStartRef.current;
        if (selection === WIPE_START_ALL) {
          boundaryIndex = 0;
        } else if (selection) {
          const idx = folders.findIndex((f) => f.name === selection);
          if (idx !== -1) boundaryIndex = idx;
        }

        currentWipeRef.current = resolvedProfiles[boundaryIndex]
          ?? resolvedProfiles[resolvedProfiles.length - 1]
          ?? null;

        const wipeFolders = folders.slice(boundaryIndex);

        // Todas las sesiones de la temporada actual salvo la más reciente se consolidan de forma permanente.
        for (let i = 0; i < wipeFolders.length - 1; i++) {
          const text = await readSessionNotificationsText(wipeFolders[i].handle);
          const events = extractTaskEventsFromLogText(text);
          baseEventCountRef.current += events.length;
          baseMapRef.current = buildTaskStatusMap(events, baseMapRef.current);
        }

        let latestEventCount = 0;
        let combined = baseMapRef.current;
        if (wipeFolders.length > 0) {
          const latest = wipeFolders[wipeFolders.length - 1];
          latestFolderRef.current = latest;
          const text = await readSessionNotificationsText(latest.handle);
          const events = extractTaskEventsFromLogText(text);
          latestEventCount = events.length;
          combined = buildTaskStatusMap(events, baseMapRef.current);
        }

        wipeSessionCountRef.current = wipeFolders.length;

        if (runIdRef.current !== runId) return;
        setBreakpoints(bps);
        setResolvedWipeStartSession(folders[boundaryIndex]?.name ?? null);
        setTaskStatusMap(combined);
        setSessionCount(wipeFolders.length);
        setTotalSessionCount(folders.length);
        setEventCount(baseEventCountRef.current + latestEventCount);
        setWipeVersion(currentWipeRef.current?.version ?? null);
        setLastSyncedAt(new Date());
        setStatus('syncing');
        setErrorMessage(null);
      } catch (err) {
        if (runIdRef.current !== runId) return;
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
        return;
      }

      intervalRef.current = window.setInterval(() => {
        void pollLatestFolder(root, runId);
      }, POLL_INTERVAL_MS);
    })();
  }, [pollLatestFolder, stopPolling]);

  const setWipeStart = useCallback((selection: string | null) => {
    wipeStartRef.current = selection;
    setWipeStartSelectionState(selection);
    if (selection == null) {
      localStorage.removeItem(WIPE_START_STORAGE_KEY);
    } else {
      localStorage.setItem(WIPE_START_STORAGE_KEY, selection);
    }
    if (directoryRef.current) {
      startSyncing(directoryRef.current);
    }
  }, [startSyncing]);

  const connect = useCallback(async () => {
    if (!isLogSyncSupported()) return;
    setStatus('connecting');
    setErrorMessage(null);
    try {
      const handle = await pickTarkovLogsDirectory();
      await saveLogsDirHandle(handle);
      setFolderName(handle.name);
      startSyncing(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('disconnected');
        return;
      }
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, [startSyncing]);

  const reconnect = useCallback(async () => {
    const handle = directoryRef.current ?? (await loadLogsDirHandle());
    if (!handle) {
      setStatus('disconnected');
      return;
    }
    setStatus('connecting');
    setErrorMessage(null);
    try {
      const permission = await requestReadPermission(handle);
      if (permission !== 'granted') {
        setStatus('needs-permission');
        return;
      }
      setFolderName(handle.name);
      startSyncing(handle);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, [startSyncing]);

  const disconnect = useCallback(async () => {
    runIdRef.current += 1;
    stopPolling();
    baseMapRef.current = {};
    baseEventCountRef.current = 0;
    wipeSessionCountRef.current = 0;
    currentWipeRef.current = null;
    latestFolderRef.current = null;
    directoryRef.current = null;
    setTaskStatusMap({});
    setFolderName(null);
    setLastSyncedAt(null);
    setErrorMessage(null);
    setSessionCount(0);
    setTotalSessionCount(0);
    setEventCount(0);
    setWipeVersion(null);
    setBreakpoints([]);
    setResolvedWipeStartSession(null);
    await clearLogsDirHandle();
    setStatus(isLogSyncSupported() ? 'disconnected' : 'unsupported');
  }, [stopPolling]);

  useEffect(() => {
    if (!enabled || !isLogSyncSupported()) {
      runIdRef.current += 1;
      stopPolling();
      return;
    }

    let cancelled = false;

    void (async () => {
      const handle = await loadLogsDirHandle();
      if (cancelled) return;
      if (!handle) {
        setStatus('disconnected');
        return;
      }
      const permission = await queryReadPermission(handle);
      if (cancelled) return;
      directoryRef.current = handle;
      setFolderName(handle.name);
      if (permission === 'granted') {
        startSyncing(handle);
      } else {
        setStatus('needs-permission');
      }
    })();

    return () => {
      cancelled = true;
      runIdRef.current += 1;
      stopPolling();
    };
    // startSyncing/stopPolling son estables (useCallback sin dependencias variables);
    // solo queremos re-ejecutar este efecto cuando cambia `enabled`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    status,
    folderName,
    lastSyncedAt,
    errorMessage,
    taskStatusMap,
    sessionCount,
    totalSessionCount,
    eventCount,
    wipeVersion,
    breakpoints,
    wipeStartSelection,
    resolvedWipeStartSession,
    setWipeStart,
    connect,
    reconnect,
    disconnect,
  };
}
