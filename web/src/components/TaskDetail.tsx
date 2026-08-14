import { useEffect, useMemo, useState } from 'react';
import type { CustomMapMarkers, Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import { getRequiredKeys, getRequiredLoyaltyLevel } from '../utils/unlock';
import { getCompletedObjectiveSet } from '../utils/objectives';
import { getMapSvgUrl, getTarkovDevMapUrl } from '../utils/maps';
import { getTaskMapLocations } from '../utils/mapMarkers';
import { TaskPrereqTooltip } from './TaskPrereqTooltip';
import { MapViewerModal } from './MapViewerModal';

interface TaskDetailProps {
  task: Task | null;
  state: TaskProgressState;
  tasksById: Map<string, Task>;
  taskStates: Record<string, TaskProgressState>;
  completedObjectives: Record<string, string[]>;
  customMapMarkers?: CustomMapMarkers;
  t: Translations;
  locale: string;
  onStart: () => void;
  onComplete: () => void;
  onReset: () => void;
  onToggleObjective: (objectiveId: string) => void;
  /** En modo Logs: estado detectado literalmente en los logs para esta misión (null = no detectado). */
  isLogsMode?: boolean;
  logRawState?: TaskProgressState | null;
}

export function TaskDetail({
  task,
  state,
  tasksById,
  taskStates,
  completedObjectives,
  customMapMarkers = {},
  t,
  locale,
  onStart,
  onComplete,
  onReset,
  onToggleObjective,
  isLogsMode = false,
  logRawState = null,
}: TaskDetailProps) {
  const [openMapKey, setOpenMapKey] = useState<string | null>(null);
  const [openAccordionMaps, setOpenAccordionMaps] = useState<Set<string>>(() => new Set());

  const mapLocations = useMemo(
    () => (task ? getTaskMapLocations(task, customMapMarkers) : []),
    [task, customMapMarkers],
  );

  const useMapAccordion = mapLocations.length >= 3;
  const firstAccordionMapKey = useMapAccordion ? mapLocations[0]?.mapKey ?? null : null;

  const openMapLocation = useMemo(
    () => mapLocations.find((entry) => entry.mapKey === openMapKey) ?? null,
    [mapLocations, openMapKey],
  );
  const openMapUrl = openMapLocation ? getMapSvgUrl(openMapLocation.mapKey) : null;

  useEffect(() => {
    setOpenMapKey(null);
    setOpenAccordionMaps(firstAccordionMapKey ? new Set([firstAccordionMapKey]) : new Set());
  }, [task?.id, firstAccordionMapKey]);

  if (!task) {
    return (
      <aside className="task-detail empty">
        <p>{t.selectTask}</p>
      </aside>
    );
  }

  const keys = getRequiredKeys(task);
  const doneObjectives = getCompletedObjectiveSet(completedObjectives, task.id);
  const canTrackObjectives = !isLogsMode && (state === 'started' || state === 'completed');
  const loyaltyLevel = getRequiredLoyaltyLevel(task);

  return (
    <aside className="task-detail">
      <header className="detail-header">
        <div className="detail-header-main">
          <span className={`state-badge state-${state}`}>{t.state[state]}</span>
          <h2>{task.name}</h2>
          <p className="detail-trader">
            {task.trader.name}
            {loyaltyLevel > 0 ? ` · ${t.loyaltyShort(loyaltyLevel)}` : ''}
          </p>
          {isLogsMode && (
            <p className={`log-detection-hint${logRawState ? '' : ' log-detection-hint--warn'}`}>
              {logRawState ? t.logStateDetected(t.state[logRawState]) : t.logStateNotDetected}
            </p>
          )}
        </div>
        {task.wikiLink && (
          <a
            className="wiki-btn"
            href={task.wikiLink}
            target="_blank"
            rel="noreferrer"
            title={t.viewWiki}
          >
            <span className="wiki-btn-label">{t.viewWikiOn}</span>
            <span className="wiki-btn-brand">WIKI</span>
          </a>
        )}
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

      {mapLocations.length > 0 && (
        <section className="detail-map-section" aria-label={t.taskDetailMapLocations}>
          <h3>{t.taskDetailMapLocations}</h3>
          <div className={`detail-map-list${useMapAccordion ? ' detail-map-list--accordion' : ''}`}>
            {mapLocations.map((location) => {
              const mapUrl = getMapSvgUrl(location.mapKey);
              if (!mapUrl) return null;

              const card = (
                <button
                  type="button"
                  className="detail-map-card"
                  onClick={() => setOpenMapKey(location.mapKey)}
                  title={t.taskDetailOpenMap}
                >
                  <div className="detail-map-card-head">
                    <strong>{location.mapName}</strong>
                    <span>{t.taskDetailOpenMap}</span>
                  </div>
                  <div className="detail-map-preview">
                    <div className="detail-map-preview-frame">
                      <img src={mapUrl} alt="" draggable={false} />
                      {location.markers.map((marker) => (
                        <span
                          key={marker.id}
                          className={`detail-map-pin${marker.custom ? ' detail-map-pin--custom' : ''}`}
                          style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
                          title={marker.objectiveDescription || t.mapMarkerManual}
                        />
                      ))}
                    </div>
                  </div>
                </button>
              );

              if (!useMapAccordion) {
                return <div key={location.mapKey}>{card}</div>;
              }

              return (
                <details
                  key={`${task.id}:${location.mapKey}`}
                  className="detail-map-accordion"
                  open={openAccordionMaps.has(location.mapKey)}
                  onToggle={(event) => {
                    const isOpen = event.currentTarget.open;
                    setOpenAccordionMaps((prev) => {
                      const next = new Set(prev);
                      if (isOpen) next.add(location.mapKey);
                      else next.delete(location.mapKey);
                      return next;
                    });
                  }}
                >
                  <summary className="detail-map-accordion-summary">
                    <span className="detail-map-accordion-title">{location.mapName}</span>
                    <span className="detail-map-accordion-meta">
                      {t.taskDetailMapMarkerCount(location.markers.length)}
                    </span>
                  </summary>
                  <div className="detail-map-accordion-body">{card}</div>
                </details>
              );
            })}
          </div>
        </section>
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
          </ul>
        </section>
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
          {task.objectives.map((obj) => {
            const isDone = doneObjectives.has(obj.id);
            const showCheck = canTrackObjectives && !obj.optional;

            return (
              <li
                key={obj.id}
                className={`objective-item${obj.optional ? ' optional' : ''}${isDone ? ' done' : ''}`}
              >
                {showCheck ? (
                  <label className="objective-check">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => onToggleObjective(obj.id)}
                      aria-label={isDone ? t.objectiveDone : t.objectivePending}
                    />
                    <span className="objective-body">
                      <span className="obj-type">{obj.type}</span>
                      {obj.description}
                      {obj.maps.length > 0 && (
                        <span className="obj-maps">
                          {' '}({obj.maps.map((m) => m.name).join(', ')})
                        </span>
                      )}
                      {obj.foundInRaid && <span className="fir-tag"> FiR</span>}
                    </span>
                  </label>
                ) : (
                  <span className="objective-body">
                    <span className="obj-type">{obj.type}</span>
                    {obj.description}
                    {obj.maps.length > 0 && (
                      <span className="obj-maps">
                        {' '}({obj.maps.map((m) => m.name).join(', ')})
                      </span>
                    )}
                    {obj.foundInRaid && <span className="fir-tag"> FiR</span>}
                    {obj.optional && <span className="optional-tag"> {t.optional}</span>}
                  </span>
                )}
              </li>
            );
          })}
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

      {!isLogsMode && (
      <div className="detail-actions">
        {state === 'available' && (
          <button
            type="button"
            className="btn btn-start"
            onClick={onStart}
          >
            {t.markStarted}
          </button>
        )}
        {state === 'started' && (
          <button
            type="button"
            className="btn btn-complete"
            onClick={onComplete}
          >
            {t.markCompleted}
          </button>
        )}
        {(state === 'started' || state === 'completed' || state === 'failed') && (
          <button
            type="button"
            className="btn btn-reset"
            onClick={onReset}
          >
            {t.resetProgress}
          </button>
        )}
        {state === 'locked' && (
          <p className="locked-hint">{t.lockedHint}</p>
        )}
      </div>
      )}
      {isLogsMode && state === 'locked' && (
        <p className="locked-hint">{t.lockedHint}</p>
      )}

      {openMapLocation && openMapUrl && (
        <MapViewerModal
          mapName={openMapLocation.mapName}
          mapKey={openMapLocation.mapKey}
          mapUrl={openMapUrl}
          mapTasks={[task]}
          completedObjectives={completedObjectives}
          customMapMarkers={customMapMarkers}
          tarkovDevUrl={getTarkovDevMapUrl(openMapLocation.mapKey)}
          t={t}
          onClose={() => setOpenMapKey(null)}
          onSetCustomMapMarker={() => undefined}
          onClearCustomMapMarker={() => undefined}
        />
      )}
    </aside>
  );
}
