import type { TaskProgressState } from '../types';
import type { StoryNodeFlat } from '../types/storyline';
import type { Translations } from '../i18n/translations';

interface StoryDetailProps {
  node: StoryNodeFlat | null;
  chapterDesc: string | null;
  state: TaskProgressState;
  requirementNames: string[];
  t: Translations;
  onStart: () => void;
  onComplete: () => void;
  onReset: () => void;
}

export function StoryDetail({
  node,
  chapterDesc,
  state,
  requirementNames,
  t,
  onStart,
  onComplete,
  onReset,
}: StoryDetailProps) {
  if (!node) {
    return (
      <aside className="task-detail empty">
        <p>{t.selectStoryNode}</p>
      </aside>
    );
  }

  return (
    <aside className="task-detail story-detail">
      <div className="detail-header">
        <span className={`state-badge state-${state}`}>{t.state[state]}</span>
        <h2>{node.name}</h2>
        <p className="detail-trader">{node.chapterTitle}</p>
      </div>

      {chapterDesc && (
        <p className="story-chapter-desc">{chapterDesc}</p>
      )}

      <div className="detail-stats">
        <span><strong>{t.storyNodeKind}</strong> {t.storyNodeType[node.type]}</span>
      </div>

      {requirementNames.length > 0 && (
        <section>
          <h3>{t.prevQuests}</h3>
          <ul>
            {requirementNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      )}

      {node.items && node.items.length > 0 && (
        <section>
          <h3>{t.storyItems}</h3>
          <ul className="story-items-list">
            {node.items.map((item) => (
              <li key={item.name}>
                {item.name}
                {item.fir && <span className="fir-tag">FIR</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="detail-actions">
        {state === 'locked' && (
          <p className="locked-hint">{t.lockedHint}</p>
        )}
        {state === 'available' && (
          <button type="button" className="btn btn-start" onClick={onStart}>
            {t.markStarted}
          </button>
        )}
        {state === 'started' && (
          <button type="button" className="btn btn-complete" onClick={onComplete}>
            {t.markCompleted}
          </button>
        )}
        {(state === 'started' || state === 'completed') && (
          <button type="button" className="btn btn-reset" onClick={onReset}>
            {t.resetProgress}
          </button>
        )}
      </div>
    </aside>
  );
}
