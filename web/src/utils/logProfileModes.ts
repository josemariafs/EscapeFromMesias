import type { GameMode } from '../types';

/** Modos PVP que se distinguen por ProfileId en los logs. */
export type LogProfileGameMode = 'regular' | 'seasonal';

export const LOG_PROFILE_MODES_STORAGE_KEY = 'efg-log-profile-modes';

export function toLogProfileMode(gameMode: GameMode): LogProfileGameMode {
  return gameMode === 'seasonal' ? 'seasonal' : 'regular';
}

export function readLogProfileModes(): Record<string, LogProfileGameMode> {
  try {
    const raw = localStorage.getItem(LOG_PROFILE_MODES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const next: Record<string, LogProfileGameMode> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (value === 'regular' || value === 'seasonal') next[id] = value;
    }
    return next;
  } catch {
    return {};
  }
}

export function writeLogProfileModes(modes: Record<string, LogProfileGameMode>): void {
  localStorage.setItem(LOG_PROFILE_MODES_STORAGE_KEY, JSON.stringify(modes));
}

export function setLogProfileMode(
  profileId: string,
  mode: LogProfileGameMode | null,
  current: Record<string, LogProfileGameMode> = readLogProfileModes(),
): Record<string, LogProfileGameMode> {
  const next = { ...current };
  if (!mode) delete next[profileId];
  else next[profileId] = mode;
  writeLogProfileModes(next);
  return next;
}

export function shortProfileId(profileId: string): string {
  if (profileId.length <= 8) return profileId;
  return `${profileId.slice(0, 6)}…`;
}

export function modeHasProfile(
  modes: Record<string, LogProfileGameMode>,
  mode: LogProfileGameMode,
): boolean {
  return Object.values(modes).some((value) => value === mode);
}

/**
 * ¿La sesión con este ProfileId cuenta para el modo activo?
 * - Mapeado al modo → sí
 * - Mapeado a otro → no
 * - Sin mapear → solo si el modo aún no tiene ningún perfil asignado (arranque / legacy)
 */
export function profileMatchesMode(
  profileId: string | null | undefined,
  mode: LogProfileGameMode,
  modes: Record<string, LogProfileGameMode>,
): boolean {
  if (!profileId) return false;
  const mapped = modes[profileId];
  if (mapped) return mapped === mode;
  return !modeHasProfile(modes, mode);
}

/**
 * Si el modo no tiene perfil y el último ProfileId visto está sin asignar, lo enlaza.
 * Así, conectar Logs estando en Seasonal/Regular suele acertar a la primera.
 */
export function autoBindLatestProfile(
  latestProfileId: string | null | undefined,
  mode: LogProfileGameMode,
  modes: Record<string, LogProfileGameMode>,
): Record<string, LogProfileGameMode> {
  if (!latestProfileId) return modes;
  if (modes[latestProfileId]) return modes;
  if (modeHasProfile(modes, mode)) return modes;
  return setLogProfileMode(latestProfileId, mode, modes);
}
