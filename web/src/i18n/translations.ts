import type { GameMode, TaskProgressState } from '../types';

export type Lang = 'es' | 'en';

export const LANG_STORAGE_KEY = 'eft-quest-tracker-lang';

export interface Translations {
  appTitle: string;
  homeChooseTitle: string;
  homeChooseHint: string;
  homeRoutesHint: string;
  homeCardRoutes: string;
  homeCardPvp: string;
  homeCardSeasonal: string;
  homeCardAdmin: string;
  homeCardTagRoutes: string;
  homeCardTagRegular: string;
  homeCardTagSeasonal: string;
  homeCardTagAdmin: string;
  homeBack: string;
  subtitle: (n: number) => string;
  loading: string;
  loadError: string;
  retry: string;
  incompleteTasksTitle: string;
  incompleteTasksBody: (count: number) => string;
  staleCacheNotice: string;
  staleCacheNoticeDetail: (detail: string) => string;
  searchPlaceholder: string;
  allTraders: string;
  allStatuses: string;
  statusAvailable: string;
  statusStarted: string;
  statusCompleted: string;
  statusLocked: string;
  playerLevel: string;
  playerLevelLogsHint: string;
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
  footerVisits: (n: number) => string;
  footerOnline: (n: number) => string;
  footerLastUpdate: string;
  footerLogout: string;
  feedbackButton: string;
  feedbackTitle: string;
  feedbackFieldTitle: string;
  feedbackFieldTitlePlaceholder: string;
  feedbackFieldMessage: string;
  feedbackFieldMessagePlaceholder: string;
  feedbackAttachments: string;
  feedbackAttachmentsHint: string;
  feedbackUpload: string;
  feedbackRemoveImage: string;
  feedbackImageError: string;
  feedbackRequired: string;
  feedbackSend: string;
  feedbackSending: string;
  feedbackSendError: string;
  feedbackSuccess: string;
  feedbackCancel: string;
  feedbackClose: string;
  noTasksFilter: string;
  noActiveTasks: string;
  noCompletedTasks: string;
  selectTask: string;
  tabAll: string;
  tabActive: string;
  tabCompleted: string;
  tabRoutes: string;
  tabStory: string;
  tabSideQuest: string;
  routesTitle: string;
  routesHint: string;
  routesOpenMap: string;
  routesBackToMaps: string;
  routesDrawHint: string;
  routesPointColor: string;
  routesCustomColor: string;
  routesPlayerNamePlaceholder: string;
  routesPoints: (n: number) => string;
  routesPointLabel: (n: number) => string;
  routesNoPoints: string;
  routesUndo: string;
  routesClear: string;
  routesConfirmClear: string;
  routesRemovePoint: string;
  routesRemoveArrow: string;
  routesArrows: (n: number) => string;
  routesArrowLabel: (n: number) => string;
  routesNoArrows: string;
  routesPointLabelPlaceholder: string;
  routesFixedSection: string;
  routesPersonalSection: string;
  routesFixedPoints: (n: number) => string;
  routesFixedHint: string;
  routesNoFixedPoints: string;
  routesFixedLoading: string;
  routesFixedLoadError: string;
  routesHideFixedPoints: string;
  routesShowFixedPoints: string;
  routesFixedLayers: string;
  routesShowLayer: (name: string) => string;
  routesHideLayer: (name: string) => string;
  routesExtractPmc: string;
  routesExtractScav: string;
  routesExtractShared: string;
  routesExtractTooltipHint: string;
  adminRoutesTitle: string;
  adminRoutesHint: string;
  routeEnvironmentRegular: string;
  routeEnvironmentSeasonal: string;
  routeEnvironmentHint: string;
  adminLoginTitle: string;
  adminTokenLabel: string;
  adminTokenPlaceholder: string;
  adminLogin: string;
  adminLogout: string;
  adminBackToDashboard: string;
  adminLoginError: string;
  adminDrawHint: string;
  adminPointLabel: string;
  adminPointLabelPlaceholder: string;
  adminPointImage: string;
  adminPointImageHint: string;
  adminPointImageUpload: string;
  adminPointImageClear: string;
  adminPointImageError: string;
  routesPointImageModal: string;
  adminMarkerType: string;
  adminMarkerTypeDefault: string;
  adminMarkerTypeKeyDocument: string;
  adminMarkerTypeKeyDocumentHint: string;
  adminKeyDocumentLabelPlaceholder: string;
  adminMarkerTypeQuestion: string;
  adminMarkerTypeQuestionHint: string;
  adminSaveLabel: string;
  adminWorking: string;
  adminDeletePoint: string;
  allChapters: string;
  searchStoryPlaceholder: string;
  selectStoryNode: string;
  storyNodeKind: string;
  storyItems: string;
  storyNodeType: Record<'default' | 'optional' | 'choice', string>;
  storyApiTasksTitle: string;
  storyLightkeeperTitle: string;
  language: string;
  /** Enlace al panel /admin (solo sesión ADMIN_TOKEN). */
  openAdminPanel: string;
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
  viewWikiOn: string;
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
  completedByMap: (n: number) => string;
  viewMap: string;
  viewMapOnTarkovDev: string;
  mapMarkersTitle: (n: number) => string;
  mapMarkersNoLocation: (n: number) => string;
  mapPlaceSelectHint: string;
  mapPlaceClickHint: string;
  mapPlaceBanner: (taskName: string) => string;
  mapPlaceCancel: string;
  mapRoutePointsEditHint: string;
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
  logsRefreshFolder: string;
  logsSnapshotHint: string;
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
  logsUnmatchedStatus: (completed: number, started: number, failed: number) => string;
  logsUnmatchedTitle: (n: number) => string;
  logsUnmatchedBody: string;
  logsUnmatchedOk: string;
  logsWipeStartTitle: string;
  logsWipeStartAuto: string;
  logsWipeStartAll: string;
  logsWipeStartOption: (date: string, version: string) => string;
  logsWipeStartAutoTag: string;
  logsProfilesTitle: string;
  logsProfilesHint: string;
  logsProfileRegular: string;
  logsProfileSeasonal: string;
  logsProfileUnassigned: string;
  logsProfileActive: string;
  logsProfileNeedsAssign: string;
  state: Record<TaskProgressState, string>;
}

