import { useState } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import { groupActiveTasksByMap } from '../utils/objectives';
import {
  ANY_MAP_ID,
  getMapSvgUrl,
  getTarkovDevMapUrl,
} from '../utils/maps';
import { MapViewerModal } from './MapViewerModal';
import { TaskCard } from './TaskCard';

interface ActiveTasksViewProps {
  tasks: Task[];
  taskStates: Record<string, TaskProgressState>;
  completedObjectives: Record<string, string[]>;
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
  completedObjectives,
  selectedId,
  t,
  onSelect,
  onStart,
  onComplete,
  onReset,
}: ActiveTasksViewProps) {
  const [openMap, setOpenMap] = useState<{
    normalizedName: string;
    name: string;
  } | null>(null);

  const activeTasks = tasks.filter((task) => taskStates[task.id] === 'started');
  const groups = groupActiveTasksByMap(activeTasks, completedObjectives, t.anyMap);

  const openMapViewer = (normalizedName: string, name: string) => {
    const svgUrl = getMapSvgUrl(normalizedName);
    if (svgUrl) {
      setOpenMap({ normalizedName, name });
      return;
    }
    window.open(getTarkovDevMapUrl(normalizedName), '_blank', 'noopener,noreferrer');
  };

  if (activeTasks.length === 0) {
    return <p className="empty-list">{t.noActiveTasks}</p>;
  }

  if (groups.length === 0) {
    return <p className="empty-list">{t.noActiveTasks}</p>;
  }

  const openMapSvgUrl = openMap ? getMapSvgUrl(openMap.normalizedName) : null;

  return (
    <div className="active-tasks-view">
      {openMap && openMapSvgUrl && (
        <MapViewerModal
          mapName={openMap.name}
          mapUrl={openMapSvgUrl}
          tarkovDevUrl={getTarkovDevMapUrl(openMap.normalizedName)}
          t={t}
          onClose={() => setOpenMap(null)}
        />
      )}
      {groups.map(({ map, tasks: mapTasks }) => (
        <section key={map.normalizedName} className="map-section">
          <header className="map-section-header">
            <h2>{map.name}</h2>
            <span className="map-count">{t.activeByMap(mapTasks.length)}</span>
            {map.normalizedName !== ANY_MAP_ID && (
              <button
                type="button"
                className="btn btn-ghost btn-map"
                onClick={() => openMapViewer(map.normalizedName, map.name)}
              >
                {t.viewMap}
              </button>
            )}
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
