import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { CustomMapMarkerPin, CustomMapMarkers, Task } from '../types';
import type { Translations } from '../i18n/translations';
import {
  isIconMarkerType,
  markerTypeIconUrl,
  type FixedMarkerType,
  type FixedRoutePoint,
  type RouteColorLabels,
  type RoutePoint,
} from '../types/routes';
import { mapPercentToAreaPoint, useMapPanZoom } from '../hooks/useMapPanZoom';
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
  /** Puntos personales del dibujador de rutas (mismo bucket que Routes). */
  routePoints?: RoutePoint[];
  /** Puntos fijos de admin (mismo bucket que Routes). */
  fixedRoutePoints?: FixedRoutePoint[];
  colorLabels?: RouteColorLabels;
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

function markerTypeTitle(markerType: FixedMarkerType | undefined, t: Translations): string {
  if (markerType === 'kb') return t.adminMarkerTypeKb;
  if (markerType === 'question') return t.adminMarkerTypeQuestion;
  return t.adminMarkerTypeDefault;
}

function labelForColor(colorLabels: RouteColorLabels | undefined, color: string): string {
  return colorLabels?.[color]?.trim() ?? '';
}

export function MapViewerModal({
  mapName,
  mapKey,
  mapUrl,
  mapTasks,
  completedObjectives,
  customMapMarkers,
  routePoints = [],
  fixedRoutePoints = [],
  colorLabels = {},
  tarkovDevUrl,
  t,
  onClose,
  onSetCustomMapMarker,
  onClearCustomMapMarker,
}: MapViewerModalProps) {
  const [placingTaskId, setPlacingTaskId] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 });
  const [imageModal, setImageModal] = useState<{ src: string; label: string } | null>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const {
    containerRef: mapAreaRef,
    setContainerRef: setMapAreaRef,
    zoom,
    panX,
    panY,
    isPanning,
    contentStyle,
    panHandlers,
    shouldSuppressClick,
  } = useMapPanZoom(mapKey);

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

  const hasRouteMarkers = fixedRoutePoints.length > 0 || routePoints.length > 0;
  const hasLegend =
    markers.length > 0 || tasksWithoutMarkers.length > 0 || hasRouteMarkers;
  const canProject = imageSize.width > 0 && areaSize.width > 0;

  const placingTask = placingTaskId
    ? mapTasks.find((task) => task.id === placingTaskId) ?? null
    : null;

  const projectMarker = useCallback((left: number, top: number) => {
    if (!canProject) return null;
    return mapPercentToAreaPoint(
      left,
      top,
      imageSize.width,
      imageSize.height,
      areaSize.width,
      areaSize.height,
      zoom,
      panX,
      panY,
    );
  }, [areaSize.height, areaSize.width, canProject, imageSize.height, imageSize.width, panX, panY, zoom]);

  const updateImageSize = useCallback(() => {
    const area = mapAreaRef.current;
    const img = imageRef.current;
    if (!area) return;
    setAreaSize({ width: area.clientWidth, height: area.clientHeight });
    if (!img?.naturalWidth) return;

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
      if (imageModal) {
        setImageModal(null);
        return;
      }
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
  }, [imageModal, onClose, placingTaskId]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingTaskId || !imageWrapRef.current) return;
    if (shouldSuppressClick()) return;

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
            ref={setMapAreaRef}
            className={`map-modal-map-area${placingTaskId ? ' map-modal-map-area--placing' : ''}${zoom > 1 ? ' map-modal-map-area--zoomed' : ''}${isPanning ? ' is-panning' : ''}`}
            {...panHandlers}
          >
            <div
              ref={imageWrapRef}
              className="map-modal-image-wrap"
              style={{
                width: imageSize.width > 0 ? `${imageSize.width}px` : undefined,
                height: imageSize.height > 0 ? `${imageSize.height}px` : undefined,
                ...contentStyle,
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
            </div>
            {canProject && (markers.length > 0 || hasRouteMarkers) && (
              <div className="map-modal-markers map-modal-markers--overlay">
                {fixedRoutePoints.map((point, index) => {
                  const pos = projectMarker(point.left, point.top);
                  if (!pos) return null;
                  const iconMarker = isIconMarkerType(point.markerType);
                  const iconUrl = markerTypeIconUrl(point.markerType);
                  const markerLabel = iconMarker
                    ? markerTypeTitle(point.markerType, t)
                    : (point.label?.trim() || String(index + 1));
                  return (
                    <button
                      key={point.id}
                      type="button"
                      className={[
                        'route-map-marker',
                        'route-map-marker--fixed',
                        iconMarker ? 'route-map-marker--icon' : '',
                        point.markerType === 'question' ? 'route-map-marker--question' : '',
                        point.markerType === 'kb' ? 'route-map-marker--kb' : '',
                        point.imageUrl ? 'route-map-marker--has-image' : '',
                      ].filter(Boolean).join(' ')}
                      style={{
                        left: pos.x,
                        top: pos.y,
                        '--route-marker-color': point.color,
                        zIndex: 3,
                      } as CSSProperties}
                      title={
                        point.imageUrl
                          ? t.routesPointImageModal
                          : (iconMarker ? markerLabel : (point.label?.trim() || t.routesFixedSection))
                      }
                      aria-label={iconMarker ? markerLabel : (point.label?.trim() || t.routesPointLabel(index + 1))}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (point.imageUrl) {
                          setImageModal({
                            src: point.imageUrl,
                            label: iconMarker ? '' : markerLabel,
                          });
                        }
                      }}
                    >
                      <span className="route-map-marker-body">
                        {iconUrl ? (
                          <img
                            className="route-map-marker-icon"
                            src={iconUrl}
                            alt=""
                            draggable={false}
                          />
                        ) : (
                          <>
                            <span className="route-map-marker-label">{markerLabel}</span>
                            <span className="route-map-marker-pin" />
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
                {routePoints.map((point, index) => {
                  const pos = projectMarker(point.left, point.top);
                  if (!pos) return null;
                  const playerName = labelForColor(colorLabels, point.color);
                  const markerLabel = playerName || String(index + 1);
                  return (
                    <div
                      key={point.id}
                      className="route-map-marker"
                      style={{
                        left: pos.x,
                        top: pos.y,
                        '--route-marker-color': point.color,
                        zIndex: 2,
                      } as CSSProperties}
                      title={playerName || t.routesPointLabel(index + 1)}
                      aria-label={playerName || t.routesPointLabel(index + 1)}
                    >
                      <span className="route-map-marker-body">
                        <span className="route-map-marker-label">{markerLabel}</span>
                        <span className="route-map-marker-pin" />
                      </span>
                    </div>
                  );
                })}
                {markers.map((marker) => {
                  const pos = projectMarker(marker.left, marker.top);
                  if (!pos) return null;
                  return (
                    <div
                      key={marker.id}
                      className={`map-quest-marker${marker.custom ? ' map-quest-marker--custom' : ''}`}
                      style={{ left: pos.x, top: pos.y }}
                      title={`${marker.taskName}\n${marker.custom ? t.mapMarkerManual : marker.objectiveDescription}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="map-quest-marker-pin" />
                      <span className="map-quest-marker-label">{marker.taskName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {hasLegend && (
            <aside className="map-modal-legend">
              {hasRouteMarkers && (
                <div className="map-modal-legend-section">
                  <h4>
                    {fixedRoutePoints.length > 0
                      ? t.routesFixedPoints(fixedRoutePoints.length)
                      : t.routesPoints(routePoints.length)}
                    {fixedRoutePoints.length > 0 && routePoints.length > 0
                      ? ` · ${t.routesPoints(routePoints.length)}`
                      : ''}
                  </h4>
                  <p className="map-modal-place-hint">{t.routesFixedHint}</p>
                </div>
              )}
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

      {imageModal && (
        <div
          className="route-point-image-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={imageModal.label || t.routesPointImageModal}
          onClick={() => setImageModal(null)}
        >
          <div
            className="route-point-image-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="route-point-image-modal-header">
              <h3>{imageModal.label || t.routesPointImageModal}</h3>
              <button
                type="button"
                className="btn btn-ghost route-point-image-modal-close"
                onClick={() => setImageModal(null)}
              >
                {t.close}
              </button>
            </header>
            <div className="route-point-image-modal-body">
              <img src={imageModal.src} alt={imageModal.label || t.routesPointImageModal} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
