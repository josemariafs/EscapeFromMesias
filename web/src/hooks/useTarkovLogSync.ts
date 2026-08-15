import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameMode } from '../types';
import {
  autoBindLatestProfile,
  modeHasProfile,
  profileMatchesMode,
  readLogProfileModes,
  setLogProfileMode,
  toLogProfileMode,
  type LogProfileGameMode,
} from '../utils/logProfileModes';
import {
  buildTaskStatusMap,
  clientVersionFamily,
  extractTaskEventsFromLogText,
  getLatestProfileSelectEvent,
  type ProfileSelectEvent,
  type TarkovLogTaskStatus,
} from '../utils/tarkovLogParser';
import {
  clearLogsDirHandle,
  isLogSyncSupported,
  pickLogsDirectory,
  releaseLogsFileInput,
  tryRestoreLogsDirectory,
  type LogsDirectory,
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

export interface LogProfileInfo {
  profileId: string;
  accountId: string;
  lastVersion: string;
  lastSeenAt: number;
  mode: LogProfileGameMode | null;
}

function readStoredWipeStart(): string | null {
  return localStorage.getItem(WIPE_START_STORAGE_KEY);
}

/**
 * Recorre las sesiones en orden cronológico leyendo application.log y construye:
 * - la lista de "breakpoints" (puntos donde cambia la familia major.minor del cliente
 *   o el ProfileId), y
 * - el perfil/versión activo resuelto para cada sesión (heredando el último conocido).
 *
 * Parches como `1.1.0.0` y `1.1.0.1` se agrupan en `1.1` (misma temporada / sesión lógica).
 * El usuario sigue pudiendo elegir el punto de inicio; el automático usa la última familia.
 */
async function scanWipeBreakpoints(
  folders: SessionFolderInfo[],
): Promise<{ breakpoints: WipeBreakpoint[]; resolvedProfiles: (ProfileSelectEvent | null)[] }> {
  const breakpoints: WipeBreakpoint[] = [];
  const resolvedProfiles: (ProfileSelectEvent | null)[] = new Array(folders.length).fill(null);
  let lastKnown: ProfileSelectEvent | null = null;

  for (let i = 0; i < folders.length; i++) {
    const text = await folders[i].readApplicationText();
    const event = getLatestProfileSelectEvent(text);
    if (event) {
      const family = clientVersionFamily(event.version);
      const lastFamily = lastKnown ? clientVersionFamily(lastKnown.version) : null;
      if (!lastKnown || family !== lastFamily || event.profileId !== lastKnown.profileId) {
        breakpoints.push({
          session: folders[i].name,
          timestamp: folders[i].timestamp,
          version: family,
          profileId: event.profileId,
        });
      }
      lastKnown = event;
    }
    resolvedProfiles[i] = lastKnown;
  }

  return { breakpoints, resolvedProfiles };
}

function collectProfileInfos(
  folders: SessionFolderInfo[],
  resolvedProfiles: (ProfileSelectEvent | null)[],
  modes: Record<string, LogProfileGameMode>,
): LogProfileInfo[] {
  const byId = new Map<string, LogProfileInfo>();
  for (let i = 0; i < folders.length; i++) {
    const profile = resolvedProfiles[i];
    if (!profile) continue;
    const prev = byId.get(profile.profileId);
    if (!prev || folders[i].timestamp >= prev.lastSeenAt) {
      byId.set(profile.profileId, {
        profileId: profile.profileId,
        accountId: profile.accountId,
        lastVersion: profile.version,
        lastSeenAt: folders[i].timestamp,
        mode: modes[profile.profileId] ?? null,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

function sessionMatchesMode(
  profile: ProfileSelectEvent | null,
  mode: LogProfileGameMode,
  modes: Record<string, LogProfileGameMode>,
): boolean {
  return profileMatchesMode(profile?.profileId, mode, modes);
}

/**
 * Conecta con la carpeta Logs de Tarkov (File System Access en Chromium, o selección
 * webkitdirectory en Firefox), reconstruye el historial de misiones a partir del punto
 * de inicio de temporada configurado, y —si el backend lo permite— sondea la sesión más
 * reciente periódicamente para reflejar eventos en vivo.
 *
 * Filtra por ProfileId según el modo activo (PVP Regular vs Seasonal).
 */
export function useTarkovLogSync(enabled: boolean, gameMode: GameMode) {
  const logMode = toLogProfileMode(gameMode);
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
  /** Sesiones cuyo notifications.log se pudo leer (aunque no tenga eventos de misión). */
  const [readableNotificationLogs, setReadableNotificationLogs] = useState(0);
  const [wipeVersion, setWipeVersion] = useState<string | null>(null);
  const [breakpoints, setBreakpoints] = useState<WipeBreakpoint[]>([]);
  const [wipeStartSelection, setWipeStartSelectionState] = useState<string | null>(() => readStoredWipeStart());
  const [resolvedWipeStartSession, setResolvedWipeStartSession] = useState<string | null>(null);
  /** false en Firefox: la carpeta es una instantánea; hay que volver a elegirla para refrescar. */
  const [canLivePoll, setCanLivePoll] = useState(false);
  const [profileModes, setProfileModes] = useState<Record<string, LogProfileGameMode>>(() =>
    readLogProfileModes(),
  );
  const [knownProfiles, setKnownProfiles] = useState<LogProfileInfo[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const directoryRef = useRef<LogsDirectory | null>(null);
  const baseMapRef = useRef<Record<string, TarkovLogTaskStatus>>({});
  /** Total de eventos de misión ya consolidados en baseMapRef (sesiones que no son la más reciente). */
  const baseEventCountRef = useRef(0);
  const wipeSessionCountRef = useRef(0);
  const currentWipeRef = useRef<ProfileSelectEvent | null>(null);
  const wipeStartRef = useRef<string | null>(wipeStartSelection);
  const latestFolderRef = useRef<SessionFolderInfo | null>(null);
  const modeFoldersRef = useRef<SessionFolderInfo[]>([]);
  const resolvedProfilesRef = useRef<(ProfileSelectEvent | null)[]>([]);
  const foldersRef = useRef<SessionFolderInfo[]>([]);
  const logModeRef = useRef(logMode);
  const profileModesRef = useRef(profileModes);
  const intervalRef = useRef<number | null>(null);
  const runIdRef = useRef(0);

  logModeRef.current = logMode;
  profileModesRef.current = profileModes;

  const stopPolling = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollLatestFolder = useCallback(async (root: LogsDirectory, runId: number) => {
    try {
      const folders = await root.listSessionFolders();
      if (folders.length === 0) return;

      const mode = logModeRef.current;
      const modes = profileModesRef.current;
      const { resolvedProfiles } = await scanWipeBreakpoints(folders);
      foldersRef.current = folders;
      resolvedProfilesRef.current = resolvedProfiles;

      const modeIndices: number[] = [];
      for (let i = 0; i < folders.length; i++) {
        if (sessionMatchesMode(resolvedProfiles[i], mode, modes)) {
          modeIndices.push(i);
        }
      }

      // Mantener el corte de wipe del sync inicial (o el elegido manualmente).
      let startAt = 0;
      if (wipeStartRef.current === WIPE_START_ALL) {
        startAt = 0;
      } else if (wipeStartRef.current) {
        const idx = modeIndices.findIndex((i) => folders[i].name === wipeStartRef.current);
        startAt = idx === -1 ? 0 : idx;
      } else if (modeFoldersRef.current[0]) {
        const idx = modeIndices.findIndex((i) => folders[i].name === modeFoldersRef.current[0].name);
        startAt = idx === -1 ? 0 : idx;
      }

      const wipeModeIndices = modeIndices.slice(startAt);
      const wipeFolders = wipeModeIndices.map((i) => folders[i]);
      modeFoldersRef.current = wipeFolders;

      if (wipeFolders.length === 0) {
        if (runIdRef.current !== runId) return;
        baseMapRef.current = {};
        baseEventCountRef.current = 0;
        wipeSessionCountRef.current = 0;
        latestFolderRef.current = null;
        setTaskStatusMap({});
        setSessionCount(0);
        setTotalSessionCount(folders.length);
        setEventCount(0);
        setReadableNotificationLogs(0);
        setLastSyncedAt(new Date());
        setStatus('syncing');
        setErrorMessage(null);
        setKnownProfiles(collectProfileInfos(folders, resolvedProfiles, modes));
        return;
      }

      const previousLatest = latestFolderRef.current;
      const latest = wipeFolders[wipeFolders.length - 1];
      const latestAbsIndex = wipeModeIndices[wipeModeIndices.length - 1];
      const latestProfile = resolvedProfiles[latestAbsIndex];

      if (previousLatest && previousLatest.name !== latest.name) {
        // Nueva sesión del modo activo: consolidar la anterior si seguía en la ventana.
        const prevStillInWindow = wipeFolders.some((f) => f.name === previousLatest.name);
        if (prevStillInWindow) {
          const previousText = await previousLatest.readNotificationsText();
          const previousEvents = extractTaskEventsFromLogText(previousText);
          baseEventCountRef.current += previousEvents.length;
          baseMapRef.current = buildTaskStatusMap(previousEvents, baseMapRef.current);
        } else {
          // Cambio de perfil/wipe del modo: reconstruir base desde cero (salvo la última).
          baseMapRef.current = {};
          baseEventCountRef.current = 0;
          for (let i = 0; i < wipeFolders.length - 1; i++) {
            const text = await wipeFolders[i].readNotificationsText();
            const events = extractTaskEventsFromLogText(text);
            baseEventCountRef.current += events.length;
            baseMapRef.current = buildTaskStatusMap(events, baseMapRef.current);
          }
        }
        wipeSessionCountRef.current = wipeFolders.length;
        if (latestProfile) currentWipeRef.current = latestProfile;
      }

      latestFolderRef.current = latest;
      const text = await latest.readNotificationsText();
      const events = extractTaskEventsFromLogText(text);
      const combined = buildTaskStatusMap(events, baseMapRef.current);

      if (runIdRef.current !== runId) return;
      setTaskStatusMap(combined);
      setSessionCount(wipeFolders.length);
      setTotalSessionCount(folders.length);
      setEventCount(baseEventCountRef.current + events.length);
      setWipeVersion(currentWipeRef.current?.version ?? latestProfile?.version ?? null);
      setActiveProfileId(latestProfile?.profileId ?? null);
      setKnownProfiles(collectProfileInfos(folders, resolvedProfiles, modes));
      setLastSyncedAt(new Date());
      setStatus('syncing');
      setErrorMessage(null);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const startSyncing = useCallback((root: LogsDirectory) => {
    const runId = ++runIdRef.current;
    directoryRef.current = root;
    setCanLivePoll(root.canPoll);
    setReadableNotificationLogs(0);
    baseMapRef.current = {};
    baseEventCountRef.current = 0;
    wipeSessionCountRef.current = 0;
    currentWipeRef.current = null;
    latestFolderRef.current = null;
    modeFoldersRef.current = [];
    stopPolling();

    void (async () => {
      try {
        const folders = await root.listSessionFolders();
        if (folders.length === 0) {
          throw new Error(NO_SESSION_FOLDERS_ERROR);
        }
        const { breakpoints: allBps, resolvedProfiles } = await scanWipeBreakpoints(folders);
        foldersRef.current = folders;
        resolvedProfilesRef.current = resolvedProfiles;

        const mode = logModeRef.current;
        let modes = readLogProfileModes();
        const latestAny = resolvedProfiles[resolvedProfiles.length - 1];
        modes = autoBindLatestProfile(latestAny?.profileId, mode, modes);
        profileModesRef.current = modes;
        setProfileModes(modes);

        const modeIndices: number[] = [];
        for (let i = 0; i < folders.length; i++) {
          if (sessionMatchesMode(resolvedProfiles[i], mode, modes)) {
            modeIndices.push(i);
          }
        }

        const modeBreakpoints = allBps.filter((bp) =>
          profileMatchesMode(bp.profileId, mode, modes),
        );

        // Índice sugerido por defecto: el tramo de versión más reciente del modo.
        let boundaryPos = 0;
        if (modeBreakpoints.length > 0) {
          const lastBp = modeBreakpoints[modeBreakpoints.length - 1];
          const idx = modeIndices.findIndex((i) => folders[i].name === lastBp.session);
          boundaryPos = idx === -1 ? 0 : idx;
        }

        const selection = wipeStartRef.current;
        if (selection === WIPE_START_ALL) {
          boundaryPos = 0;
        } else if (selection) {
          const idx = modeIndices.findIndex((i) => folders[i].name === selection);
          if (idx !== -1) boundaryPos = idx;
        }

        const wipeModeIndices = modeIndices.slice(boundaryPos);
        const wipeFolders = wipeModeIndices.map((i) => folders[i]);
        modeFoldersRef.current = wipeFolders;

        const boundaryAbs = wipeModeIndices[0] ?? modeIndices[0] ?? 0;
        currentWipeRef.current = resolvedProfiles[boundaryAbs]
          ?? resolvedProfiles[resolvedProfiles.length - 1]
          ?? null;

        let readableNotif = 0;
        for (let i = 0; i < wipeFolders.length - 1; i++) {
          const text = await wipeFolders[i].readNotificationsText();
          if (text.trim()) readableNotif += 1;
          const events = extractTaskEventsFromLogText(text);
          baseEventCountRef.current += events.length;
          baseMapRef.current = buildTaskStatusMap(events, baseMapRef.current);
        }

        let latestEventCount = 0;
        let combined = baseMapRef.current;
        let latestProfileId: string | null = null;
        if (wipeFolders.length > 0) {
          const latest = wipeFolders[wipeFolders.length - 1];
          latestFolderRef.current = latest;
          const text = await latest.readNotificationsText();
          if (text.trim()) readableNotif += 1;
          const events = extractTaskEventsFromLogText(text);
          latestEventCount = events.length;
          combined = buildTaskStatusMap(events, baseMapRef.current);
          const abs = wipeModeIndices[wipeModeIndices.length - 1];
          latestProfileId = resolvedProfiles[abs]?.profileId ?? null;
        }

        wipeSessionCountRef.current = wipeFolders.length;

        if (runIdRef.current !== runId) return;
        setBreakpoints(modeBreakpoints);
        setResolvedWipeStartSession(wipeFolders[0]?.name ?? null);
        setTaskStatusMap(combined);
        setSessionCount(wipeFolders.length);
        setTotalSessionCount(folders.length);
        setEventCount(baseEventCountRef.current + latestEventCount);
        setReadableNotificationLogs(readableNotif);
        setWipeVersion(currentWipeRef.current?.version ?? null);
        setActiveProfileId(latestProfileId);
        setKnownProfiles(collectProfileInfos(folders, resolvedProfiles, modes));
        setLastSyncedAt(new Date());
        setStatus('syncing');
        setErrorMessage(null);
      } catch (err) {
        if (runIdRef.current !== runId) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus('error');
        setErrorMessage(message);
        if (message === NO_SESSION_FOLDERS_ERROR) {
          directoryRef.current = null;
          setFolderName(null);
          setCanLivePoll(false);
          void clearLogsDirHandle();
        }
        return;
      }

      if (root.canPoll) {
        intervalRef.current = window.setInterval(() => {
          void pollLatestFolder(root, runId);
        }, POLL_INTERVAL_MS);
      }
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

  const assignProfileMode = useCallback((profileId: string, mode: LogProfileGameMode | null) => {
    const next = setLogProfileMode(profileId, mode, profileModesRef.current);
    profileModesRef.current = next;
    setProfileModes(next);
    setKnownProfiles((prev) =>
      prev.map((p) => (p.profileId === profileId ? { ...p, mode } : p)),
    );
    if (directoryRef.current) {
      startSyncing(directoryRef.current);
    }
  }, [startSyncing]);

  const connect = useCallback(async () => {
    if (!isLogSyncSupported()) return;
    setStatus('connecting');
    setErrorMessage(null);
    try {
      const directory = await pickLogsDirectory();
      setFolderName(directory.name);
      startSyncing(directory);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus(directoryRef.current ? 'syncing' : 'disconnected');
        return;
      }
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, [startSyncing]);

  const reconnect = useCallback(async () => {
    const directory = directoryRef.current;
    if (!directory) {
      await connect();
      return;
    }
    if (directory.canPoll) {
      setStatus('connecting');
      setErrorMessage(null);
      try {
        const permission = await directory.ensureReadPermission();
        if (permission !== 'granted') {
          setStatus('needs-permission');
          return;
        }
        setFolderName(directory.name);
        startSyncing(directory);
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    // Firefox / sin carpeta en memoria: hay que volver a elegir la carpeta.
    await connect();
  }, [connect, startSyncing]);

  const disconnect = useCallback(async () => {
    runIdRef.current += 1;
    stopPolling();
    baseMapRef.current = {};
    baseEventCountRef.current = 0;
    wipeSessionCountRef.current = 0;
    currentWipeRef.current = null;
    latestFolderRef.current = null;
    modeFoldersRef.current = [];
    directoryRef.current = null;
    setCanLivePoll(false);
    setTaskStatusMap({});
    setFolderName(null);
    setLastSyncedAt(null);
    setErrorMessage(null);
    setSessionCount(0);
    setTotalSessionCount(0);
    setEventCount(0);
    setReadableNotificationLogs(0);
    setWipeVersion(null);
    setBreakpoints([]);
    setResolvedWipeStartSession(null);
    setKnownProfiles([]);
    setActiveProfileId(null);
    await clearLogsDirHandle();
    releaseLogsFileInput();
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
      const directory = await tryRestoreLogsDirectory();
      if (cancelled) return;
      if (!directory) {
        setStatus('disconnected');
        return;
      }
      const permission = await directory.queryReadPermission();
      if (cancelled) return;
      directoryRef.current = directory;
      setFolderName(directory.name);
      setCanLivePoll(directory.canPoll);
      if (permission === 'granted') {
        startSyncing(directory);
      } else {
        setStatus('needs-permission');
      }
    })();

    return () => {
      cancelled = true;
      runIdRef.current += 1;
      stopPolling();
    };
    // Re-sincroniza al activar Logs o al cambiar Regular ↔ Seasonal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, logMode]);

  return {
    status,
    folderName,
    lastSyncedAt,
    errorMessage,
    taskStatusMap,
    sessionCount,
    totalSessionCount,
    eventCount,
    readableNotificationLogs,
    wipeVersion,
    breakpoints,
    wipeStartSelection,
    resolvedWipeStartSession,
    canLivePoll,
    knownProfiles,
    profileModes,
    activeProfileId,
    logMode,
    modeHasAssignedProfile: modeHasProfile(profileModes, logMode),
    setWipeStart,
    assignProfileMode,
    connect,
    reconnect,
    disconnect,
  };
}
