import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import { groupTasksByMap } from '../utils/maps';
import { TaskCard } from './TaskCard';

interface ActiveTasksViewProps {
  tasks: Task[];
  taskStates: Record<string, TaskProgressState>;
  selectedId: string | null;
  t: Translations;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onReset: (id: string) => void;
}

export function ActiveTasksView({
  tasks,
  taskStates,
  selectedId,
  t,
  onSelect,
  onStart,
  onComplete,
  onReset,
}: ActiveTasksViewProps) {
  const activeTasks = tasks.filter((task) => taskStates[task.id] === 'started');
  const groups = groupTasksByMap(activeTasks, t.anyMap);

  if (activeTasks.length === 0) {
    return <p className="empty-list">{t.noActiveTasks}</p>;
  }

  return (
    <div className="active-tasks-view">
      {groups.map(({ map, tasks: mapTasks }) => (
        <section key={map.normalizedName} className="map-section">
          <header className="map-section-header">
            <h2>{map.name}</h2>
            <span className="map-count">{t.activeByMap(mapTasks.length)}</span>
          </header>
          <div className="map-section-grid">
            {mapTasks.map((task) => {
              const state = taskStates[task.id] ?? 'locked';
              return (
                <TaskCard
                  key={`${map.normalizedName}-${task.id}`}
                  task={task}
                  state={state}
                  selected={selectedId === task.id}
                  t={t}
                  onSelect={() => onSelect(task.id)}
                  onStart={() => onStart(task.id)}
                  onComplete={() => onComplete(task.id)}
                  onReset={() => onReset(task.id)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
