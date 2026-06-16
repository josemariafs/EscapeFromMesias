import type { CSSProperties } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import { getTraderImagePath } from '../utils/traderImages';
import { getQuestItemRequirements } from '../utils/unlock';

interface TaskCardProps {
  task: Task;
  state: TaskProgressState;
  selected: boolean;
  t: Translations;
  onSelect: () => void;
  onStart: () => void;
  onComplete: () => void;
  onReset: () => void;
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
}: TaskCardProps) {
  const requiredItems = getQuestItemRequirements(task);
  const traderImage = getTraderImagePath(task.trader);

  const cardStyle = traderImage
    ? ({ '--trader-image': `url("${traderImage}")` } as CSSProperties)
    : undefined;

  const isCollector =
    task.normalizedName === 'collector' || task.name.toLowerCase() === 'collector';

  return (
    <article
      className={`task-card state-${state}${selected ? ' selected' : ''}${traderImage ? ' has-trader-bg' : ''}${isCollector ? ' task-card-collector' : ''}`}
      style={cardStyle}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      {task.kappaRequired && (
        <span className="kappa-corner" title={t.kappaRequired}>{t.kappa}</span>
      )}

      <div className="task-card-header">
        <span className={`state-badge state-${state}`}>{t.state[state]}</span>
      </div>

      <h3 className="task-name">{task.name}</h3>

      {task.map && (
        <div className="task-meta">
          <span className="map-tag">{task.map.name}</span>
        </div>
      )}

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

      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
        {state === 'available' && (
          <button type="button" className="btn btn-start" onClick={onStart}>
            {t.start}
          </button>
        )}
        {state === 'started' && (
          <button type="button" className="btn btn-complete" onClick={onComplete}>
            {t.complete}
          </button>
        )}
        {(state === 'started' || state === 'completed' || state === 'failed') && (
          <button type="button" className="btn btn-reset" onClick={onReset}>
            {t.reset}
          </button>
        )}
      </div>
    </article>
  );
}
