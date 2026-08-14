import { useState } from 'react';
import type { CustomMapMarkers, CustomMapMarkerPin, Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import type {
  FixedRouteMapsData,
  RouteArrowsData,
  RouteColorLabels,
  RouteMapsData,
} from '../types/routes';
import type { MapExtractsData } from '../utils/mapExtracts';
import { groupActiveTasksByMap, groupTasksByMap } from '../utils/objectives';
import {
  ANY_MAP_ID,
  getMapSvgUrl,
  getTarkovDevMapUrl,
} from '../utils/maps';
import { MapViewerModal } from './MapViewerModal';
import { TaskCard } from './TaskCard';
import { TaskTableSection } from './TaskTableView';

export type TasksListMode = 'started' | 'completed';

interface ActiveTasksViewProps {
  tasks: Task[];
  taskStates: Record<string, TaskProgressState>;
  completedObjectives: Record<string, string[]>;
  customMapMarkers: CustomMapMarkers;
  routeMaps?: RouteMapsData;
  routeArrows?: RouteArrowsData;
  routeDrawColor?: string;
  fixedRouteMaps?: FixedRouteMapsData;
  mapExtracts?: MapExtractsData;
  routeColorLabels?: RouteColorLabels;
  selectedId: string | null;
  t: Translations;
  isTable?: boolean;
  /** `started` = Activas; `completed` = Completadas. */
  listMode?: TasksListMode;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onReset: (id: string) => void;
  onSetCustomMapMarker: (mapKey: string, taskId: string, pin: CustomMapMarkerPin) => void;
  onClearCustomMapMarker: (mapKey: string, taskId: string) => void;
  onAddRoutePoint?: (mapKey: string, left: number, top: number) => void;
  onRemoveRoutePoint?: (mapKey: string, pointId: string) => void;
  onUpdateRoutePointLabel?: (mapKey: string, pointId: string, label: string) => void;
  onAddRouteArrow?: (
    mapKey: string,
    fromLeft: number,
    fromTop: number,
    toLeft: number,
    toTop: number,
  ) => void;
  onRemoveRouteArrow?: (mapKey: string, arrowId: string) => void;
  lockedIds?: Set<string>;
  /** false en modo Logs: el progreso es automático. */
  showActionsColumn?: boolean;
}

export function ActiveTasksView({
  tasks,
  taskStates,
  completedObjectives,
  customMapMarkers,
  routeMaps = {},
  routeArrows = {},
  routeDrawColor,
  fixedRouteMaps = {},
  mapExtracts = {},
  routeColorLabels = {},
  selectedId,
  t,
  isTable = false,
  listMode = 'started',
  onSelect,
  onStart,
  onComplete,
  onReset,
  onSetCustomMapMarker,
  onClearCustomMapMarker,
  onAddRoutePoint,
  onRemoveRoutePoint,
  onUpdateRoutePointLabel,
  onAddRouteArrow,
  onRemoveRouteArrow,
  lockedIds,
  showActionsColumn = true,
}: ActiveTasksViewProps) {
  const [openMap, setOpenMap] = useState<{
    normalizedName: string;
    name: string;
    tasks: Task[];
  } | null>(null);

  const isCompletedList = listMode === 'completed';
  const listedTasks = tasks.filter((task) =>
    isCompletedList
      ? taskStates[task.id] === 'completed'
      : taskStates[task.id] === 'started',
  );
  const groups = isCompletedList
    ? groupTasksByMap(listedTasks, t.anyMap)
    : groupActiveTasksByMap(listedTasks, completedObjectives, t.anyMap);
  const emptyLabel = isCompletedList ? t.noCompletedTasks : t.noActiveTasks;
  const countLabel = isCompletedList ? t.completedByMap : t.activeByMap;

  const openMapViewer = (normalizedName: string, name: string, mapTasks: Task[]) => {
    const svgUrl = getMapSvgUrl(normalizedName);
    if (svgUrl) {
      setOpenMap({ normalizedName, name, tasks: mapTasks });
      return;
    }
    window.open(getTarkovDevMapUrl(normalizedName), '_blank', 'noopener,noreferrer');
  };

  if (listedTasks.length === 0) {
    return <p className="empty-list">{emptyLabel}</p>;
  }

  if (groups.length === 0) {
    return <p className="empty-list">{emptyLabel}</p>;
  }

  const openMapSvgUrl = openMap ? getMapSvgUrl(openMap.normalizedName) : null;

  return (
    <div className={`active-tasks-view${isTable ? ' active-tasks-view-table' : ''}`}>
      {openMap && openMapSvgUrl && (
        <MapViewerModal
          mapName={openMap.name}
          mapKey={openMap.normalizedName}
          mapUrl={openMapSvgUrl}
          mapTasks={openMap.tasks}
          completedObjectives={completedObjectives}
          customMapMarkers={customMapMarkers}
          routePoints={routeMaps[openMap.normalizedName] ?? []}
          routeArrows={routeArrows[openMap.normalizedName] ?? []}
          routeDrawColor={routeDrawColor}
          fixedRoutePoints={fixedRouteMaps[openMap.normalizedName] ?? []}
          mapExtracts={mapExtracts[openMap.normalizedName] ?? []}
          colorLabels={routeColorLabels}
          tarkovDevUrl={getTarkovDevMapUrl(openMap.normalizedName)}
          t={t}
          onClose={() => setOpenMap(null)}
          onSetCustomMapMarker={onSetCustomMapMarker}
          onClearCustomMapMarker={onClearCustomMapMarker}
          onAddRoutePoint={
            onAddRoutePoint
              ? (left, top) => onAddRoutePoint(openMap.normalizedName, left, top)
              : undefined
          }
          onRemoveRoutePoint={
            onRemoveRoutePoint
              ? (pointId) => onRemoveRoutePoint(openMap.normalizedName, pointId)
              : undefined
          }
          onUpdateRoutePointLabel={
            onUpdateRoutePointLabel
              ? (pointId, label) =>
                  onUpdateRoutePointLabel(openMap.normalizedName, pointId, label)
              : undefined
          }
          onAddRouteArrow={
            onAddRouteArrow
              ? (fromLeft, fromTop, toLeft, toTop) =>
                  onAddRouteArrow(openMap.normalizedName, fromLeft, fromTop, toLeft, toTop)
              : undefined
          }
          onRemoveRouteArrow={
            onRemoveRouteArrow
              ? (arrowId) => onRemoveRouteArrow(openMap.normalizedName, arrowId)
              : undefined
          }
        />
      )}
      {groups.map(({ map, tasks: mapTasks }) => (
        <section key={map.normalizedName} className="map-section">
          <header className="map-section-header">
            <h2>{map.name}</h2>
            <span className="map-count">{countLabel(mapTasks.length)}</span>
            {map.normalizedName !== ANY_MAP_ID && (
              <button
                type="button"
                className="btn btn-ghost btn-map"
                onClick={() => openMapViewer(map.normalizedName, map.name, mapTasks)}
              >
                {t.viewMap}
              </button>
            )}
          </header>
          {isTable ? (
            <TaskTableSection
              tasks={mapTasks}
              taskStates={taskStates}
              selectedId={selectedId}
              showMapColumn={false}
              showActionsColumn={showActionsColumn}
              t={t}
              onSelect={onSelect}
              onStart={onStart}
              onComplete={onComplete}
              onReset={onReset}
              lockedIds={lockedIds}
            />
          ) : (
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
                    locked={lockedIds?.has(task.id) ?? false}
                    showActions={showActionsColumn}
                  />
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
