import type { TaskProgressState } from '../types';

export type Lang = 'es' | 'en';

export const LANG_STORAGE_KEY = 'eft-quest-tracker-lang';

export interface Translations {
  appTitle: string;
  subtitle: (n: number) => string;
  loading: string;
  loadError: string;
  retry: string;
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
  settings: string;
  traderLevels: string;
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
  language: string;
  viewMode: string;
  viewModeNormal: string;
  viewModeCompact: string;
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
  rewards: string;
  reputation: string;
  level: string;
  optional: string;
  anyMap: string;
  anyItem: string;
  activeByMap: (n: number) => string;
  state: Record<TaskProgressState, string>;
}

export const translations: Record<Lang, Translations> = {
  es: {
    appTitle: 'Escape From Gorditos',
    subtitle: (n) => `Tracker de misiones · ${n} quests · datos de tarkov.dev`,
    loading: 'Cargando misiones desde tarkov.dev…',
    loadError: 'Error al cargar',
    retry: 'Reintentar',
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
    settings: 'Ajustes',
    traderLevels: 'Nivel de comerciantes',
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
    language: 'Idioma',
    viewMode: 'Vista',
    viewModeNormal: 'Normal',
    viewModeCompact: 'Compacto',
    kappa: 'Kappa',
    requires: 'Requiere:',
    levelShort: (n) => `Niv. ${n}`,
    start: 'Iniciar',
    complete: 'Completar',
    reset: 'Reiniciar',
    markStarted: 'Marcar como iniciada',
    markCompleted: 'Marcar como completada',
    resetProgress: 'Reiniciar progreso',
    lockedHint: 'Completa los requisitos para desbloquear esta misión.',
    minLevel: 'Nivel mín.',
    faction: 'Facción',
    kappaRequired: 'Requerida para Kappa',
    viewWiki: 'Ver en Wiki →',
    prevQuests: 'Misiones previas',
    traderReqs: 'Requisitos de comerciante',
    requiredKeys: 'Llaves necesarias',
    objectives: 'Objetivos',
    rewards: 'Recompensas',
    reputation: 'reputación',
    level: 'nivel',
    optional: 'opcional',
    anyMap: 'Cualquier mapa',
    anyItem: 'Cualquier ítem',
    activeByMap: (n) => `${n} en curso`,
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
    settings: 'Settings',
    traderLevels: 'Trader levels',
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
    language: 'Language',
    viewMode: 'View',
    viewModeNormal: 'Normal',
    viewModeCompact: 'Compact',
    kappa: 'Kappa',
    requires: 'Requires:',
    levelShort: (n) => `Lvl ${n}`,
    start: 'Start',
    complete: 'Complete',
    reset: 'Reset',
    markStarted: 'Mark as started',
    markCompleted: 'Mark as completed',
    resetProgress: 'Reset progress',
    lockedHint: 'Complete requirements to unlock this quest.',
    minLevel: 'Min. level',
    faction: 'Faction',
    kappaRequired: 'Required for Kappa',
    viewWiki: 'View on Wiki →',
    prevQuests: 'Previous quests',
    traderReqs: 'Trader requirements',
    requiredKeys: 'Required keys',
    objectives: 'Objectives',
    rewards: 'Rewards',
    reputation: 'reputation',
    level: 'level',
    optional: 'optional',
    anyMap: 'Any map',
    anyItem: 'Any item',
    activeByMap: (n) => `${n} in progress`,
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
