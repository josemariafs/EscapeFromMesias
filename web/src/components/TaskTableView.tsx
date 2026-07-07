import { useMemo, useState, type CSSProperties } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import { getTraderImagePath } from '../utils/traderImages';
import { getQuestItemRequirements } from '../utils/unlock';

interface TaskTableViewProps {
  tasks: Task[];
  taskStates: Record<string, TaskProgressState>;
  selectedId: string | null;
  t: Translations;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onReset: (id: string) => void;
}

export function TaskTableView({
  tasks,
  taskStates,
  selectedId,
  t,
  onSelect,
  onStart,
  onComplete,
  onReset,
}: TaskTableViewProps) {
  const [lockedExpanded, setLockedExpanded] = useState(false);

  const buckets = useMemo(() => {
    const started: Task[] = [];
    const available: Task[] = [];
    const completed: Task[] = [];
    const lockedFailed: Task[] = [];

    for (const task of tasks) {
      const state = taskStates[task.id] ?? 'locked';
      switch (state) {
        case 'started':
          started.push(task);
          break;
        case 'available':
          available.push(task);
          break;
        case 'completed':
          completed.push(task);
          break;
        default:
          lockedFailed.push(task);
      }
    }

    const byName = (a: Task, b: Task) => a.name.localeCompare(b.name);
    started.sort(byName);
    available.sort(byName);
    completed.sort(byName);
    lockedFailed.sort(byName);

    return { started, available, completed, lockedFailed };
  }, [tasks, taskStates]);

  const rowProps = { taskStates, selectedId, t, onSelect, onStart, onComplete, onReset };

  return (
    <div className="task-table-view">
      <div className="task-table-top">
        <TaskTableSection title={t.tableSectionActive} state="started" tasks={buckets.started} {...rowProps} />
        <TaskTableSection
          title={t.tableSectionAvailable}
          state="available"
          tasks={buckets.available}
          {...rowProps}
        />
      </div>

      <div className="task-table-bottom">
        <TaskTableSection
          title={t.tableSectionCompleted}
          state="completed"
          tasks={buckets.completed}
          {...rowProps}
        />
      </div>

      <details
        className="task-table-collapsible"
        open={lockedExpanded}
        onToggle={(e) => setLockedExpanded((e.target as HTMLDetailsElement).open)}
      >
        <summary>{t.tableSectionLocked(buckets.lockedFailed.length)}</summary>
        <TaskTableSection tasks={buckets.lockedFailed} {...rowProps} />
      </details>
    </div>
  );
}

export interface TaskTableSectionProps {
  title?: string;
  state?: TaskProgressState;
  showMapColumn?: boolean;
  tasks: Task[];
  taskStates: Record<string, TaskProgressState>;
  selectedId: string | null;
  t: Translations;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onReset: (id: string) => void;
}

type SortColumn = 'name' | 'map' | 'trader';
type SortDirection = 'asc' | 'desc';

function getSortValue(task: Task, column: SortColumn, t: Translations): string {
  switch (column) {
    case 'map':
      return task.map ? task.map.name : t.anyMap;
    case 'trader':
      return task.trader.name;
    default:
      return task.name;
  }
}

