import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
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
  fixedMarkerLayerId,
  isExtractLayerVisible,
  useFixedLayerVisibility,
} from '../hooks/useFixedLayerVisibility';
import { getMapZoneAnnotations, mapZoneAnnotationStyle } from '../utils/mapAnnotations';
import {
  extractFactionLabel,
  extractIconUrl,
  extractMarkerColor,
  type MapExtractMarker,
} from '../utils/mapExtracts';
import {
  getAllMapMarkers,
  getTasksWithoutMapMarkers,
} from '../utils/mapMarkers';
import { getTraderImagePath } from '../utils/traderImages';
import { FixedLayerToggles } from './FixedLayerToggles';
import {
  MapFloatingTooltip,
  type MapFloatingTooltipData,
} from './MapFloatingTooltip';

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
  /** Extracciones PMC/SCAV automáticas del mapa. */
  mapExtracts?: MapExtractMarker[];
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
  mapExtracts = [],
  colorLabels = {},
  tarkovDevUrl,
  t,
  onClose,
  onSetCustomMapMarker,
  onClearCustomMapMarker,
}: MapViewerModalProps) {
  const { visibility: fixedLayerVisibility, toggleLayer: toggleFixedLayer } =
    useFixedLayerVisibility();
  const visibleFixedPoints = useMemo(
    () =>
      fixedRoutePoints.filter(
        (point) => fixedLayerVisibility[fixedMarkerLayerId(point.markerType)],
      ),
    [fixedRoutePoints, fixedLayerVisibility],
  );
  const visibleExtracts = useMemo(
    () =>
      mapExtracts.filter((extract) =>
        isExtractLayerVisible(extract.faction, fixedLayerVisibility),
      ),
    [mapExtracts, fixedLayerVisibility],
  );
  const [placingTaskId, setPlacingTaskId] = useState<string | null>(null);
  const [mapTooltip, setMapTooltip] = useState<(MapFloatingTooltipData & { id: string }) | null>(
    null,
  );
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 });
  const [imageModal, setImageModal] = useState<{ src: string; label: string } | null>(null);
  const [imageTooltip, setImageTooltip] = useState<{
    pointId: string;
    x: number;
    y: number;
    src: string;
    label: string;
  } | null>(null);
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

  /** Agrupa por misión; una descripción por objetivo (varios puntos del mapa pueden compartirla). */
  const legendEntries = useMemo(() => {
    const byTask = new Map<
      string,
      {
        taskId: string;
        taskName: string;
        custom: boolean;
        descriptions: string[];
      }
    >();
    const seenObjective = new Set<string>();

    for (const marker of markers) {
      const objectiveKey = `${marker.taskId}:${marker.objectiveId}`;
      if (seenObjective.has(objectiveKey)) continue;
      seenObjective.add(objectiveKey);

      const description = marker.custom
        ? null
        : marker.objectiveDescription.trim();
      let entry = byTask.get(marker.taskId);
      if (!entry) {
        entry = {
          taskId: marker.taskId,
          taskName: marker.taskName,
          custom: Boolean(marker.custom),
          descriptions: [],
        };
        byTask.set(marker.taskId, entry);
      }
      if (marker.custom) {
        entry.custom = true;
      } else if (description && !entry.descriptions.includes(description)) {
        entry.descriptions.push(description);
      }
    }

    return [...byTask.values()];
  }, [markers]);

  const markerTaskIds = useMemo(
    () => new Set(markers.map((m) => m.taskId)),
    [markers],
  );

  const tasksWithoutMarkers = useMemo(
    () => getTasksWithoutMapMarkers(mapKey, mapTasks, completedObjectives, markerTaskIds),
    [mapKey, mapTasks, completedObjectives, markerTaskIds],
  );

  const hasRouteMarkers =
    visibleFixedPoints.length > 0 ||
    visibleExtracts.length > 0 ||
    routePoints.length > 0 ||
    fixedRoutePoints.length > 0 ||
    mapExtracts.length > 0;
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
            <div className="map-modal-map-viewport">
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
                {getMapZoneAnnotations(mapKey).map((zone) => (
                  <div
                    key={zone.id}
                    className="map-zone-annotation"
                    style={mapZoneAnnotationStyle(zone)}
                    aria-label={zone.label}
                  >
                    <span className="map-zone-annotation-label">{zone.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {canProject && (markers.length > 0 || hasRouteMarkers) && (
              <div className="map-modal-markers map-modal-markers--overlay">
                {visibleExtracts.map((extract) => {
                  const pos = projectMarker(extract.left, extract.top);
                  if (!pos) return null;
                  const factionLabel = extractFactionLabel(extract.faction, {
                    pmc: t.routesExtractPmc,
                    scav: t.routesExtractScav,
                    shared: t.routesExtractShared,
                  });
                  const accent = extractMarkerColor(extract.faction);
                  const iconSrc = extractIconUrl(extract.faction);
                  const isHovered = mapTooltip?.id === extract.id;
                  return (
                    <button
                      key={extract.id}
                      type="button"
                      className={[
                        'route-map-marker',
                        'route-map-marker--fixed',
                        'route-map-marker--icon',
                        'route-map-marker--extract',
                        extract.faction === 'scav'
                          ? 'route-map-marker--extract-scav'
                          : extract.faction === 'shared'
                            ? 'route-map-marker--extract-shared'
                            : 'route-map-marker--extract-pmc',
                        isHovered ? 'route-map-marker--hovered' : '',
                      ].filter(Boolean).join(' ')}
                      style={{
                        left: pos.x,
                        top: pos.y,
                        '--route-marker-color': accent,
                        zIndex: isHovered ? 4 : 3,
                      } as CSSProperties}
                      aria-label={`${extract.name} (${factionLabel})`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMapTooltip({
                          id: extract.id,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          title: extract.name,
                          subtitle: factionLabel,
                          description: t.routesExtractTooltipHint,
                          iconSrc,
                          iconAlt: factionLabel,
                          accent,
                        });
                      }}
                      onMouseLeave={() => setMapTooltip(null)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="route-map-marker-body">
                        <span className="route-map-marker-label route-map-marker-label--extract">
                          {extract.name}
                        </span>
                        <img
                          className="route-map-marker-icon"
                          src={iconSrc}
                          alt=""
                          draggable={false}
                        />
                      </span>
                    </button>
                  );
                })}
                {visibleFixedPoints.map((point, index) => {
                  const pos = projectMarker(point.left, point.top);
                  if (!pos) return null;
                  const iconMarker = isIconMarkerType(point.markerType);
                  const iconUrl = markerTypeIconUrl(point.markerType);
                  const markerLabel = iconMarker
                    ? markerTypeTitle(point.markerType, t)
                    : (point.label?.trim() || String(index + 1));
                  const isHovered = imageTooltip?.pointId === point.id;
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
                        isHovered ? 'route-map-marker--hovered' : '',
                      ].filter(Boolean).join(' ')}
                      style={{
                        left: pos.x,
                        top: pos.y,
                        '--route-marker-color': point.color,
                        zIndex: isHovered ? 4 : 3,
                      } as CSSProperties}
                      title={
                        point.imageUrl
                          ? undefined
                          : (iconMarker ? markerLabel : (point.label?.trim() || t.routesFixedSection))
                      }
                      aria-label={iconMarker ? markerLabel : (point.label?.trim() || t.routesPointLabel(index + 1))}
                      onMouseEnter={(e) => {
                        if (!point.imageUrl || imageModal) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setImageTooltip({
                          pointId: point.id,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          src: point.imageUrl,
                          label: markerLabel,
                        });
                      }}
                      onMouseLeave={() => setImageTooltip(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (point.imageUrl) {
                          setImageTooltip(null);
                          setImageModal({
                            src: point.imageUrl,
                            label: markerLabel,
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
                  const description = marker.custom
                    ? t.mapMarkerManual
                    : marker.objectiveDescription;
                  const traderImage = getTraderImagePath(marker.trader);
                  const isHovered = mapTooltip?.id === marker.id;
                  return (
                    <div
                      key={marker.id}
                      className={[
                        'map-quest-marker',
                        marker.custom ? 'map-quest-marker--custom' : '',
                        isHovered ? 'is-hovered' : '',
                      ].filter(Boolean).join(' ')}
                      style={{ left: pos.x, top: pos.y, zIndex: isHovered ? 8 : undefined }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMapTooltip({
                          id: marker.id,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          title: marker.taskName,
                          subtitle: marker.trader.name,
                          description,
                          iconSrc: traderImage,
                          iconAlt: marker.trader.name,
                        });
                      }}
                      onMouseLeave={() => setMapTooltip(null)}
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
              {(fixedRoutePoints.length > 0 || mapExtracts.length > 0 || routePoints.length > 0) && (
                <div className="map-modal-legend-section">
                  <h4>
                    {fixedRoutePoints.length + mapExtracts.length > 0
                      ? t.routesFixedPoints(fixedRoutePoints.length + mapExtracts.length)
                      : t.routesPoints(routePoints.length)}
                    {fixedRoutePoints.length + mapExtracts.length > 0 && routePoints.length > 0
                      ? ` · ${t.routesPoints(routePoints.length)}`
                      : ''}
                  </h4>
                  <FixedLayerToggles
                    fixedPoints={fixedRoutePoints}
                    extracts={mapExtracts}
                    visibility={fixedLayerVisibility}
                    onToggle={toggleFixedLayer}
                    t={t}
                  />
                  <p className="map-modal-place-hint">{t.routesFixedHint}</p>
                </div>
              )}
              {legendEntries.length > 0 && (
                <div className="map-modal-legend-section">
                  <h4>{t.mapMarkersTitle(markers.length)}</h4>
                  <ul className="map-modal-legend-list">
                    {legendEntries.map((entry) => (
                      <li key={entry.taskId} className="map-modal-legend-item">
                        <div className="map-modal-legend-row">
                          <div className="map-modal-legend-text">
                            <strong className="map-modal-legend-name">{entry.taskName}</strong>
                            {entry.custom && entry.descriptions.length === 0 ? (
                              <span className="map-modal-legend-desc">{t.mapMarkerManual}</span>
                            ) : (
                              entry.descriptions.map((description) => (
                                <span key={description} className="map-modal-legend-desc">
                                  {description}
                                </span>
                              ))
                            )}
                          </div>
                          {entry.custom && (
                            <button
                              type="button"
                              className="btn btn-ghost map-marker-clear"
                              onClick={() => onClearCustomMapMarker(mapKey, entry.taskId)}
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

      <MapFloatingTooltip tooltip={mapTooltip} />

      {imageTooltip &&
        !imageModal &&
        createPortal(
          <div
            className={[
              'route-fixed-image-tooltip',
              imageTooltip.y < 180 ? 'is-below' : '',
            ].filter(Boolean).join(' ')}
            role="tooltip"
            style={{ left: imageTooltip.x, top: imageTooltip.y }}
          >
            <img src={imageTooltip.src} alt={imageTooltip.label} />
            {imageTooltip.label && (
              <span className="route-fixed-image-tooltip-label">{imageTooltip.label}</span>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
