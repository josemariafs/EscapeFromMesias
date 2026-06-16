import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import { getRequiredKeys } from '../utils/unlock';
import { TaskPrereqTooltip } from './TaskPrereqTooltip';
interface TaskDetailProps {
  task: Task | null;
  state: TaskProgressState;
  tasksById: Map<string, Task>;
  taskStates: Record<string, TaskProgressState>;
  t: Translations;
  locale: string;
  onStart: () => void;
  onComplete: () => void;
  onReset: () => void;
}

export function TaskDetail({
  task,
  state,
  tasksById,
  taskStates,
  t,
  locale,
  onStart,
  onComplete,
  onReset,
}: TaskDetailProps) {
  if (!task) {
    return (
      <aside className="task-detail empty">
        <p>{t.selectTask}</p>
      </aside>
    );
  }

  const keys = getRequiredKeys(task);

  return (
    <aside className="task-detail">
      <header className="detail-header">
        <span className={`state-badge state-${state}`}>{t.state[state]}</span>
        <h2>{task.name}</h2>
        <p className="detail-trader">{task.trader.name}</p>
      </header>

      <div className="detail-stats">
        <div><strong>XP</strong> {task.experience.toLocaleString(locale)}</div>
        {task.minPlayerLevel != null && (
          <div><strong>{t.minLevel}</strong> {task.minPlayerLevel}</div>
        )}
        {task.factionName && task.factionName !== 'Any' && (
          <div><strong>{t.faction}</strong> {task.factionName}</div>
        )}
        {task.kappaRequired && <div className="kappa-line">{t.kappaRequired}</div>}
      </div>

      {task.wikiLink && (
        <a className="wiki-link" href={task.wikiLink} target="_blank" rel="noreferrer">
          {t.viewWiki}
        </a>
      )}

      {task.taskRequirements.length > 0 && (
        <section>
          <h3>{t.prevQuests}</h3>
          <ul className="prev-quests-list">
            {task.taskRequirements.map((req) => (
              <li key={req.task.id}>
                <TaskPrereqTooltip
                  prereqName={req.task.name}
                  statusLabel={req.status.join(' / ')}
                  task={tasksById.get(req.task.id)}
                  prereqState={taskStates[req.task.id] ?? 'locked'}
                  t={t}
                  locale={locale}
                />
              </li>
            ))}
          </ul>        </section>
      )}

      {task.traderRequirements.length > 0 && (
        <section>
          <h3>{t.traderReqs}</h3>
          <ul>
            {task.traderRequirements.map((req, i) => (
              <li key={i}>
                {req.trader.name}: {req.requirementType === 'reputation' ? t.reputation : t.level}{' '}
                {req.compareMethod} {req.value}
              </li>
            ))}
          </ul>
        </section>
      )}

      {keys.length > 0 && (
        <section>
          <h3>{t.requiredKeys}</h3>
          <div className="keys-grid">
            {keys.map((k) => (
              <div key={k.id} className="key-item">
                {k.iconLink && <img src={k.iconLink} alt="" />}
                <span>{k.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3>{t.objectives}</h3>
        <ol className="objectives-list">
          {task.objectives.map((obj) => (
            <li key={obj.id} className={obj.optional ? 'optional' : ''}>
              <span className="obj-type">{obj.type}</span>
              {obj.description}
              {obj.maps.length > 0 && (
                <span className="obj-maps">
                  {' '}({obj.maps.map((m) => m.name).join(', ')})
                </span>
              )}
              {obj.foundInRaid && <span className="fir-tag"> FiR</span>}
              {obj.optional && <span className="optional-tag"> {t.optional}</span>}
            </li>
          ))}
        </ol>
      </section>

      {task.finishRewards && (task.finishRewards.items?.length || task.finishRewards.traderStanding?.length) ? (
        <section>
          <h3>{t.rewards}</h3>
          {task.finishRewards.traderStanding && (
            <ul>
              {task.finishRewards.traderStanding.map((s, i) => (
                <li key={i}>
                  {s.trader.name}: +{s.standing} {t.reputation}
                </li>
              ))}
            </ul>
          )}
          {task.finishRewards.items && (
            <ul className="rewards-list">
              {task.finishRewards.items.map((r, i) => (
                <li key={i}>
                  {r.item.iconLink && <img src={r.item.iconLink} alt="" />}
                  {r.count}x {r.item.shortName}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="detail-actions">
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
        {(state === 'started' || state === 'completed' || state === 'failed') && (
          <button type="button" className="btn btn-reset" onClick={onReset}>
            {t.resetProgress}
          </button>
        )}
        {state === 'locked' && (
          <p className="locked-hint">{t.lockedHint}</p>
        )}
      </div>
    </aside>
  );
}
