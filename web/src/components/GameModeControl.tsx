import type { GameMode } from '../types';
import { SELECTABLE_GAME_MODES } from '../types';
import type { Translations } from '../i18n/translations';

interface GameModeControlProps {
  gameMode: GameMode;
  onChange: (mode: GameMode) => void;
  t: Translations;
}

export function GameModeControl({ gameMode, onChange, t }: GameModeControlProps) {
  const activeMode = gameMode === 'pve' ? 'regular' : gameMode;

  return (
    <div className="game-mode-control" role="group" aria-label={t.gameMode}>
      {SELECTABLE_GAME_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          className={`game-mode-btn${activeMode === mode ? ' active' : ''}${mode === 'seasonal' ? ' seasonal' : ''}`}
          onClick={() => onChange(mode)}
          aria-pressed={activeMode === mode}
          title={t.gameModeHint[mode]}
        >
          {t.gameModeLabel[mode]}
        </button>
      ))}
    </div>
  );
}
