import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CustomMapMarkerPin, CustomMapMarkers, Task } from '../types';
import type { Translations } from '../i18n/translations';
import {
  getAllMapMarkers,
  getTasksWithoutMapMarkers,
} from '../utils/mapMarkers';

interface MapViewerModalProps {
  mapName: string;
  mapKey: string;
  mapUrl: string;
  mapTasks: Task[];
  completedObjectives: Record<string, string[]>;
  customMapMarkers: CustomMapMarkers;
  tarkovDevUrl: string;
  t: Translations;
  onClose: () => void;
  onSetCustomMapMarker: (mapKey: string, taskId: string, pin: CustomMapMarkerPin) => void;
  onClearCustomMapMarker: (mapKey: string, taskId: string) => void;
}

function fitImageSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}

export function MapViewerModal({
  mapName,
  mapKey,
  mapUrl,
  mapTasks,
  completedObjectives,
  customMapMarkers,
  tarkovDevUrl,
  t,
  onClose,
  onSetCustomMapMarker,
  onClearCustomMapMarker,
}: MapViewerModalProps) {
  const [placingTaskId, setPlacingTaskId] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const markers = useMemo(
    () => getAllMapMarkers(mapKey, mapTasks, completedObjectives, customMapMarkers),
    [mapKey, mapTasks, completedObjectives, customMapMarkers],
  );

  const markerTaskIds = useMemo(
    () => new Set(markers.map((m) => m.taskId)),
    [markers],
  );

  const tasksWithoutMarkers = useMemo(
    () => getTasksWithoutMapMarkers(mapKey, mapTasks, completedObjectives, markerTaskIds),
    [mapKey, mapTasks, completedObjectives, markerTaskIds],
  );

  const hasLegend = markers.length > 0 || tasksWithoutMarkers.length > 0;

  const placingTask = placingTaskId
    ? mapTasks.find((task) => task.id === placingTaskId) ?? null
    : null;

  const updateImageSize = useCallback(() => {
    const area = mapAreaRef.current;
    const img = imageRef.current;
    if (!area || !img?.naturalWidth) return;

    setImageSize(fitImageSize(
      img.naturalWidth,
      img.naturalHeight,
      area.clientWidth,
      area.clientHeight,
    ));
  }, []);

  useEffect(() => {
    updateImageSize();
    const area = mapAreaRef.current;
    if (!area) return undefined;

    const observer = new ResizeObserver(() => updateImageSize());
    observer.observe(area);
    return () => observer.disconnect();
  }, [updateImageSize, mapUrl]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (placingTaskId) {
        setPlacingTaskId(null);
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, placingTaskId]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingTaskId || !imageWrapRef.current) return;

    const rect = imageWrapRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const left = ((e.clientX - rect.left) / rect.width) * 100;
    const top = ((e.clientY - rect.top) / rect.height) * 100;

    onSetCustomMapMarker(mapKey, placingTaskId, {
      left: Math.max(0, Math.min(100, left)),
      top: Math.max(0, Math.min(100, top)),
    });
    setPlacingTaskId(null);
  };

  return (
    <div
      className="map-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={mapName}
      onClick={onClose}
    >
      <div className={`map-modal${hasLegend ? ' map-modal--with-legend' : ''}`} onClick={(e) => e.stopPropagation()}>
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
        {placingTask && (
          <div className="map-modal-place-banner">
            <span>{t.mapPlaceBanner(placingTask.name)}</span>
            <button
              type="button"
              className="btn btn-ghost map-modal-place-cancel"
              onClick={() => setPlacingTaskId(null)}
            >
              {t.mapPlaceCancel}
            </button>
          </div>
        )}
        <div className="map-modal-body">
          <div
            ref={mapAreaRef}
            className={`map-modal-map-area${placingTaskId ? ' map-modal-map-area--placing' : ''}`}
          >
            <div
              ref={imageWrapRef}
              className="map-modal-image-wrap"
              style={{
                width: imageSize.width > 0 ? `${imageSize.width}px` : undefined,
                height: imageSize.height > 0 ? `${imageSize.height}px` : undefined,
              }}
              onClick={placingTaskId ? handleMapClick : undefined}
              role={placingTaskId ? 'button' : undefined}
              tabIndex={placingTaskId ? 0 : undefined}
              aria-label={placingTaskId ? t.mapPlaceBanner(placingTask?.name ?? '') : undefined}
            >
              <img
                ref={imageRef}
                src={mapUrl}
                alt={mapName}
                className="map-modal-image"
                onLoad={updateImageSize}
              />
              {markers.length > 0 && imageSize.width > 0 && (
                <div className="map-modal-markers" aria-hidden="true">
                  {markers.map((marker) => (
                    <div
                      key={marker.id}
                      className={`map-quest-marker${marker.custom ? ' map-quest-marker--custom' : ''}`}
                      style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
                      title={`${marker.taskName}\n${marker.custom ? t.mapMarkerManual : marker.objectiveDescription}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="map-quest-marker-pin" />
                      <span className="map-quest-marker-label">{marker.taskName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {hasLegend && (
            <aside className="map-modal-legend">
              {markers.length > 0 && (
                <div className="map-modal-legend-section">
                  <h4>{t.mapMarkersTitle(markers.length)}</h4>
                  <ul className="map-modal-legend-list">
                    {markers.map((marker) => (
                      <li key={marker.id}>
                        <div className="map-modal-legend-row">
                          <div>
                            <strong>{marker.taskName}</strong>
                            <span>
                              {marker.custom ? t.mapMarkerManual : marker.objectiveDescription}
                            </span>
                          </div>
                          {marker.custom && (
                            <button
                              type="button"
                              className="btn btn-ghost map-marker-clear"
                              onClick={() => onClearCustomMapMarker(mapKey, marker.taskId)}
                              title={t.mapClearCustomMarker}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tasksWithoutMarkers.length > 0 && (
                <div className="map-modal-legend-section map-modal-legend-muted">
                  <h4>{t.mapMarkersNoLocation(tasksWithoutMarkers.length)}</h4>
                  <p className="map-modal-place-hint">{t.mapPlaceSelectHint}</p>
                  <ul className="map-modal-legend-list">
                    {tasksWithoutMarkers.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          className={`map-modal-place-btn${placingTaskId === task.id ? ' is-active' : ''}`}
                          onClick={() => {
                            setPlacingTaskId((current) =>
                              current === task.id ? null : task.id,
                            );
                          }}
                        >
                          <strong>{task.name}</strong>
                          {placingTaskId === task.id && (
                            <span>{t.mapPlaceClickHint}</span>
                          )}
                        </button>
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
