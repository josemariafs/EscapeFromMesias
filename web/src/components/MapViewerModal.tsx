import { useEffect, useMemo } from 'react';
import type { Task } from '../types';
import type { Translations } from '../i18n/translations';
import {
  getMapQuestMarkers,
  getTasksWithoutMapMarkers,
} from '../utils/mapMarkers';

interface MapViewerModalProps {
  mapName: string;
  mapKey: string;
  mapUrl: string;
  mapTasks: Task[];
  completedObjectives: Record<string, string[]>;
  tarkovDevUrl: string;
  t: Translations;
  onClose: () => void;
}

export function MapViewerModal({
  mapName,
  mapKey,
  mapUrl,
  mapTasks,
  completedObjectives,
  tarkovDevUrl,
  t,
  onClose,
}: MapViewerModalProps) {
  const markers = useMemo(
    () => getMapQuestMarkers(mapKey, mapTasks, completedObjectives),
    [mapKey, mapTasks, completedObjectives],
  );

  const markerTaskIds = useMemo(
    () => new Set(markers.map((m) => m.taskId)),
    [markers],
  );

  const tasksWithoutMarkers = useMemo(
    () => getTasksWithoutMapMarkers(mapKey, mapTasks, completedObjectives, markerTaskIds),
    [mapKey, mapTasks, completedObjectives, markerTaskIds],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="map-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={mapName}
      onClick={onClose}
    >
      <div className="map-modal" onClick={(e) => e.stopPropagation()}>
        <header className="map-modal-header">
          <h3>{mapName}</h3>
          <div className="map-modal-actions">
            <a
              href={tarkovDevUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost map-modal-external"
            >
              {t.viewMapOnTarkovDev}
            </a>
            <button type="button" className="btn btn-ghost map-modal-close" onClick={onClose}>
              {t.close}
            </button>
          </div>
        </header>
        <div className="map-modal-body">
          <div className="map-modal-canvas">
            <img src={mapUrl} alt={mapName} className="map-modal-image" />
            {markers.length > 0 && (
              <div className="map-modal-markers" aria-hidden="true">
                {markers.map((marker) => (
                  <div
                    key={marker.id}
                    className="map-quest-marker"
                    style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
                    title={`${marker.taskName}\n${marker.objectiveDescription}`}
                  >
                    <span className="map-quest-marker-pin" />
                    <span className="map-quest-marker-label">{marker.taskName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {(markers.length > 0 || tasksWithoutMarkers.length > 0) && (
            <aside className="map-modal-legend">
              {markers.length > 0 && (
                <div className="map-modal-legend-section">
                  <h4>{t.mapMarkersTitle(markers.length)}</h4>
                  <ul className="map-modal-legend-list">
                    {markers.map((marker) => (
                      <li key={marker.id}>
                        <strong>{marker.taskName}</strong>
                        <span>{marker.objectiveDescription}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tasksWithoutMarkers.length > 0 && (
                <div className="map-modal-legend-section map-modal-legend-muted">
                  <h4>{t.mapMarkersNoLocation(tasksWithoutMarkers.length)}</h4>
                  <ul className="map-modal-legend-list">
                    {tasksWithoutMarkers.map((task) => (
                      <li key={task.id}>
                        <strong>{task.name}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
