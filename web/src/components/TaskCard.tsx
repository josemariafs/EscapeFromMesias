import type { CSSProperties } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import { getTraderImagePath } from '../utils/traderImages';
import { getQuestItemRequirements, getRequiredLoyaltyLevel } from '../utils/unlock';
import { getMapGroupLabel } from '../utils/maps';

interface TaskCardProps {
  task: Task;
  state: TaskProgressState;
  selected: boolean;
  t: Translations;
  onSelect: () => void;
  onStart: () => void;
  onComplete: () => void;
  onReset: () => void;
  /** true si el estado viene de un evento real detectado en los logs (modo Logs): no editable. */
  locked?: boolean;
  /** false en modo Logs: no mostrar botones de progreso. */
  showActions?: boolean;
}

export function TaskCard({
  task,
  state,
  selected,
  t,
  onSelect,
  onStart,
  onComplete,
  onReset,
  locked = false,
  showActions = true,
}: TaskCardProps) {
  const requiredItems = getQuestItemRequirements(task);
  const traderImage = getTraderImagePath(task.trader);
  const loyaltyLevel = getRequiredLoyaltyLevel(task);

  const cardStyle = traderImage
    ? ({ '--trader-image': `url("${traderImage}")` } as CSSProperties)
    : undefined;

  const isCollector =
    task.normalizedName === 'collector' || task.name.toLowerCase() === 'collector';

  return (
    <article
      className={`task-card state-${state}${selected ? ' selected' : ''}${traderImage ? ' has-trader-bg' : ''}${isCollector ? ' task-card-collector' : ''}`}
      style={cardStyle}
      aria-label={`${task.name} — ${t.state[state]}`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {task.kappaRequired && (
        <span className="kappa-corner" title={t.kappaRequired}>{t.kappa}</span>
      )}

      <div className="task-card-header">
        <span className={`state-badge state-${state}`}>{t.state[state]}</span>
        {loyaltyLevel > 0 && (
          <span className="loyalty-badge" title={t.traderReqs}>
            {t.loyaltyShort(loyaltyLevel)}
          </span>
        )}
      </div>

      <h3 className="task-name">{task.name}</h3>

      <div className="task-meta">
        <span className="trader-tag">{task.trader.name}</span>
        {task.map && <span className="map-tag">{getMapGroupLabel(task.map)}</span>}
      </div>

      {requiredItems.length > 0 && (
        <div className="task-keys">
          {requiredItems.map((req, index) => {
            const chipLabel = req.groupLabel
              ?? (req.anyItem ? t.anyItem : req.item!.shortName);
            const chipTitle = req.groupLabel
              ?? (req.anyItem ? t.anyItem : req.item!.name);
            const chipKey = req.groupLabel
              ?? (req.anyItem ? `any-item-${index}` : req.item!.id);

            return (
            <span
              key={chipKey}
              className="key-chip"
              title={chipTitle}
            >
              {!req.anyItem && !req.groupLabel && req.item!.iconLink && (
                <img src={req.item!.iconLink} alt="" />
              )}
              {req.count != null && req.count > 1 ? `${req.count}x ` : ''}
              {chipLabel}
            </span>
            );
          })}
        </div>
      )}

      {showActions && (state === 'available' || state === 'started' || state === 'completed' || state === 'failed') && (
        <div className={`task-actions${locked ? ' log-locked' : ''}`}>
          {state === 'available' && (
            <button
              type="button"
              className="btn btn-start"
              disabled={locked}
              title={locked ? t.logLockedHint : undefined}
              onClick={onStart}
            >
              {t.start}
            </button>
          )}
          {state === 'started' && (
            <button
              type="button"
              className="btn btn-complete"
              disabled={locked}
              title={locked ? t.logLockedHint : undefined}
              onClick={onComplete}
            >
              {t.complete}
            </button>
          )}
          {(state === 'started' || state === 'completed' || state === 'failed') && (
            <button
              type="button"
              className="btn btn-reset btn-icon"
              title={locked ? t.logLockedHint : t.reset}
              aria-label={t.reset}
              disabled={locked}
              onClick={onReset}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M13.5 8a5.5 5.5 0 1 1-1.86-4.12M13.5 1.5v3.5H10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
