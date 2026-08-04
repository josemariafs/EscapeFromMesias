import { useCallback, useState } from 'react';
import {
  DEFAULT_GAME_MODE,
  GAME_MODE_STORAGE_KEY,
  type GameMode,
} from '../types';

function readStoredGameMode(): GameMode {
  const stored = localStorage.getItem(GAME_MODE_STORAGE_KEY);
  if (stored === 'pve' || stored === 'seasonal' || stored === 'regular') {
    return stored;
  }
  return DEFAULT_GAME_MODE;
}

export function useGameMode() {
  const [gameMode, setGameModeState] = useState<GameMode>(readStoredGameMode);

  const setGameMode = useCallback((mode: GameMode) => {
    setGameModeState(mode);
    localStorage.setItem(GAME_MODE_STORAGE_KEY, mode);
  }, []);

  return { gameMode, setGameMode };
}
