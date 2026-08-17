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
  allowsFixedPointLabel,
  DEFAULT_ROUTE_POINT_COLOR,
  isIconMarkerType,
  isKeyDocumentMarkerType,
  isUndergroundKeyDocumentMarkerType,
  markerTypeIconUrl,
  type FixedMarkerType,
  type FixedRoutePoint,
  type RouteArrow,
  type RouteColorLabels,
  type RoutePoint,
} from '../types/routes';
import { useMapArrowDraw } from '../hooks/useMapArrowDraw';
import {
  areaPointToMapPercent,
  mapPercentToAreaPoint,
  useMapPanZoom,
} from '../hooks/useMapPanZoom';
import { RouteMapArrows } from './RouteMapArrows';
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
import {
  getQuestItemRequirements,
  type QuestItemRequirement,
} from '../utils/unlock';
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
  /** Clic en el mapa (sin modo colocar misión) → punto personal. */
  onAddRoutePoint?: (left: number, top: number) => void;
  /** Clic en un pin personal → eliminarlo. */
  onRemoveRoutePoint?: (pointId: string) => void;
  /** Actualizar etiqueta de un pin personal. */
  onUpdateRoutePointLabel?: (pointId: string, label: string) => void;
  /** Flechas personales dibujadas a mano. */
  routeArrows?: RouteArrow[];
  /** Color activo para puntos/flechas. */
  routeDrawColor?: string;
  /** Clic + arrastre → flecha. */
  onAddRouteArrow?: (fromLeft: number, fromTop: number, toLeft: number, toTop: number) => void;
  /** Clic en una flecha → eliminarla. */
  onRemoveRouteArrow?: (arrowId: string) => void;
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
  if (isUndergroundKeyDocumentMarkerType(markerType)) return t.adminMarkerTypeKeyDocumentUnderground;
  if (isKeyDocumentMarkerType(markerType)) return t.adminMarkerTypeKeyDocument;
  if (markerType === 'question') return t.adminMarkerTypeQuestion;
  return t.adminMarkerTypeDefault;
}

function imageCaptionForPoint(point: FixedRoutePoint): string {
  if (allowsFixedPointLabel(point.markerType)) {
    return point.label?.trim() || '';
  }
  return '';
}

function labelForColor(colorLabels: RouteColorLabels | undefined, color: string): string {
  return colorLabels?.[color]?.trim() ?? '';
}

/** Subtareas de mapa ocultas por el usuario (checkbox), por mapKey. */
const HIDDEN_QUEST_MARKERS_KEY = 'efg-hidden-quest-markers:v1';

