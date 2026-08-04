import type { GameMode, TaskProgressState } from '../types';

export type Lang = 'es' | 'en';

export const LANG_STORAGE_KEY = 'eft-quest-tracker-lang';

export interface Translations {
  appTitle: string;
  subtitle: (n: number) => string;
  loading: string;
  loadError: string;
  retry: string;
  incompleteTasksTitle: string;
  incompleteTasksBody: (count: number) => string;
  staleCacheNotice: string;
  statAvailable: (n: number) => string;
  statStarted: (n: number) => string;
  statCompleted: (n: number) => string;
  statLocked: (n: number) => string;
  searchPlaceholder: string;
  allTraders: string;
  allStatuses: string;
  statusAvailable: string;
  statusStarted: string;
  statusCompleted: string;
  statusLocked: string;
  playerLevel: string;
  gameMode: string;
  gameModeLabel: Record<GameMode, string>;
  gameModeHint: Record<GameMode, string>;
  settings: string;
  traderLevels: string;
  traderLevelsHint: string;
  loyaltyShort: (n: number) => string;
  exportProgress: string;
  importProgress: string;
  refreshTasks: string;
  resetAll: string;
  progressCopied: string;
  pasteProgress: string;
  invalidJson: string;
  confirmReset: string;
  wipeAll: string;
  confirmWipeAll: string;
  importScreenshot: string;
  importScreenshotHint: string;
  importScreenshotProcessing: string;
  importScreenshotResult: (n: number) => string;
  importScreenshotNoMatch: string;
  importScreenshotNoImage: string;
  importScreenshotError: string;
  noTasksFilter: string;
  noActiveTasks: string;
  selectTask: string;
  tabAll: string;
  tabActive: string;
  tabStory: string;
  tabSideQuest: string;
  allChapters: string;
  searchStoryPlaceholder: string;
  selectStoryNode: string;
  storyNodeKind: string;
  storyItems: string;
  storyNodeType: Record<'default' | 'optional' | 'choice', string>;
  storyApiTasksTitle: string;
  storyLightkeeperTitle: string;
  language: string;
  viewMode: string;
  viewModeNormal: string;
  viewModeCompact: string;
  viewModeTable: string;
  tableColName: string;
  tableColTrader: string;
  tableColMap: string;
  tableColItems: string;
  tableColActions: string;
  tableSectionActive: string;
  tableSectionAvailable: string;
  tableSectionCompleted: string;
  tableSectionLocked: (n: number) => string;
  tableNoTasks: string;
  kappa: string;
  requires: string;
  levelShort: (n: number) => string;
  start: string;
  complete: string;
  reset: string;
  markStarted: string;
  markCompleted: string;
  resetProgress: string;
  lockedHint: string;
  minLevel: string;
  faction: string;
  kappaRequired: string;
  viewWiki: string;
  prevQuests: string;
  traderReqs: string;
  requiredKeys: string;
  objectives: string;
  objectiveDone: string;
  objectivePending: string;
  rewards: string;
  reputation: string;
  level: string;
  optional: string;
  anyMap: string;
  anyItem: string;
  activeByMap: (n: number) => string;
  viewMap: string;
  viewMapOnTarkovDev: string;
  mapMarkersTitle: (n: number) => string;
  mapMarkersNoLocation: (n: number) => string;
  mapPlaceSelectHint: string;
  mapPlaceClickHint: string;
  mapPlaceBanner: (taskName: string) => string;
  mapPlaceCancel: string;
  mapMarkerManual: string;
  mapClearCustomMarker: string;
  close: string;
  dataSource: string;
  dataSourceLocal: string;
  dataSourceLogs: string;
  dataSourceLogsUnsupportedTitle: string;
  logsConnect: string;
  logsReconnect: string;
  logsChangeFolder: string;
  logsDisconnect: string;
  logsConnecting: string;
  logsNeedsPermission: string;
  logsSyncedAt: (time: string) => string;
  logsErrorPrefix: string;
  logsNoSessionsFoundError: string;
  logsRetry: string;
  logsReadOnlyNotice: string;
  logsPathHint: string;
  logsStats: (sessions: number, totalSessions: number, tasks: number, version: string | null) => string;
  logsNoEventsHint: string;
  logStateDetected: (state: string) => string;
  logStateNotDetectedEditable: string;
  logLockedHint: string;
  logsUnmatchedIds: (n: number) => string;
  logsWipeStartTitle: string;
  logsWipeStartAuto: string;
  logsWipeStartAll: string;
  logsWipeStartOption: (date: string, version: string) => string;
  logsWipeStartAutoTag: string;
  state: Record<TaskProgressState, string>;
}

