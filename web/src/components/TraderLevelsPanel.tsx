import { DEFAULT_TRADER_LOYALTY } from '../utils/unlock';
import type { Translations } from '../i18n/translations';

interface TraderLevelsPanelProps {
  traders: { id: string; name: string }[];
  traderLevels: Record<string, number>;
  onChange: (traderId: string, level: number) => void;
  t: Translations;
  onClose: () => void;
}

export function TraderLevelsPanel({
  traders,
  traderLevels,
  onChange,
  t,
  onClose,
}: TraderLevelsPanelProps) {
  return (
    <div className="settings-panel trader-levels-panel">
      <div className="trader-levels-panel-header">
        <h3>{t.traderLevels}</h3>
        <p className="trader-levels-hint">{t.traderLevelsHint}</p>
        <button type="button" className="btn-icon-close" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </div>
      <div className="trader-levels">
        {traders.map((trader) => (
          <label key={trader.id}>
            <span>{trader.name}</span>
            <input
              type="number"
              min={1}
              max={4}
              value={traderLevels[trader.id] ?? DEFAULT_TRADER_LOYALTY}
              onChange={(e) => onChange(trader.id, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
