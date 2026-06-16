import { useRef, useState } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';

interface TaskPrereqTooltipProps {
  prereqName: string;
  statusLabel: string;
  task: Task | undefined;
  prereqState: TaskProgressState;
  t: Translations;
  locale: string;
}

export function TaskPrereqTooltip({
  prereqName,
  statusLabel,
  task,
  prereqState,
  t,
  locale,
}: TaskPrereqTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const show = () => {
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({ x: rect.left - 8, y: rect.top + rect.height / 2 });
    }
    setOpen(true);
  };

  return (
    <span
      className="prereq-link-wrap"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
    >
      <button ref={triggerRef} type="button" className="prereq-link-trigger">
        {prereqName}
        <span className="req-status"> ({statusLabel})</span>
      </button>

      {open && task && (
        <div
          className="task-preview-tooltip"
          role="tooltip"
          style={{ left: pos.x, top: pos.y }}
        >
          <header className="tooltip-header">
            <span className={`state-badge state-${prereqState}`}>{t.state[prereqState]}</span>
            <strong className="tooltip-title">{task.name}</strong>
            <span className="tooltip-trader">{task.trader.name}</span>
          </header>

          <div className="tooltip-stats">
            <span><strong>XP</strong> {task.experience.toLocaleString(locale)}</span>
            {task.minPlayerLevel != null && (
              <span><strong>{t.minLevel}</strong> {task.minPlayerLevel}</span>
            )}
            {task.map && <span>{task.map.name}</span>}
          </div>

          {task.objectives.length > 0 && (
            <div className="tooltip-section">
              <span className="tooltip-section-title">{t.objectives}</span>
              <ol className="tooltip-objectives">
                {task.objectives.slice(0, 6).map((obj) => (
                  <li key={obj.id} className={obj.optional ? 'optional' : ''}>
                    {obj.description}
                    {obj.optional && <span className="optional-tag"> {t.optional}</span>}
                  </li>
                ))}
                {task.objectives.length > 6 && (
                  <li className="tooltip-more">+{task.objectives.length - 6}</li>
                )}
              </ol>
            </div>
          )}

          {task.finishRewards?.items && task.finishRewards.items.length > 0 && (
            <div className="tooltip-section">
              <span className="tooltip-section-title">{t.rewards}</span>
              <ul className="tooltip-rewards">
                {task.finishRewards.items.slice(0, 4).map((r, i) => (
                  <li key={i}>
                    {r.count}x {r.item.shortName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
