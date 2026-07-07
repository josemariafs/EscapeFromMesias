import type { TaskProgressState } from '../types';
import type { StoryNodeFlat } from '../types/storyline';
import type { Translations } from '../i18n/translations';

interface StoryNodeCardProps {
  node: StoryNodeFlat;
  state: TaskProgressState;
  selected: boolean;
  requirementNames: string[];
  t: Translations;
  onSelect: () => void;
  onStart: () => void;
  onComplete: () => void;
  onReset: () => void;
}

export function StoryNodeCard({
  node,
  state,
  selected,
  requirementNames,
  t,
  onSelect,
  onStart,
  onComplete,
  onReset,
}: StoryNodeCardProps) {
  return (
    <article
      className={`task-card story-node-card state-${state}${selected ? ' selected' : ''}`}
      aria-label={`${node.name} — ${t.state[state]}`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="task-card-header">
        <span className={`state-badge state-${state}`}>{t.state[state]}</span>
        {node.type !== 'default' && (
          <span className={`story-type-badge type-${node.type}`}>
            {t.storyNodeType[node.type]}
          </span>
        )}
      </div>

      <h3 className="task-name">{node.name}</h3>

      <div className="task-meta">
        <span className="chapter-tag">{node.chapterTitle}</span>
      </div>

      {requirementNames.length > 0 && (
        <p className="task-prereqs">
          {t.requires} {requirementNames.join(', ')}
        </p>
      )}

      {node.items && node.items.length > 0 && (
        <ul className="story-item-hints">
          {node.items.slice(0, 3).map((item) => (
            <li key={item.name}>{item.name}</li>
          ))}
          {node.items.length > 3 && (
            <li className="story-item-more">+{node.items.length - 3}</li>
          )}
        </ul>
      )}

      {(state === 'available' || state === 'started' || state === 'completed') && (
        <div className="task-actions">
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
          {(state === 'started' || state === 'completed') && (
            <button
              type="button"
              className="btn btn-reset btn-icon"
              title={t.reset}
              aria-label={t.reset}
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