function readHiddenQuestMarkers(mapKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_QUEST_MARKERS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const list = parsed[mapKey];
    if (!Array.isArray(list)) return new Set();
    return new Set(list.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

function writeHiddenQuestMarkers(mapKey: string, ids: Set<string>): void {
  try {
    const raw = localStorage.getItem(HIDDEN_QUEST_MARKERS_KEY);
    const parsed =
      raw && raw.trim()
        ? (JSON.parse(raw) as Record<string, unknown>)
        : {};
    const next: Record<string, string[]> = {};
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        if (Array.isArray(value)) {
          next[key] = value.filter((id): id is string => typeof id === 'string');
        }
      }
    }
    if (ids.size === 0) delete next[mapKey];
    else next[mapKey] = [...ids];
    localStorage.setItem(HIDDEN_QUEST_MARKERS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

function personalPointTitle(
  point: RoutePoint,
  index: number,
  colorLabels: RouteColorLabels | undefined,
  fallback: (n: number) => string,
): string {
  const custom = point.label?.trim();
  if (custom) return custom;
  const playerName = labelForColor(colorLabels, point.color);
  if (playerName) return playerName;
  return fallback(index + 1);
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
  onAddRoutePoint,
  onRemoveRoutePoint,
  onUpdateRoutePointLabel,
  routeArrows = [],
  routeDrawColor = DEFAULT_ROUTE_POINT_COLOR,
  onAddRouteArrow,
  onRemoveRouteArrow,
}: MapViewerModalProps) {
  const canEditRoutePoints = Boolean(
    onAddRoutePoint
      || onRemoveRoutePoint
      || onUpdateRoutePointLabel
      || onAddRouteArrow
      || onRemoveRouteArrow,
  );
  const [editingLabels, setEditingLabels] = useState<Record<string, string>>({});
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
  /** Marcadores de misión ocultos con el checkbox de la leyenda (persistido por mapa). */
  const [hiddenQuestMarkerIds, setHiddenQuestMarkerIds] = useState<Set<string>>(() =>
    readHiddenQuestMarkers(mapKey),
  );
  /** Resaltado al hacer hover sobre el checkbox de un punto. */
  const [highlightedMarkerId, setHighlightedMarkerId] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 });
  const [imageModal, setImageModal] = useState<{
    src: string;
    label: string;
    documentStyle: boolean;
  } | null>(null);
  const [imageTooltip, setImageTooltip] = useState<{
    pointId: string;
    x: number;
    y: number;
    src: string;
    label: string;
    documentStyle: boolean;
  } | null>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const legendPointRefs = useRef<Map<string, HTMLLabelElement>>(new Map());
  /** Modo explícito: por defecto el arrastre panea el mapa; solo con esto se dibuja flecha. */
  const [arrowDrawMode, setArrowDrawMode] = useState(false);
  const [leftLegendCollapsed, setLeftLegendCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches,
  );
  const [rightLegendCollapsed, setRightLegendCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches,
  );
  const canDrawArrows = Boolean(onAddRouteArrow) && !placingTaskId;
  const arrowDrawEnabled = canDrawArrows && arrowDrawMode;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)');
    const onChange = () => {
      if (mq.matches) {
        setLeftLegendCollapsed(true);
        setRightLegendCollapsed(true);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const persistHiddenQuestMarkers = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setHiddenQuestMarkerIds((prev) => {
        const next = updater(prev);
        writeHiddenQuestMarkers(mapKey, next);
        return next;
      });
    },
    [mapKey],
  );

  const hideQuestMarker = useCallback((markerId: string) => {
    persistHiddenQuestMarkers((prev) => {
      if (prev.has(markerId)) return prev;
      const next = new Set(prev);
      next.add(markerId);
      return next;
    });
    setHighlightedMarkerId(null);
    setMapTooltip(null);
  }, [persistHiddenQuestMarkers]);

  const highlightLegendPoint = useCallback((markerId: string) => {
    setHighlightedMarkerId(markerId);
    const el = legendPointRefs.current.get(markerId);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
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
  } = useMapPanZoom(mapKey, { leftPanEnabled: !arrowDrawEnabled });

  const markers = useMemo(
    () => getAllMapMarkers(mapKey, mapTasks, completedObjectives, customMapMarkers),
    [mapKey, mapTasks, completedObjectives, customMapMarkers],
  );

  const tasksById = useMemo(
    () => new Map(mapTasks.map((task) => [task.id, task])),
    [mapTasks],
  );

  /** Agrupa por misión; un checkbox por cada punto real del mapa. */
  const legendEntries = useMemo(() => {
    const byTask = new Map<
      string,
      {
        taskId: string;
        taskName: string;
        traderName: string;
        traderImage: string | null;
        requiredItems: QuestItemRequirement[];
        custom: boolean;
        points: Array<{ id: string; description: string; custom: boolean }>;
      }
    >();

    for (const marker of markers) {
      let entry = byTask.get(marker.taskId);
      if (!entry) {
        const task = tasksById.get(marker.taskId);
        entry = {
          taskId: marker.taskId,
          taskName: marker.taskName,
          traderName: marker.trader.name,
          traderImage: getTraderImagePath(marker.trader),
          requiredItems: task ? getQuestItemRequirements(task) : [],
          custom: Boolean(marker.custom),
          points: [],
        };
        byTask.set(marker.taskId, entry);
      }
      if (marker.custom) entry.custom = true;
      entry.points.push({
        id: marker.id,
        description: marker.custom
          ? ''
          : marker.objectiveDescription.trim(),
        custom: Boolean(marker.custom),
      });
    }

    return [...byTask.values()];
  }, [markers, tasksById]);

  useEffect(() => {
    setHiddenQuestMarkerIds(readHiddenQuestMarkers(mapKey));
    setHighlightedMarkerId(null);
    setArrowDrawMode(false);
  }, [mapKey]);

  useEffect(() => {
    if (placingTaskId) setArrowDrawMode(false);
  }, [placingTaskId]);

  const markerTaskIds = useMemo(
    () => new Set(markers.map((m) => m.taskId)),
    [markers],
  );

  const tasksWithoutMarkers = useMemo(
    () => getTasksWithoutMapMarkers(mapKey, mapTasks, completedObjectives, markerTaskIds),
    [mapKey, mapTasks, completedObjectives, markerTaskIds],
  );

  const hasLeftLegend =
    routePoints.length > 0
    || routeArrows.length > 0
    || canEditRoutePoints
    || Boolean(onAddRouteArrow);
  const hasRightLegend =
    fixedRoutePoints.length > 0
    || mapExtracts.length > 0
    || markers.length > 0
    || tasksWithoutMarkers.length > 0;
  const hasLegend = hasLeftLegend || hasRightLegend;
  const hasRouteMarkers =
    visibleFixedPoints.length > 0 ||
    visibleExtracts.length > 0 ||
    routePoints.length > 0 ||
    routeArrows.length > 0 ||
    fixedRoutePoints.length > 0 ||
    mapExtracts.length > 0 ||
    canEditRoutePoints;
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

  const clientToMapPercent = useCallback((clientX: number, clientY: number) => {
    const area = mapAreaRef.current;
    if (!area || imageSize.width <= 0 || areaSize.width <= 0) return null;
    const rect = area.getBoundingClientRect();
    return areaPointToMapPercent(
      clientX - rect.left,
      clientY - rect.top,
      imageSize.width,
      imageSize.height,
      areaSize.width,
      areaSize.height,
      zoom,
      panX,
      panY,
    );
  }, [areaSize.height, areaSize.width, imageSize.height, imageSize.width, mapAreaRef, panX, panY, zoom]);

  const {
    draft: arrowDraft,
    drawHandlers,
    shouldSuppressClick: shouldSuppressArrowClick,
  } = useMapArrowDraw({
    enabled: arrowDrawEnabled,
    color: routeDrawColor,
    clientToPercent: clientToMapPercent,
    onComplete: (fromLeft, fromTop, toLeft, toTop) => {
      onAddRouteArrow?.(fromLeft, fromTop, toLeft, toTop);
      setArrowDrawMode(false);
    },
  });

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
      if (arrowDrawMode) {
        setArrowDrawMode(false);
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
  }, [arrowDrawMode, imageModal, onClose, placingTaskId]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldSuppressClick() || shouldSuppressArrowClick()) return;

    // Con dibujo de flechas, el tap ya lo gestiona useMapArrowDraw.
    if (arrowDrawEnabled) return;

    const point = clientToMapPercent(e.clientX, e.clientY);
    if (!point) return;

    if (placingTaskId) {
      onSetCustomMapMarker(mapKey, placingTaskId, point);
      setPlacingTaskId(null);
      return;
    }

    onAddRoutePoint?.(point.left, point.top);
  };

  const mapClickable =
    Boolean(placingTaskId) || Boolean(onAddRoutePoint) || arrowDrawEnabled;

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
        {arrowDrawMode && (
          <div className="map-modal-place-banner map-modal-place-banner--arrow">
            <span>{t.routesDrawArrowHint}</span>
            <button
              type="button"
              className="btn btn-ghost map-modal-place-cancel"
              onClick={() => setArrowDrawMode(false)}
            >
              {t.routesDrawArrowCancel}
            </button>
          </div>
        )}
        <div className="map-modal-body">
          <div
            ref={setMapAreaRef}
            className={`map-modal-map-area${mapClickable ? ' map-modal-map-area--placing' : ''}${zoom > 1 ? ' map-modal-map-area--zoomed' : ''}${isPanning ? ' is-panning' : ''}${arrowDrawEnabled ? ' is-drawing-arrow' : ''}`}
            onPointerDown={(event) => {
              if (arrowDrawEnabled) {
                drawHandlers.onPointerDown?.(event);
              }
              // Pan con izquierdo por defecto; en modo flecha, rueda/Alt.
              if (!arrowDrawEnabled || event.button !== 0 || event.altKey) {
                panHandlers.onPointerDown?.(event);
              }
            }}
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
                onClick={mapClickable ? handleMapClick : undefined}
                role={mapClickable ? 'button' : undefined}
                tabIndex={mapClickable ? 0 : undefined}
                aria-label={
                  placingTaskId
                    ? t.mapPlaceBanner(placingTask?.name ?? '')
                    : canEditRoutePoints
                      ? t.mapRoutePointsEditHint
                      : undefined
                }
              >
                <img
                  ref={imageRef}
                  src={mapUrl}
                  alt={mapName}
                  className="map-modal-image"
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
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
            {canProject && (
              <RouteMapArrows
                arrows={routeArrows}
                draft={arrowDraft}
                project={projectMarker}
                markerIdPrefix={`map-modal-arrow-${mapKey}`}
                onRemoveArrow={onRemoveRouteArrow}
                removeLabel={t.routesRemoveArrow}
              />
            )}
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
                  const documentStyle = isKeyDocumentMarkerType(point.markerType);
                  const imageCaption = imageCaptionForPoint(point);
                  const markerLabel = documentStyle
                    ? (point.label?.trim() || markerTypeTitle(point.markerType, t))
                    : iconMarker
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
                        documentStyle ? 'route-map-marker--kb' : '',
                        isUndergroundKeyDocumentMarkerType(point.markerType) ? 'route-map-marker--kb-underground' : '',
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
                          ? (imageCaption || undefined)
                          : (iconMarker ? markerLabel : (point.label?.trim() || t.routesFixedSection))
                      }
                      aria-label={
                        documentStyle
                          ? markerLabel
                          : iconMarker
                            ? markerLabel
                            : (point.label?.trim() || t.routesPointLabel(index + 1))
                      }
                      onMouseEnter={(e) => {
                        if (!point.imageUrl || imageModal) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setImageTooltip({
                          pointId: point.id,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          src: point.imageUrl,
                          label: imageCaption,
                          documentStyle,
                        });
                      }}
                      onMouseLeave={() => setImageTooltip(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (point.imageUrl) {
                          setImageTooltip(null);
                          setImageModal({
                            src: point.imageUrl,
                            label: imageCaption,
                            documentStyle,
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
                  const label = personalPointTitle(point, index, colorLabels, t.routesPointLabel);
                  const markerLabel = point.label?.trim() || t.routesPointLabelPlaceholder;
                  const style = {
                    left: pos.x,
                    top: pos.y,
                    '--route-marker-color': point.color,
                    zIndex: 2,
                  } as CSSProperties;
                  if (onRemoveRoutePoint) {
                    return (
                      <button
                        key={point.id}
                        type="button"
                        className="route-map-marker"
                        style={style}
                        title={`${label} — ${t.routesRemovePoint}`}
                        aria-label={`${label}. ${t.routesRemovePoint}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveRoutePoint(point.id);
                        }}
                      >
                        <span className="route-map-marker-body">
                          <span className="route-map-marker-label">{markerLabel}</span>
                          <span className="route-map-marker-pin" />
                        </span>
                      </button>
                    );
                  }
                  return (
                    <div
                      key={point.id}
                      className="route-map-marker"
                      style={style}
                      title={label}
                      aria-label={label}
                    >
                      <span className="route-map-marker-body">
                        <span className="route-map-marker-label">{markerLabel}</span>
                        <span className="route-map-marker-pin" />
                      </span>
                    </div>
                  );
                })}
                {markers.map((marker) => {
                  if (hiddenQuestMarkerIds.has(marker.id)) return null;
                  const pos = projectMarker(marker.left, marker.top);
                  if (!pos) return null;
                  const description = marker.custom
                    ? t.mapMarkerManual
                    : marker.objectiveDescription;
                  const traderImage = getTraderImagePath(marker.trader);
                  const isHovered =
                    mapTooltip?.id === marker.id || highlightedMarkerId === marker.id;
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
                        const task = tasksById.get(marker.taskId);
                        highlightLegendPoint(marker.id);
                        setMapTooltip({
                          id: marker.id,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          title: marker.taskName,
                          subtitle: marker.trader.name,
                          description,
                          iconSrc: traderImage,
                          iconAlt: marker.trader.name,
                          items: task ? getQuestItemRequirements(task) : undefined,
                          anyItemLabel: t.anyItem,
                        });
                      }}
                      onMouseLeave={() => {
                        setMapTooltip(null);
                        setHighlightedMarkerId((current) =>
                          current === marker.id ? null : current,
                        );
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        hideQuestMarker(marker.id);
                      }}
                    >
                      <span className="map-quest-marker-pin" />
                      <span className="map-quest-marker-label">{marker.taskName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {hasLeftLegend && (
            <aside
              className={`map-modal-legend map-modal-legend--left${leftLegendCollapsed ? ' is-collapsed' : ''}`}
            >
              <button
                type="button"
                className="map-modal-legend-toggle"
                onClick={() => setLeftLegendCollapsed((v) => !v)}
                aria-expanded={!leftLegendCollapsed}
                title={leftLegendCollapsed ? t.mapExpandPanel : t.mapCollapsePanel}
                aria-label={leftLegendCollapsed ? t.mapExpandPanel : t.mapCollapsePanel}
              >
                <span aria-hidden>{leftLegendCollapsed ? '›' : '‹'}</span>
              </button>
              <div className="map-modal-legend-body">
              {(routePoints.length > 0 || canEditRoutePoints) && (
                <section className="map-modal-legend-panel map-modal-legend-panel--points">
                  <header className="map-modal-legend-panel-head">
                    <h4>{t.routesPersonalSection}</h4>
                    <span
                      className="map-modal-legend-count"
                      aria-label={`${routePoints.length}`}
                    >
                      {routePoints.length}
                    </span>
                  </header>
                  {canEditRoutePoints && (
                    <p className="map-modal-place-hint">{t.mapRoutePointsEditHint}</p>
                  )}
                  {routePoints.length === 0 ? (
                    <p className="map-modal-place-hint map-modal-place-hint--empty">{t.routesNoPoints}</p>
                  ) : (
                    <ol className="map-modal-route-points map-modal-route-points--editable">
                      {routePoints.map((point, index) => {
                        const labelValue = editingLabels[point.id] ?? point.label ?? '';
                        return (
                          <li key={point.id} className="map-modal-route-point-row">
                            <span
                              className="route-point-dot"
                              style={{ background: point.color }}
                              aria-hidden
                            />
                            {onUpdateRoutePointLabel ? (
                              <input
                                type="text"
                                className="route-color-name-input map-modal-route-point-input"
                                value={labelValue}
                                placeholder={t.routesPointLabelPlaceholder}
                                maxLength={80}
                                onChange={(e) => {
                                  setEditingLabels((prev) => ({
                                    ...prev,
                                    [point.id]: e.target.value,
                                  }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  e.preventDefault();
                                  const next = labelValue.trim();
                                  if (!next || next === (point.label ?? '')) return;
                                  onUpdateRoutePointLabel(point.id, next);
                                }}
                              />
                            ) : (
                              <span>
                                {personalPointTitle(point, index, colorLabels, t.routesPointLabel)}
                              </span>
                            )}
                            <div className="map-modal-route-point-actions">
                              {onUpdateRoutePointLabel && (
                                <button
                                  type="button"
                                  className="btn-icon-action"
                                  aria-label={t.adminSaveLabel}
                                  title={t.adminSaveLabel}
                                  disabled={
                                    !labelValue.trim()
                                    || labelValue.trim() === (point.label ?? '')
                                  }
                                  onClick={() =>
                                    onUpdateRoutePointLabel(point.id, labelValue.trim())
                                  }
                                >
                                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                                    <path
                                      fill="currentColor"
                                      d="M2.5 1.5h9.2L14.5 4.3v9.2a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Zm1 1v4.5h7v-4.5h-1.2v3.2H5.7V2.5H3.5Zm0 6v4h9v-4h-9Z"
                                    />
                                  </svg>
                                </button>
                              )}
                              {onRemoveRoutePoint && (
                                <button
                                  type="button"
                                  className="btn-icon-action"
                                  aria-label={t.routesRemovePoint}
                                  title={t.routesRemovePoint}
                                  onClick={() => onRemoveRoutePoint(point.id)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              )}
              {(routeArrows.length > 0 || onAddRouteArrow) && (
                <section className="map-modal-legend-panel map-modal-legend-panel--arrows">
                  <header className="map-modal-legend-panel-head">
                    <h4>{t.routesArrowsSection}</h4>
                    <span className="map-modal-legend-count" aria-label={t.routesArrows(routeArrows.length)}>
                      {routeArrows.length}
                    </span>
                  </header>
                  {onAddRouteArrow ? (
                    <button
                      type="button"
                      className={`btn map-modal-arrow-draw-btn${arrowDrawMode ? ' is-active' : ''}`}
                      disabled={!canDrawArrows && !arrowDrawMode}
                      onClick={() => setArrowDrawMode((prev) => !prev)}
                    >
                      <span className="map-modal-arrow-draw-btn-icon" aria-hidden>↗</span>
                      {arrowDrawMode ? t.routesDrawArrowActive : t.routesDrawArrow}
                    </button>
                  ) : null}
                  {arrowDrawMode ? (
                    <p className="map-modal-place-hint">{t.routesDrawArrowHint}</p>
                  ) : null}
                  {routeArrows.length === 0 ? (
                    <p className="map-modal-place-hint map-modal-place-hint--empty">{t.routesNoArrows}</p>
                  ) : (
                    <ol className="map-modal-route-points map-modal-route-points--arrows">
                      {routeArrows.map((arrow, index) => (
                        <li key={arrow.id} className="map-modal-route-point-row">
                          <span className="route-arrow-list-icon" aria-hidden>
                            ↗
                          </span>
                          <span>{t.routesArrowLabel(index + 1)}</span>
                          {onRemoveRouteArrow && (
                            <div className="map-modal-route-point-actions">
                              <button
                                type="button"
                                className="btn-icon-action"
                                aria-label={t.routesRemoveArrow}
                                title={t.routesRemoveArrow}
                                onClick={() => onRemoveRouteArrow(arrow.id)}
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}
              </div>
            </aside>
          )}
          {hasRightLegend && (
            <aside
              className={`map-modal-legend map-modal-legend--right${rightLegendCollapsed ? ' is-collapsed' : ''}`}
            >
              <button
                type="button"
                className="map-modal-legend-toggle"
                onClick={() => setRightLegendCollapsed((v) => !v)}
                aria-expanded={!rightLegendCollapsed}
                title={rightLegendCollapsed ? t.mapExpandPanel : t.mapCollapsePanel}
                aria-label={rightLegendCollapsed ? t.mapExpandPanel : t.mapCollapsePanel}
              >
                <span aria-hidden>{rightLegendCollapsed ? '‹' : '›'}</span>
              </button>
              <div className="map-modal-legend-body">
              {(fixedRoutePoints.length > 0 || mapExtracts.length > 0) && (
                <div className="map-modal-legend-section">
                  <h4>
                    {t.routesFixedPoints(fixedRoutePoints.length + mapExtracts.length)}
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
                  <h4>
                    {t.mapMarkersTitle(
                      markers.filter((marker) => !hiddenQuestMarkerIds.has(marker.id)).length,
                    )}
                  </h4>
                  <ul className="map-modal-legend-list">
                    {legendEntries.map((entry) => {
                      const tooltipLines = entry.points
                        .map((point) =>
                          point.custom
                            ? t.mapMarkerManual
                            : point.description,
                        )
                        .filter(Boolean);
                      const uniqueLines = [...new Set(tooltipLines)];
                      return (
                        <li
                          key={entry.taskId}
                          className={[
                            'map-modal-legend-item',
                            entry.points.some((point) => point.id === highlightedMarkerId)
                              ? 'is-highlighted'
                              : '',
                          ].filter(Boolean).join(' ')}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMapTooltip({
                              id: `legend:${entry.taskId}`,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                              title: entry.taskName,
                              subtitle: entry.traderName,
                              description: uniqueLines.join('\n'),
                              iconSrc: entry.traderImage,
                              iconAlt: entry.traderName,
                              items: entry.requiredItems,
                              anyItemLabel: t.anyItem,
                            });
                          }}
                          onMouseLeave={() => {
                            setMapTooltip((current) =>
                              current?.id === `legend:${entry.taskId}` ? null : current,
                            );
                            setHighlightedMarkerId(null);
                          }}
                        >
                          <div className="map-modal-legend-row">
                            <div className="map-modal-legend-text">
                              <strong className="map-modal-legend-name">{entry.taskName}</strong>
                              <div
                                className="map-modal-legend-point-toggles"
                                role="group"
                                aria-label={entry.taskName}
                              >
                                {entry.points.map((point, pointIndex) => {
                                  const hidden = hiddenQuestMarkerIds.has(point.id);
                                  const pointLabel = point.custom
                                    ? t.mapMarkerManual
                                    : (point.description || t.routesPointLabel(pointIndex + 1));
                                  return (
                                    <label
                                      key={point.id}
                                      ref={(el) => {
                                        if (el) legendPointRefs.current.set(point.id, el);
                                        else legendPointRefs.current.delete(point.id);
                                      }}
                                      className={[
                                        'map-modal-legend-point-toggle',
                                        highlightedMarkerId === point.id ? 'is-highlighted' : '',
                                        hidden ? 'is-hidden-marker' : '',
                                      ].filter(Boolean).join(' ')}
                                      title={pointLabel}
                                      onMouseEnter={() => {
                                        if (!hidden) setHighlightedMarkerId(point.id);
                                      }}
                                      onMouseLeave={() => {
                                        setHighlightedMarkerId((current) =>
                                          current === point.id ? null : current,
                                        );
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={hidden}
                                        onChange={() => {
                                          persistHiddenQuestMarkers((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(point.id)) next.delete(point.id);
                                            else next.add(point.id);
                                            return next;
                                          });
                                          setHighlightedMarkerId(null);
                                        }}
                                      />
                                      <span aria-hidden>{pointIndex + 1}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="map-modal-legend-aside">
                              {entry.traderImage && (
                                <img
                                  className="map-modal-legend-trader"
                                  src={entry.traderImage}
                                  alt={entry.traderName}
                                  title={entry.traderName}
                                  draggable={false}
                                />
                              )}
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
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {tasksWithoutMarkers.length > 0 && (
                <div className="map-modal-legend-section map-modal-legend-muted">
                  <h4>{t.mapMarkersNoLocation(tasksWithoutMarkers.length)}</h4>
                  <p className="map-modal-place-hint">{t.mapPlaceSelectHint}</p>
                  <ul className="map-modal-legend-list">
                    {tasksWithoutMarkers.map((task) => {
                      const tooltipId = `place:${task.id}`;
                      const description = [
                        ...new Set(
                          task.objectives
                            .map((obj) => obj.description.trim())
                            .filter(Boolean),
                        ),
                      ].join('\n');
                      return (
                        <li
                          key={task.id}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMapTooltip({
                              id: tooltipId,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                              title: task.name,
                              subtitle: task.trader.name,
                              description: description || undefined,
                              iconSrc: getTraderImagePath(task.trader),
                              iconAlt: task.trader.name,
                              items: getQuestItemRequirements(task),
                              anyItemLabel: t.anyItem,
                            });
                          }}
                          onMouseLeave={() => {
                            setMapTooltip((current) =>
                              current?.id === tooltipId ? null : current,
                            );
                          }}
                        >
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
                      );
                    })}
                  </ul>
                </div>
              )}
              </div>
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
            className={[
              'route-point-image-modal',
              imageModal.documentStyle ? 'route-point-image-modal--document' : '',
            ].filter(Boolean).join(' ')}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="route-point-image-modal-header">
              <h3>
                {imageModal.documentStyle
                  ? (imageModal.label || t.adminMarkerTypeKeyDocument)
                  : (imageModal.label || t.routesPointImageModal)}
              </h3>
              <button
                type="button"
                className="btn btn-ghost route-point-image-modal-close"
                onClick={() => setImageModal(null)}
              >
                {t.close}
              </button>
            </header>
            <div className="route-point-image-modal-body">
              {imageModal.documentStyle && imageModal.label && (
                <p className="route-point-image-modal-doc-title">{imageModal.label}</p>
              )}
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
              imageTooltip.documentStyle ? 'route-fixed-image-tooltip--document' : '',
              imageTooltip.y < 180 ? 'is-below' : '',
            ].filter(Boolean).join(' ')}
            role="tooltip"
            style={{ left: imageTooltip.x, top: imageTooltip.y }}
          >
            {imageTooltip.documentStyle && imageTooltip.label && (
              <span className="route-fixed-image-tooltip-label">{imageTooltip.label}</span>
            )}
            <img src={imageTooltip.src} alt={imageTooltip.label} />
            {!imageTooltip.documentStyle && imageTooltip.label && (
              <span className="route-fixed-image-tooltip-label">{imageTooltip.label}</span>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