export const translations: Record<Lang, Translations> = {
  es: {
    appTitle: 'Escape From Gorditos',
    homeChooseTitle: 'Elige cómo usar la app',
    homeChooseHint: 'Selecciona un modo para empezar. Puedes volver aquí desde el logo.',
    homeRoutesHint: 'Dibuja y consulta rutas en los mapas, con puntos fijos compartidos.',
    homeCardRoutes: 'Routes Zone',
    homeCardPvp: 'PvP Zone',
    homeCardSeasonal: 'PvP Season',
    homeCardAdmin: 'Admin',
    homeCardTagRoutes: 'MAPS',
    homeCardTagRegular: 'REGULAR',
    homeCardTagSeasonal: 'SEASONAL',
    homeCardTagAdmin: 'PANEL',
    homeBack: 'Inicio',
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
      'Ni GraphQL ni json.tarkov.dev respondieron: mostrando misiones offline empaquetadas.',
    staleCacheNoticeDetail: (detail) => `Detalle: ${detail}`,
    searchPlaceholder: 'Buscar misión o comerciante…',
    allTraders: 'Todos los comerciantes',
    allStatuses: 'Todos los estados',
    statusAvailable: 'Disponibles',
    statusStarted: 'En curso',
    statusCompleted: 'Completadas',
    statusLocked: 'Bloqueadas',
    playerLevel: 'Nivel PJ',
    playerLevelLogsHint:
      'En modo Logs el nivel se calcula solo: el mayor nivel exigido por tus misiones activas o completadas.',
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
      'Se calcula solo: si tienes una misión activa o completada que exige cierto LL, ese valor se usa como mínimo. Puedes subirlo a mano si hace falta.',
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
    footerVisits: (n) => `${n.toLocaleString('es-ES')} visita${n === 1 ? '' : 's'} única${n === 1 ? '' : 's'}`,
    footerOnline: (n) => `${n.toLocaleString('es-ES')} en línea`,
    footerLastUpdate: 'Última actualización',
    footerLogout: 'Salir',
    feedbackButton: 'Reportar/Feedback',
    feedbackTitle: 'Reportar / Feedback',
    feedbackFieldTitle: 'Título',
    feedbackFieldTitlePlaceholder: 'Resumen breve',
    feedbackFieldMessage: 'Mensaje',
    feedbackFieldMessagePlaceholder: 'Describe el problema o la idea…',
    feedbackAttachments: 'Capturas',
    feedbackAttachmentsHint: 'Pega una captura (Ctrl+V) o sube imágenes desde tu ordenador.',
    feedbackUpload: 'Subir imagen',
    feedbackRemoveImage: 'Quitar imagen',
    feedbackImageError: 'No se pudo procesar la imagen.',
    feedbackRequired: 'Título y mensaje son obligatorios.',
    feedbackSend: 'Enviar',
    feedbackSending: 'Enviando…',
    feedbackSendError: 'No se pudo enviar. Inténtalo de nuevo.',
    feedbackSuccess: 'Gracias. Tu mensaje se ha enviado.',
    feedbackCancel: 'Cancelar',
    feedbackClose: 'Cerrar',
    noTasksFilter: 'No hay misiones con estos filtros.',
    noActiveTasks: 'No tienes misiones en curso.',
    noCompletedTasks: 'No tienes misiones completadas.',
    selectTask: 'Selecciona una misión para ver los detalles',
    tabAll: 'Todas',
    tabActive: 'Activas',
    tabCompleted: 'Completadas',
    tabRoutes: 'Rutas',
    tabStory: 'Story',
    tabSideQuest: 'Side Quest',
    routesTitle: 'Rutas en el mapa',
    routesHint:
      'Dibuja puntos de ruta sobre cualquier mapa de Tarkov. Independiente de las misiones: solo para planear recorridos.',
    routesOpenMap: 'Abrir mapa',
    routesBackToMaps: 'Todos los mapas',
    routesDrawHint:
      'Elige un color y haz clic en el mapa para añadir puntos. Arrastra para dibujar una flecha. Arrastra un pin para moverlo; clic en pin/flecha para eliminar.',
    routesPointColor: 'Color del jugador',
    routesCustomColor: 'Personalizado',
    routesPlayerNamePlaceholder: 'Nombre del jugador',
    routesPoints: (n) => `${n} punto${n === 1 ? '' : 's'}`,
    routesPointLabel: (n) => `Punto ${n}`,
    routesNoPoints: 'Aún no hay puntos en este mapa.',
    routesUndo: 'Deshacer',
    routesClear: 'Borrar ruta',
    routesConfirmClear: '¿Borrar todos los puntos de este mapa?',
    routesRemovePoint: 'Eliminar punto',
    routesRemoveArrow: 'Eliminar flecha',
    routesArrows: (n) => `${n} flecha${n === 1 ? '' : 's'}`,
    routesArrowLabel: (n) => `Flecha ${n}`,
    routesNoArrows: 'Sin flechas en este mapa.',
    routesPointLabelPlaceholder: 'Marker',
    routesFixedSection: 'Puntos fijos',
    routesPersonalSection: 'Tus puntos',
    routesFixedPoints: (n) => `${n} fijo${n === 1 ? '' : 's'}`,
    routesFixedHint: 'Los puntos fijos los define el administrador y son visibles para todos.',
    routesNoFixedPoints: 'No hay puntos fijos en este mapa.',
    routesFixedLoading: 'Cargando puntos fijos…',
    routesFixedLoadError: 'No se pudieron cargar los puntos fijos.',
    routesHideFixedPoints: 'Ocultar puntos fijos',
    routesShowFixedPoints: 'Mostrar puntos fijos',
    routesFixedLayers: 'Capas del mapa',
    routesShowLayer: (name) => `Mostrar ${name}`,
    routesHideLayer: (name) => `Ocultar ${name}`,
    routesExtractPmc: 'Extractos PMC',
    routesExtractScav: 'Extractos Scav',
    routesExtractShared: 'Extracto compartido',
    routesExtractTooltipHint: 'Salida del mapa',
    adminRoutesTitle: 'Admin · Puntos fijos de rutas',
    adminRoutesHint: 'Crea y edita puntos compartidos. Se guardan en el servidor (Turso).',
    routeEnvironmentRegular: 'PVP Zone',
    routeEnvironmentSeasonal: 'Seasonal / Routes',
    routeEnvironmentHint: 'PVP Zone y Seasonal tienen mapas independientes. Routes comparte datos con Seasonal.',
    adminLoginTitle: 'Acceso admin',
    adminTokenLabel: 'Token de administración',
    adminTokenPlaceholder: 'ADMIN_TOKEN',
    adminLogin: 'Entrar',
    adminLogout: 'Salir',
    adminBackToDashboard: 'Panel admin',
    adminLoginError: 'Token incorrecto o API no disponible.',
    adminDrawHint: 'Elige un color y haz clic en el mapa para crear un punto fijo. Arrastra un pin para moverlo; clic para eliminarlo.',
    adminPointLabel: 'Etiqueta',
    adminPointLabelPlaceholder: 'Nombre del punto (opcional)',
    adminPointImage: 'Imagen',
    adminPointImageHint: 'Se muestra al pasar el ratón; clic en el punto para verla en grande.',
    adminPointImageUpload: 'Subir imagen',
    adminPointImageClear: 'Quitar imagen',
    adminPointImageError: 'No se pudo procesar la imagen. Prueba con otra más ligera.',
    routesPointImageModal: 'Imagen del punto',
    adminMarkerType: 'Tipo de marcador',
    adminMarkerTypeDefault: 'Normal',
    adminMarkerTypeKeyDocument: 'Key Document',
    adminMarkerTypeKeyDocumentHint:
      'Pin KB con label opcional. El texto se muestra encima de la imagen al pasar el ratón o al abrirla.',
    adminKeyDocumentLabelPlaceholder: '212 ROOM',
    adminMarkerTypeQuestion: 'Interrogación',
    adminMarkerTypeQuestionHint: 'Pin ? sin texto. El hover sigue mostrando la imagen.',
    adminSaveLabel: 'Guardar etiqueta',
    adminWorking: 'Guardando…',
    adminDeletePoint: 'Eliminar punto fijo',
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
    openAdminPanel: 'Admin',
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
    viewWiki: 'Ver en Wiki',
    viewWikiOn: 'Ver en',
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
    completedByMap: (n) => `${n} completada${n === 1 ? '' : 's'}`,
    viewMap: 'Map',
    viewMapOnTarkovDev: 'Ver en tarkov.dev →',
    mapMarkersTitle: (n) => `${n} ubicación${n === 1 ? '' : 'es'} en el mapa`,
    mapMarkersNoLocation: (n) =>
      `${n} misión${n === 1 ? '' : 'es'} sin ubicación exacta en el mapa`,
    mapPlaceSelectHint: 'Selecciona una misión y haz clic en el mapa para colocarla.',
    mapPlaceClickHint: 'Clic en el mapa para colocar',
    mapPlaceBanner: (name) => `Coloca «${name}» en el mapa`,
    mapPlaceCancel: 'Cancelar',
    mapRoutePointsEditHint:
      'Clic para añadir un punto. Arrastra para dibujar una flecha. Clic en un pin o flecha para eliminarlos.',
    mapMarkerManual: 'Ubicación manual',
    mapClearCustomMarker: 'Quitar ubicación manual',
    close: 'Cerrar',
    dataSource: 'Fuente de datos',
    dataSourceLocal: 'Local',
    dataSourceLogs: 'Logs',
    dataSourceLogsUnsupportedTitle: 'Tu navegador no permite elegir carpetas',
    logsConnect: 'Conectar carpeta de Logs',
    logsReconnect: 'Reconectar',
    logsChangeFolder: 'Cambiar carpeta',
    logsRefreshFolder: 'Actualizar (volver a elegir la carpeta)',
    logsSnapshotHint:
      'En este navegador la carpeta se lee como una instantánea. Para ver misiones nuevas, vuelve a elegir la carpeta Logs.',
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
    logsUnmatchedStatus: (completed, started, failed) => {
      const parts: string[] = [];
      if (completed > 0) parts.push(`${completed} completada${completed === 1 ? '' : 's'}`);
      if (started > 0) parts.push(`${started} en curso`);
      if (failed > 0) parts.push(`${failed} fallida${failed === 1 ? '' : 's'}`);
      return parts.length > 0 ? parts.join(' · ') : 'Sin estado conocido';
    },
    logsUnmatchedTitle: (n) =>
      `${n} misión(es) en los logs sin coincidencia en la lista actual`,
    logsUnmatchedBody:
      'Aparecen en tus logs pero no en las misiones cargadas (modo de juego distinto, lista incompleta o IDs desconocidos).',
    logsUnmatchedOk: 'No afecta a las misiones que sí se han emparejado correctamente.',
    logsWipeStartTitle: 'Inicio de temporada',
    logsWipeStartAuto: 'Automático (última versión detectada)',
    logsWipeStartAll: 'Usar todo el historial (sin filtrar)',
    logsWipeStartOption: (date, version) => `Desde ${date} · v${version}`,
    logsWipeStartAutoTag: ' (auto)',
    logsProfilesTitle: 'Perfiles PMC (logs)',
    logsProfilesHint:
      'Seasonal y PVP Regular usan ProfileId distintos. Asigna cada perfil al modo correcto; '
      + 'al conectar Logs en un modo sin perfil, se enlaza automáticamente el último visto.',
    logsProfileRegular: 'PVP Zone',
    logsProfileSeasonal: 'Seasonal',
    logsProfileUnassigned: 'Sin asignar',
    logsProfileActive: 'activo',
    logsProfileNeedsAssign: 'Hay perfiles sin asignar. Enlázalos para separar Seasonal y Regular.',
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
    homeChooseTitle: 'Choose how to use the app',
    homeChooseHint: 'Pick a mode to get started. You can return here from the logo.',
    homeRoutesHint: 'Draw and review routes on maps, including shared fixed points.',
    homeCardRoutes: 'Routes Zone',
    homeCardPvp: 'PvP Zone',
    homeCardSeasonal: 'PvP Season',
    homeCardAdmin: 'Admin',
    homeCardTagRoutes: 'MAPS',
    homeCardTagRegular: 'REGULAR',
    homeCardTagSeasonal: 'SEASONAL',
    homeCardTagAdmin: 'PANEL',
    homeBack: 'Home',
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
      'Neither GraphQL nor json.tarkov.dev responded: showing bundled offline quests.',
    staleCacheNoticeDetail: (detail) => `Detail: ${detail}`,
    searchPlaceholder: 'Search quest or trader…',
    allTraders: 'All traders',
    allStatuses: 'All statuses',
    statusAvailable: 'Available',
    statusStarted: 'In progress',
    statusCompleted: 'Completed',
    statusLocked: 'Locked',
    playerLevel: 'Player level',
    playerLevelLogsHint:
      'In Logs mode, level is auto-detected from the highest level required by your active or completed quests.',
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
      'Auto-detected: an active or completed quest that requires a given LL sets that as the minimum. You can raise it manually if needed.',
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
    footerVisits: (n) => `${n.toLocaleString('en-US')} unique visit${n === 1 ? '' : 's'}`,
    footerOnline: (n) => `${n.toLocaleString('en-US')} online`,
    footerLastUpdate: 'Last update',
    footerLogout: 'Sign out',
    feedbackButton: 'Report/Feedback',
    feedbackTitle: 'Report / Feedback',
    feedbackFieldTitle: 'Title',
    feedbackFieldTitlePlaceholder: 'Short summary',
    feedbackFieldMessage: 'Message',
    feedbackFieldMessagePlaceholder: 'Describe the issue or idea…',
    feedbackAttachments: 'Screenshots',
    feedbackAttachmentsHint: 'Paste a screenshot (Ctrl+V) or upload images from your computer.',
    feedbackUpload: 'Upload image',
    feedbackRemoveImage: 'Remove image',
    feedbackImageError: 'Could not process the image.',
    feedbackRequired: 'Title and message are required.',
    feedbackSend: 'Send',
    feedbackSending: 'Sending…',
    feedbackSendError: 'Could not send. Please try again.',
    feedbackSuccess: 'Thanks. Your message was sent.',
    feedbackCancel: 'Cancel',
    feedbackClose: 'Close',
    noTasksFilter: 'No quests match these filters.',
    noActiveTasks: 'You have no quests in progress.',
    noCompletedTasks: 'You have no completed quests.',
    selectTask: 'Select a quest to view details',
    tabAll: 'All',
    tabActive: 'Active',
    tabCompleted: 'Completed',
    tabRoutes: 'Routes',
    tabStory: 'Story',
    tabSideQuest: 'Side Quest',
    routesTitle: 'Map routes',
    routesHint:
      'Draw route points on any Tarkov map. Separate from quests — just for planning your runs.',
    routesOpenMap: 'Open map',
    routesBackToMaps: 'All maps',
    routesDrawHint:
      'Pick a color and click the map to add points. Drag to draw an arrow. Drag a pin to move it; click a pin/arrow to remove it.',
    routesPointColor: 'Player color',
    routesCustomColor: 'Custom',
    routesPlayerNamePlaceholder: 'Player name',
    routesPoints: (n) => `${n} point${n === 1 ? '' : 's'}`,
    routesPointLabel: (n) => `Point ${n}`,
    routesNoPoints: 'No points on this map yet.',
    routesUndo: 'Undo',
    routesClear: 'Clear route',
    routesConfirmClear: 'Clear all points on this map?',
    routesRemovePoint: 'Remove point',
    routesRemoveArrow: 'Remove arrow',
    routesArrows: (n) => `${n} arrow${n === 1 ? '' : 's'}`,
    routesArrowLabel: (n) => `Arrow ${n}`,
    routesNoArrows: 'No arrows on this map.',
    routesPointLabelPlaceholder: 'Marker',
    routesFixedSection: 'Fixed points',
    routesPersonalSection: 'Your points',
    routesFixedPoints: (n) => `${n} fixed`,
    routesFixedHint: 'Fixed points are set by an admin and visible to everyone.',
    routesNoFixedPoints: 'No fixed points on this map.',
    routesFixedLoading: 'Loading fixed points…',
    routesFixedLoadError: 'Could not load fixed points.',
    routesHideFixedPoints: 'Hide fixed points',
    routesShowFixedPoints: 'Show fixed points',
    routesFixedLayers: 'Map layers',
    routesShowLayer: (name) => `Show ${name}`,
    routesHideLayer: (name) => `Hide ${name}`,
    routesExtractPmc: 'PMC extracts',
    routesExtractScav: 'Scav extracts',
    routesExtractShared: 'Shared extract',
    routesExtractTooltipHint: 'Map extract',
    adminRoutesTitle: 'Admin · Fixed route points',
    adminRoutesHint: 'Create and edit shared points. Stored on the server (Turso).',
    routeEnvironmentRegular: 'PVP Zone',
    routeEnvironmentSeasonal: 'Seasonal / Routes',
    routeEnvironmentHint: 'PVP Zone and Seasonal have separate maps. Routes shares data with Seasonal.',
    adminLoginTitle: 'Admin access',
    adminTokenLabel: 'Admin token',
    adminTokenPlaceholder: 'ADMIN_TOKEN',
    adminLogin: 'Sign in',
    adminLogout: 'Sign out',
    adminBackToDashboard: 'Admin panel',
    adminLoginError: 'Invalid token or API unavailable.',
    adminDrawHint: 'Pick a color and click the map to create a fixed point. Drag a pin to move it; click to remove it.',
    adminPointLabel: 'Label',
    adminPointLabelPlaceholder: 'Point name (optional)',
    adminPointImage: 'Image',
    adminPointImageHint: 'Shown on hover; click the point to view it larger.',
    adminPointImageUpload: 'Upload image',
    adminPointImageClear: 'Remove image',
    adminPointImageError: 'Could not process the image. Try a smaller one.',
    routesPointImageModal: 'Point image',
    adminMarkerType: 'Marker type',
    adminMarkerTypeDefault: 'Normal',
    adminMarkerTypeKeyDocument: 'Key Document',
    adminMarkerTypeKeyDocumentHint:
      'KB pin with an optional label. The text appears above the image on hover and in the full view.',
    adminKeyDocumentLabelPlaceholder: '212 ROOM',
    adminMarkerTypeQuestion: 'Question mark',
    adminMarkerTypeQuestionHint: '? pin with no text. Hover still shows the image.',
    adminSaveLabel: 'Save label',
    adminWorking: 'Saving…',
    adminDeletePoint: 'Delete fixed point',
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
    openAdminPanel: 'Admin',
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
    viewWiki: 'View on Wiki',
    viewWikiOn: 'View on',
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
    completedByMap: (n) => `${n} completed`,
    viewMap: 'Map',
    viewMapOnTarkovDev: 'View on tarkov.dev →',
    mapMarkersTitle: (n) => `${n} map location${n === 1 ? '' : 's'}`,
    mapMarkersNoLocation: (n) =>
      `${n} quest${n === 1 ? '' : 's'} without an exact map location`,
    mapPlaceSelectHint: 'Select a quest, then click the map to place it.',
    mapPlaceClickHint: 'Click the map to place',
    mapPlaceBanner: (name) => `Place «${name}» on the map`,
    mapPlaceCancel: 'Cancel',
    mapRoutePointsEditHint:
      'Click to add a point. Drag to draw an arrow. Click a pin or arrow to remove it.',
    mapMarkerManual: 'Manual location',
    mapClearCustomMarker: 'Remove manual location',
    close: 'Close',
    dataSource: 'Data source',
    dataSourceLocal: 'Local',
    dataSourceLogs: 'Logs',
    dataSourceLogsUnsupportedTitle: 'Your browser cannot pick folders',
    logsConnect: 'Connect Logs folder',
    logsReconnect: 'Reconnect',
    logsChangeFolder: 'Change folder',
    logsRefreshFolder: 'Refresh (pick the folder again)',
    logsSnapshotHint:
      'In this browser the folder is read as a snapshot. To see new quests, pick the Logs folder again.',
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
    logsUnmatchedStatus: (completed, started, failed) => {
      const parts: string[] = [];
      if (completed > 0) parts.push(`${completed} completed`);
      if (started > 0) parts.push(`${started} in progress`);
      if (failed > 0) parts.push(`${failed} failed`);
      return parts.length > 0 ? parts.join(' · ') : 'No known status';
    },
    logsUnmatchedTitle: (n) =>
      `${n} quest(s) in logs with no match in the current list`,
    logsUnmatchedBody:
      'They appear in your logs but not in the loaded quests (different game mode, incomplete list, or unknown IDs).',
    logsUnmatchedOk: 'This does not affect quests that matched correctly.',
    logsWipeStartTitle: 'Wipe start point',
    logsWipeStartAuto: 'Automatic (latest detected version)',
    logsWipeStartAll: 'Use full history (no filtering)',
    logsWipeStartOption: (date, version) => `From ${date} · v${version}`,
    logsWipeStartAutoTag: ' (auto)',
    logsProfilesTitle: 'PMC profiles (logs)',
    logsProfilesHint:
      'Seasonal and PVP Regular use different ProfileIds. Assign each profile to the right mode; '
      + 'connecting Logs in a mode with no profile auto-links the latest seen one.',
    logsProfileRegular: 'PVP Zone',
    logsProfileSeasonal: 'Seasonal',
    logsProfileUnassigned: 'Unassigned',
    logsProfileActive: 'active',
    logsProfileNeedsAssign: 'Unassigned profiles found. Link them to separate Seasonal and Regular.',
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