export function TaskTableSection({
  title,
  state,
  showMapColumn = true,
  tasks,
  taskStates,
  selectedId,
  t,
  onSelect,
  onStart,
  onComplete,
  onReset,
}: TaskTableSectionProps) {
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'name',
    direction: 'asc',
  });

  const sortedTasks = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...tasks].sort(
      (a, b) => getSortValue(a, sort.column, t).localeCompare(getSortValue(b, sort.column, t)) * factor,
    );
  }, [tasks, sort, t]);

  const toggleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' },
    );
  };

  const sortAriaValue = (column: SortColumn): 'ascending' | 'descending' | 'none' => {
    if (sort.column !== column) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortArrow = (column: SortColumn) =>
    sort.column === column && (
      <span className="task-table-sort-arrow">{sort.direction === 'asc' ? '▲' : '▼'}</span>
    );

  return (
    <div className="task-table-section">
      {title && (
        <h3 className="task-table-section-title">
          {title}
          {state && <span className={`state-badge state-${state}`}>{t.state[state]}</span>}
          <span className="task-table-section-count">{tasks.length}</span>
        </h3>
      )}
      {tasks.length === 0 ? (
        <p className="task-table-empty">{t.tableNoTasks}</p>
      ) : (
        <div className="task-table-scroll">
          <table className="task-table">
            <thead>
              <tr>
                <th
                  className="task-table-sortable"
                  aria-sort={sortAriaValue('name')}
                  onClick={() => toggleSort('name')}
                >
                  {t.tableColName}
                  {renderSortArrow('name')}
                </th>
                {showMapColumn && (
                  <th
                    className="task-table-sortable"
                    aria-sort={sortAriaValue('map')}
                    onClick={() => toggleSort('map')}
                  >
                    {t.tableColMap}
                    {renderSortArrow('map')}
                  </th>
                )}
                <th>{t.tableColItems}</th>
                <th>{t.tableColActions}</th>
                <th
                  className="task-table-col-trader task-table-sortable"
                  aria-sort={sortAriaValue('trader')}
                  onClick={() => toggleSort('trader')}
                >
                  {t.tableColTrader}
                  {renderSortArrow('trader')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task) => (
                <TaskTableRow
                  key={task.id}
                  task={task}
                  state={taskStates[task.id] ?? 'locked'}
                  selected={selectedId === task.id}
                  showMapColumn={showMapColumn}
                  t={t}
                  onSelect={() => onSelect(task.id)}
                  onStart={() => onStart(task.id)}
                  onComplete={() => onComplete(task.id)}
                  onReset={() => onReset(task.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface TaskTableRowProps {
  task: Task;
  state: TaskProgressState;
  selected: boolean;
  showMapColumn?: boolean;
  t: Translations;
  onSelect: () => void;
  onStart: () => void;
  onComplete: () => void;
  onReset: () => void;
}

function TaskTableRow({
  task,
  state,
  selected,
  showMapColumn = true,
  t,
  onSelect,
  onStart,
  onComplete,
  onReset,
}: TaskTableRowProps) {
  const requiredItems = getQuestItemRequirements(task);
  const traderImage = getTraderImagePath(task.trader);

  const traderCellStyle = traderImage
    ? ({ '--trader-image': `url("${traderImage}")` } as CSSProperties)
    : undefined;

  return (
    <tr
      className={`task-table-row state-${state}${selected ? ' selected' : ''}`}
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
      <td className="task-table-cell-name">
        <span className="task-table-name">
          {task.name}
          {task.kappaRequired && (
            <span className="task-table-kappa" title={t.kappaRequired}>
              {t.kappa}
            </span>
          )}
        </span>
      </td>
      {showMapColumn && <td>{task.map ? task.map.name : t.anyMap}</td>}
      <td className="task-table-cell-items">
        {requiredItems.length === 0 ? (
          '—'
        ) : (
          <div className="task-keys">
            {requiredItems.map((req, index) => {
              const chipLabel = req.groupLabel ?? (req.anyItem ? t.anyItem : req.item!.shortName);
              const chipTitle = req.groupLabel ?? (req.anyItem ? t.anyItem : req.item!.name);
              const chipKey = req.groupLabel ?? (req.anyItem ? `any-item-${index}` : req.item!.id);

              return (
                <span key={chipKey} className="key-chip" title={chipTitle}>
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
      </td>
      <td className="task-table-cell-actions">
        <div className="task-table-actions-inner">
          {state === 'available' && (
            <button
              type="button"
              className="btn btn-start"
              onClick={(e) => {
                e.stopPropagation();
                onStart();
              }}
            >
              {t.start}
            </button>
          )}
          {state === 'started' && (
            <button
              type="button"
              className="btn btn-complete"
              onClick={(e) => {
                e.stopPropagation();
                onComplete();
              }}
            >
              {t.complete}
            </button>
          )}
          {(state === 'started' || state === 'completed' || state === 'failed') && (
            <button
              type="button"
              className="btn btn-reset btn-icon"
              title={t.reset}
              aria-label={t.reset}
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
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
      </td>
      <td
        className={`task-table-cell-trader${traderImage ? ' has-trader-bg' : ''}`}
        style={traderCellStyle}
        title={task.trader.name}
        aria-label={task.trader.name}
      />
    </tr>
  );
}
