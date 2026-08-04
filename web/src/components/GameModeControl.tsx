import type { GameMode } from '../types';
import { GAME_MODES } from '../types';
import type { Translations } from '../i18n/translations';

interface GameModeControlProps {
  gameMode: GameMode;
  onChange: (mode: GameMode) => void;
  t: Translations;
}

export function GameModeControl({ gameMode, onChange, t }: GameModeControlProps) {
  return (
    <div className="game-mode-control" role="group" aria-label={t.gameMode}>
      {GAME_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          className={`game-mode-btn${gameMode === mode ? ' active' : ''}${mode === 'seasonal' ? ' seasonal' : ''}`}
          onClick={() => onChange(mode)}
          aria-pressed={gameMode === mode}
          title={t.gameModeHint[mode]}
        >
          {t.gameModeLabel[mode]}
        </button>
      ))}
    </div>
  );
}