export const translations: Record<Lang, Translations> = {
  es: {
    appTitle: 'Escape From Gorditos',
    subtitle: (n) => `Tracker de misiones · ${n} quests · datos de tarkov.dev`,
    loading: 'Cargando misiones desde tarkov.dev…',
    loadError: 'Error al cargar',
    retry: 'Reintentar',
    incompleteTasksTitle: 'Lista de misiones incompleta',
    incompleteTasksBody: (count) =>
      `La API de tarkov.dev ha devuelto solo ${count} misión(es) en vez de las varias centenas habituales. `
      + 'Esto es un problema temporal del servicio de tarkov.dev (o de tu conexión con él), no del lector de logs '
      + 'ni de tus misiones: con una lista tan incompleta, ninguna misión detectada en los logs (ni en modo Local) '
      + 'puede emparejarse correctamente, así que no se muestra nada. Reintenta en un momento.',
    staleCacheNotice:
      'tarkov.dev no responde: mostrando misiones en caché (pueden no estar al día con EFT 1.1). Reintenta más tarde.',
    statAvailable: (n) => `${n} disponibles`,
    statStarted: (n) => `${n} en curso`,
    statCompleted: (n) => `${n} completadas`,
    statLocked: (n) => `${n} bloqueadas`,
    searchPlaceholder: 'Buscar misión o comerciante…',
    allTraders: 'Todos los comerciantes',
    allStatuses: 'Todos los estados',
    statusAvailable: 'Disponibles',
    statusStarted: 'En curso',
    statusCompleted: 'Completadas',
    statusLocked: 'Bloqueadas',
    playerLevel: 'Nivel PJ',
    gameMode: 'Modo de juego',
    gameModeLabel: {
      regular: 'PvP',
      pve: 'PvE',
      seasonal: 'Seasonal',
    },
    gameModeHint: {
      regular: 'Personaje permanente de la zona PvP',
      pve: 'Personaje permanente de la zona PvE',
      seasonal: 'Personaje de temporada (progreso independiente; se resetea con cada temporada)',
    },
    settings: 'Ajustes',
    traderLevels: 'Loyalty Level de comerciantes',
    traderLevelsHint:
      'En EFT 1.1 las side quests se desbloquean por Loyalty Level (LL). Ajusta el LL de cada comerciante para ver qué misiones tienes disponibles.',
    loyaltyShort: (n) => `LL${n}`,
    exportProgress: 'Exportar progreso',
    importProgress: 'Importar progreso',
    refreshTasks: 'Actualizar misiones',
    resetAll: 'Resetear todo',
    progressCopied: 'Progreso copiado al portapapeles',
    pasteProgress: 'Pega el JSON de progreso exportado:',
    invalidJson: 'JSON inválido',
    confirmReset: '¿Borrar todo el progreso?',
    wipeAll: 'Wipe All',
    confirmWipeAll:
      'Se borrarán todos los datos guardados en el navegador (progreso de misiones, campaña Story, idioma, etc.). Esta acción no se puede deshacer.\n\n¿Continuar?',
    importScreenshot: 'Importar activas',
    importScreenshotHint: 'Pega la captura (Ctrl+V)',
    importScreenshotProcessing: 'Leyendo captura…',
    importScreenshotResult: (n) => `${n} misión${n === 1 ? '' : 'es'} marcada${n === 1 ? '' : 's'} en curso`,
    importScreenshotNoMatch: 'No se encontraron misiones en la imagen',
    importScreenshotNoImage: 'No hay imagen en el portapapeles',
    importScreenshotError: 'No se pudo leer la imagen',
    noTasksFilter: 'No hay misiones con estos filtros.',
    noActiveTasks: 'No tienes misiones en curso.',
    selectTask: 'Selecciona una misión para ver los detalles',
    tabAll: 'Todas',
    tabActive: 'Activas',
    tabStory: 'Story',
    tabSideQuest: 'Side Quest',
    allChapters: 'Todos los capítulos',
    searchStoryPlaceholder: 'Buscar objetivo o capítulo…',
    selectStoryNode: 'Selecciona un objetivo de la campaña Story',
    storyNodeKind: 'Tipo',
    storyItems: 'Objetivos / ítems',
    storyNodeType: {
      default: 'Principal',
      optional: 'Opcional',
      choice: 'Elección',
    },
    storyApiTasksTitle: 'Misiones de tarkov.dev (Lightkeeper / Labyrinth)',
    storyLightkeeperTitle: 'Lightkeeper (tarkov.dev)',
    language: 'Idioma',
    viewMode: 'Vista',
    viewModeNormal: 'Normal',
    viewModeCompact: 'Compacto',
    viewModeTable: 'Tabla',
    tableColName: 'Misión',
    tableColTrader: 'Comerciante',
    tableColMap: 'Mapa',
    tableColItems: 'Ítems clave',
    tableColActions: 'Acciones',
    tableSectionActive: 'Activas',
    tableSectionAvailable: 'Disponibles',
    tableSectionCompleted: 'Completadas',
    tableSectionLocked: (n) => `Bloqueadas / fallidas (${n})`,
    tableNoTasks: 'Sin misiones en esta sección.',
    kappa: 'Kappa',
    requires: 'Requiere:',
    levelShort: (n) => `Niv. ${n}`,
    start: 'Iniciar',
    complete: 'Completar',
    reset: 'Reiniciar',
    markStarted: 'Marcar como iniciada',
    markCompleted: 'Marcar como completada',
    resetProgress: 'Reiniciar progreso',
    lockedHint: 'Completa los requisitos (Loyalty Level del comerciante, nivel PJ y misiones previas) para desbloquear esta misión.',
    minLevel: 'Nivel mín.',
    faction: 'Facción',
    kappaRequired: 'Requerida para Kappa',
    viewWiki: 'Ver en Wiki →',
    prevQuests: 'Misiones previas',
    traderReqs: 'Requisitos de comerciante',
    requiredKeys: 'Llaves necesarias',
    objectives: 'Objetivos',
    objectiveDone: 'Objetivo completado',
    objectivePending: 'Marcar objetivo como completado',
    rewards: 'Recompensas',
    reputation: 'reputación',
    level: 'nivel',
    optional: 'opcional',
    anyMap: 'Cualquier mapa',
    anyItem: 'Cualquier ítem',
    activeByMap: (n) => `${n} en curso`,
    viewMap: 'Map',
    viewMapOnTarkovDev: 'Ver en tarkov.dev →',
    mapMarkersTitle: (n) => `${n} ubicación${n === 1 ? '' : 'es'} en el mapa`,
    mapMarkersNoLocation: (n) =>
      `${n} misión${n === 1 ? '' : 'es'} sin ubicación exacta en el mapa`,
    mapPlaceSelectHint: 'Selecciona una misión y haz clic en el mapa para colocarla.',
    mapPlaceClickHint: 'Clic en el mapa para colocar',
    mapPlaceBanner: (name) => `Coloca «${name}» en el mapa`,
    mapPlaceCancel: 'Cancelar',
    mapMarkerManual: 'Ubicación manual',
    mapClearCustomMarker: 'Quitar ubicación manual',
    close: 'Cerrar',
    dataSource: 'Fuente de datos',
    dataSourceLocal: 'Local',
    dataSourceLogs: 'Logs',
    dataSourceLogsUnsupportedTitle: 'Requiere Chrome o Edge de escritorio',
    logsConnect: 'Conectar carpeta de Logs',
    logsReconnect: 'Reconectar',
    logsChangeFolder: 'Cambiar carpeta',
    logsDisconnect: 'Desconectar',
    logsConnecting: 'Conectando…',
    logsNeedsPermission: 'Se requiere permiso de acceso a la carpeta',
    logsSyncedAt: (time) => `Sincronizado · ${time}`,
    logsErrorPrefix: 'Error de sincronización',
    logsNoSessionsFoundError:
      'La carpeta seleccionada no contiene ninguna subcarpeta de sesión "log_AAAA.MM.DD_H-mm-ss…". '
      + 'Probablemente no es la carpeta "Logs" correcta: revisa que hayas entrado dentro de ella '
      + '(no en una carpeta padre ni en una subcarpeta de sesión concreta) y vuelve a intentarlo.',
    logsRetry: 'Reintentar',
    logsReadOnlyNotice: 'Modo Logs activo: el estado de las misiones detectadas en los logs se sincroniza automáticamente y no se puede editar. Las misiones sin eventos en los logs (anteriores a las sesiones guardadas) se pueden marcar manualmente como respaldo.',
    logsPathHint:
      'Ruta habitual de los Logs de Tarkov:\n\n'
      + '• Steam: ...\\steamapps\\common\\Escape From Tarkov\\Logs\n'
      + '  (en versiones antiguas: ...\\Escape From Tarkov\\build\\Logs)\n'
      + '• Launcher BSG: ...\\Battlestate Games\\EFT\\Logs\n\n'
      + 'La forma más fiable de encontrarla: ábrela desde el launcher del juego → menú del perfil → Logs.\n'
      + 'Selecciona la carpeta "Logs" en sí (la que contiene subcarpetas "log_AAAA.MM.DD_H-mm-ss…"), no una subcarpeta de sesión concreta.',
    logsStats: (sessions, totalSessions, tasks, version) => {
      const sessionsPart = totalSessions > sessions
        ? `${sessions}/${totalSessions} sesiones de la temporada actual`
        : `${sessions} sesión(es)`;
      const versionPart = version ? ` (v${version})` : '';
      return `${sessionsPart}${versionPart} · ${tasks} misión(es) detectada(s)`;
    },
    logsNoEventsHint:
      'No se ha encontrado ningún evento de misión en los logs. Comprueba que has seleccionado la carpeta '
      + '"Logs" correcta (la que contiene subcarpetas "log_AAAA.MM.DD_H-mm-ss…") y que dentro de cada una '
      + 'existe un archivo "notifications.log". Ten en cuenta que el juego solo conserva un número limitado '
      + 'de sesiones recientes: el progreso de partidas ya purgadas no se puede recuperar de los logs.',
    logStateDetected: (state) => `Detectado en logs: ${state}`,
    logStateNotDetectedEditable: 'No detectado en los logs (misión anterior a las sesiones guardadas). Puedes marcarla manualmente; si el juego registra un evento real, tendrá prioridad.',
    logLockedHint: 'Detectado en los logs: el estado lo controla el juego, no editable.',
    logsUnmatchedIds: (n) => `${n} ID(s) de misión sin coincidencia`,
    logsWipeStartTitle: 'Inicio de temporada',
    logsWipeStartAuto: 'Automático (última versión detectada)',
    logsWipeStartAll: 'Usar todo el historial (sin filtrar)',
    logsWipeStartOption: (date, version) => `Desde ${date} · v${version}`,
    logsWipeStartAutoTag: ' (auto)',
    state: {
      locked: 'Bloqueada',
      available: 'Disponible',
      started: 'En curso',
      completed: 'Completada',
      failed: 'Fallida',
    },
  },
  en: {
    appTitle: 'Escape From Gorditos',
    subtitle: (n) => `Quest tracker · ${n} quests · data from tarkov.dev`,
    loading: 'Loading quests from tarkov.dev…',
    loadError: 'Failed to load',
    retry: 'Retry',
    incompleteTasksTitle: 'Incomplete quest list',
    incompleteTasksBody: (count) =>
      `The tarkov.dev API returned only ${count} quest(s) instead of the usual several hundred. `
      + 'This is a temporary issue with the tarkov.dev service (or your connection to it), not with the log '
      + 'reader or your quests: with such an incomplete list, no quest detected in the logs (or in Local mode) '
      + 'can be matched correctly, so nothing shows up. Please retry in a moment.',
    staleCacheNotice:
      'tarkov.dev is unreachable: showing cached quests (may not reflect EFT 1.1 yet). Retry later.',
    statAvailable: (n) => `${n} available`,
    statStarted: (n) => `${n} in progress`,
    statCompleted: (n) => `${n} completed`,
    statLocked: (n) => `${n} locked`,
    searchPlaceholder: 'Search quest or trader…',
    allTraders: 'All traders',
    allStatuses: 'All statuses',
    statusAvailable: 'Available',
    statusStarted: 'In progress',
    statusCompleted: 'Completed',
    statusLocked: 'Locked',
    playerLevel: 'Player level',
    gameMode: 'Game mode',
    gameModeLabel: {
      regular: 'PvP',
      pve: 'PvE',
      seasonal: 'Seasonal',
    },
    gameModeHint: {
      regular: 'Permanent PvP Zone character',
      pve: 'Permanent PvE Zone character',
      seasonal: 'Seasonal character (independent progress; resets each season)',
    },
    settings: 'Settings',
    traderLevels: 'Trader loyalty levels',
    traderLevelsHint:
      'In EFT 1.1 side quests unlock by Loyalty Level (LL). Set each trader’s LL to see which quests are available.',
    loyaltyShort: (n) => `LL${n}`,
    exportProgress: 'Export progress',
    importProgress: 'Import progress',
    refreshTasks: 'Refresh quests',
    resetAll: 'Reset all',
    progressCopied: 'Progress copied to clipboard',
    pasteProgress: 'Paste exported progress JSON:',
    invalidJson: 'Invalid JSON',
    confirmReset: 'Delete all progress?',
    wipeAll: 'Wipe All',
    confirmWipeAll:
      'All data stored in the browser will be deleted (quest progress, Story campaign, language, etc.). This cannot be undone.\n\nContinue?',
    importScreenshot: 'Import active',
    importScreenshotHint: 'Paste screenshot (Ctrl+V)',
    importScreenshotProcessing: 'Reading screenshot…',
    importScreenshotResult: (n) => `${n} quest${n === 1 ? '' : 's'} marked in progress`,
    importScreenshotNoMatch: 'No quests found in the image',
    importScreenshotNoImage: 'No image in clipboard',
    importScreenshotError: 'Could not read the image',
    noTasksFilter: 'No quests match these filters.',
    noActiveTasks: 'You have no quests in progress.',
    selectTask: 'Select a quest to view details',
    tabAll: 'All',
    tabActive: 'Active',
    tabStory: 'Story',
    tabSideQuest: 'Side Quest',
    allChapters: 'All chapters',
    searchStoryPlaceholder: 'Search objective or chapter…',
    selectStoryNode: 'Select a Story campaign objective',
    storyNodeKind: 'Type',
    storyItems: 'Objectives / items',
    storyNodeType: {
      default: 'Main',
      optional: 'Optional',
      choice: 'Choice',
    },
    storyApiTasksTitle: 'tarkov.dev quests (Lightkeeper / Labyrinth)',
    storyLightkeeperTitle: 'Lightkeeper (tarkov.dev)',
    language: 'Language',
    viewMode: 'View',
    viewModeNormal: 'Normal',
    viewModeCompact: 'Compact',
    viewModeTable: 'Table',
    tableColName: 'Quest',
    tableColTrader: 'Trader',
    tableColMap: 'Map',
    tableColItems: 'Key items',
    tableColActions: 'Actions',
    tableSectionActive: 'Active',
    tableSectionAvailable: 'Available',
    tableSectionCompleted: 'Completed',
    tableSectionLocked: (n) => `Locked / failed (${n})`,
    tableNoTasks: 'No quests in this section.',
    kappa: 'Kappa',
    requires: 'Requires:',
    levelShort: (n) => `Lvl ${n}`,
    start: 'Start',
    complete: 'Complete',
    reset: 'Reset',
    markStarted: 'Mark as started',
    markCompleted: 'Mark as completed',
    resetProgress: 'Reset progress',
    lockedHint: 'Meet the requirements (trader Loyalty Level, player level, and previous quests) to unlock this quest.',
    minLevel: 'Min. level',
    faction: 'Faction',
    kappaRequired: 'Required for Kappa',
    viewWiki: 'View on Wiki →',
    prevQuests: 'Previous quests',
    traderReqs: 'Trader requirements',
    requiredKeys: 'Required keys',
    objectives: 'Objectives',
    objectiveDone: 'Objective completed',
    objectivePending: 'Mark objective as completed',
    rewards: 'Rewards',
    reputation: 'reputation',
    level: 'level',
    optional: 'optional',
    anyMap: 'Any map',
    anyItem: 'Any item',
    activeByMap: (n) => `${n} in progress`,
    viewMap: 'Map',
    viewMapOnTarkovDev: 'View on tarkov.dev →',
    mapMarkersTitle: (n) => `${n} map location${n === 1 ? '' : 's'}`,
    mapMarkersNoLocation: (n) =>
      `${n} quest${n === 1 ? '' : 's'} without an exact map location`,
    mapPlaceSelectHint: 'Select a quest, then click the map to place it.',
    mapPlaceClickHint: 'Click the map to place',
    mapPlaceBanner: (name) => `Place «${name}» on the map`,
    mapPlaceCancel: 'Cancel',
    mapMarkerManual: 'Manual location',
    mapClearCustomMarker: 'Remove manual location',
    close: 'Close',
    dataSource: 'Data source',
    dataSourceLocal: 'Local',
    dataSourceLogs: 'Logs',
    dataSourceLogsUnsupportedTitle: 'Requires desktop Chrome or Edge',
    logsConnect: 'Connect Logs folder',
    logsReconnect: 'Reconnect',
    logsChangeFolder: 'Change folder',
    logsDisconnect: 'Disconnect',
    logsConnecting: 'Connecting…',
    logsNeedsPermission: 'Folder access permission required',
    logsSyncedAt: (time) => `Synced · ${time}`,
    logsErrorPrefix: 'Sync error',
    logsNoSessionsFoundError:
      'The selected folder has no "log_YYYY.MM.DD_H-mm-ss…" session subfolders. '
      + 'This usually means it is not the right "Logs" folder: make sure you opened it directly '
      + '(not a parent folder or a specific session subfolder) and try again.',
    logsRetry: 'Retry',
    logsReadOnlyNotice: 'Logs mode active: quests detected in the logs sync automatically and cannot be edited. Quests with no log events (predating the saved sessions) can be marked manually as a fallback.',
    logsPathHint:
      'Typical Tarkov Logs folder path:\n\n'
      + '• Steam: ...\\steamapps\\common\\Escape From Tarkov\\Logs\n'
      + '  (older versions: ...\\Escape From Tarkov\\build\\Logs)\n'
      + '• BSG launcher: ...\\Battlestate Games\\EFT\\Logs\n\n'
      + 'Most reliable way to find it: open it from the game launcher → profile menu → Logs.\n'
      + 'Select the "Logs" folder itself (the one containing "log_YYYY.MM.DD_H-mm-ss…" subfolders), not a specific session subfolder.',
    logsStats: (sessions, totalSessions, tasks, version) => {
      const sessionsPart = totalSessions > sessions
        ? `${sessions}/${totalSessions} sessions from the current wipe`
        : `${sessions} session(s)`;
      const versionPart = version ? ` (v${version})` : '';
      return `${sessionsPart}${versionPart} · ${tasks} quest(s) detected`;
    },
    logsNoEventsHint:
      'No quest events were found in the logs. Check that you selected the correct "Logs" folder '
      + '(the one containing "log_YYYY.MM.DD_H-mm-ss…" subfolders) and that each one contains a '
      + '"notifications.log" file. Note that the game only keeps a limited number of recent sessions: '
      + 'progress from already-purged sessions cannot be recovered from the logs.',
    logStateDetected: (state) => `Detected in logs: ${state}`,
    logStateNotDetectedEditable: 'Not detected in logs (task predates the saved sessions). You can mark it manually; a real in-game event will always take priority.',
    logLockedHint: 'Detected in logs: state is controlled by the game, not editable.',
    logsUnmatchedIds: (n) => `${n} unmatched quest ID(s)`,
    logsWipeStartTitle: 'Wipe start point',
    logsWipeStartAuto: 'Automatic (latest detected version)',
    logsWipeStartAll: 'Use full history (no filtering)',
    logsWipeStartOption: (date, version) => `From ${date} · v${version}`,
    logsWipeStartAutoTag: ' (auto)',
    state: {
      locked: 'Locked',
      available: 'Available',
      started: 'In progress',
      completed: 'Completed',
      failed: 'Failed',
    },
  },
};

export function getTranslations(lang: Lang): Translations {
  return translations[lang];
}
