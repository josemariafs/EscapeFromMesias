import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { flushSync } from 'react-dom';
import type { Translations } from '../i18n/translations';
import {
  allowsFixedPointLabel,
  DEFAULT_FIXED_MARKER_TYPE,
  DEFAULT_ROUTE_POINT_COLOR,
  isIconMarkerType,
  isKeyDocumentMarkerType,
  KB_MARKER_ICON_URL,
  markerTypeIconUrl,
  QUESTION_MARKER_ICON_URL,
  ROUTE_POINT_COLORS,
  type FixedMarkerType,
  type FixedRouteMapsData,
  type FixedRoutePoint,
  type RouteColorLabels,
  type RouteMapsData,
  type RoutePoint,
} from '../types/routes';
import { areaPointToMapPercent, mapPercentToAreaPoint, useMapPanZoom } from '../hooks/useMapPanZoom';
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
import { getMapSvgUrl, ROUTE_MAPS } from '../utils/maps';
import { FixedLayerToggles } from './FixedLayerToggles';
import {
  MapFloatingTooltip,
  type MapFloatingTooltipData,
} from './MapFloatingTooltip';

const MARKER_DRAG_THRESHOLD_SQ = 25; // 5px

export type RouteMapsViewMode = 'user' | 'admin';

function markerTypeTitle(markerType: FixedMarkerType | undefined, t: Translations): string {
  if (isKeyDocumentMarkerType(markerType)) return t.adminMarkerTypeKeyDocument;
  if (markerType === 'question') return t.adminMarkerTypeQuestion;
  return t.adminMarkerTypeDefault;
}

/** Texto mostrado junto a la imagen (hover / modal). */
function imageCaptionForPoint(point: FixedRoutePoint): string {
  if (allowsFixedPointLabel(point.markerType)) {
    return point.label?.trim() || '';
  }
  return '';
}

interface RouteMapsViewProps {
  routes: RouteMapsData;
  fixedRoutes?: FixedRouteMapsData;
  selectedMapKey: string | null;
  onSelectMap: (mapKey: string | null) => void;
  points: RoutePoint[];
  fixedPoints?: FixedRoutePoint[];
  /** Extracciones PMC/SCAV del mapa seleccionado (automáticas). */
  mapExtracts?: MapExtractMarker[];
  selectedColor: string;
  colorLabels: RouteColorLabels;
  onChangeColor: (color: string) => void;
  onChangeColorLabel?: (color: string, name: string) => void;
  onAddPoint: (left: number, top: number) => void;
  onRemovePoint: (pointId: string) => void;
  onMovePoint?: (pointId: string, left: number, top: number) => void;
  onUndoLast?: () => void;
  onClearMap?: () => void;
  mode?: RouteMapsViewMode;
  draftLabel?: string;
  onChangeDraftLabel?: (label: string) => void;
  draftImageUrl?: string | null;
  onChangeDraftImageFile?: (file: File | null) => void;
  onClearDraftImage?: () => void;
  draftMarkerType?: FixedMarkerType;
  onChangeDraftMarkerType?: (markerType: FixedMarkerType) => void;
  onRemoveFixedPoint?: (pointId: string) => void;
  onMoveFixedPoint?: (pointId: string, left: number, top: number) => void;
  onUpdateFixedLabel?: (pointId: string, label: string) => void;
  onUpdateFixedImage?: (pointId: string, file: File | null) => void;
  onUpdateFixedMarkerType?: (pointId: string, markerType: FixedMarkerType) => void;
  fixedLoading?: boolean;
  fixedError?: string | null;
  busy?: boolean;
  title?: string;
  hint?: string;
  t: Translations;
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

function labelForColor(colorLabels: RouteColorLabels, color: string): string {
  return colorLabels[color]?.trim() ?? '';
}

export function RouteMapsView({
  routes,
  fixedRoutes = {},
  selectedMapKey,
  onSelectMap,
  points,
  fixedPoints = [],
  mapExtracts = [],
  selectedColor,
  colorLabels,
  onChangeColor,
  onChangeColorLabel,
  onAddPoint,
  onRemovePoint,
  onMovePoint,
  onUndoLast,
  onClearMap,
  mode = 'user',
  draftLabel = '',
  onChangeDraftLabel,
  draftImageUrl = null,
  onChangeDraftImageFile,
  onClearDraftImage,
  draftMarkerType = DEFAULT_FIXED_MARKER_TYPE,
  onChangeDraftMarkerType,
  onRemoveFixedPoint,
  onMoveFixedPoint,
  onUpdateFixedLabel,
  onUpdateFixedImage,
  onUpdateFixedMarkerType,
  fixedLoading = false,
  fixedError = null,
  busy = false,
  title,
  hint,
  t,
}: RouteMapsViewProps) {
  const isAdmin = mode === 'admin';
  const selectedMap = ROUTE_MAPS.find((m) => m.key === selectedMapKey) ?? null;
  const mapUrl = selectedMapKey ? getMapSvgUrl(selectedMapKey) : null;

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 });
  const [customColor, setCustomColor] = useState<string>(DEFAULT_ROUTE_POINT_COLOR);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [imageTooltip, setImageTooltip] = useState<{
    pointId: string;
    x: number;
    y: number;
    src: string;
    label: string;
    documentStyle: boolean;
  } | null>(null);
  const [imageModal, setImageModal] = useState<{
    src: string;
    label: string;
    documentStyle: boolean;
  } | null>(null);
  const [extractTooltip, setExtractTooltip] = useState<
    (MapFloatingTooltipData & { id: string }) | null
  >(null);
  const [editingLabels, setEditingLabels] = useState<Record<string, string>>({});
  const { visibility: fixedLayerVisibility, toggleLayer: toggleFixedLayer } =
    useFixedLayerVisibility();
  /** Lista de fijos colapsada por defecto (los ojos por tipo controlan el mapa). */
  const [fixedAccordionOpen, setFixedAccordionOpen] = useState(false);

  const visibleFixedPoints = useMemo(
    () =>
      fixedPoints.filter((point) => fixedLayerVisibility[fixedMarkerLayerId(point.markerType)]),
    [fixedPoints, fixedLayerVisibility],
  );

  const visibleExtracts = useMemo(
    () =>
      mapExtracts.filter((extract) =>
        isExtractLayerVisible(extract.faction, fixedLayerVisibility),
      ),
    [mapExtracts, fixedLayerVisibility],
  );

  const fixedTotalCount = fixedPoints.length + mapExtracts.length;
  const anyFixedLayerVisible =
    visibleFixedPoints.length > 0 || visibleExtracts.length > 0;
  const [dragState, setDragState] = useState<{
    id: string;
    kind: 'personal' | 'fixed';
    left: number;
    top: number;
  } | null>(null);
  /** Posición mostrada tras soltar hasta que `points`/`fixedPoints` reflejen el guardado. */
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, { left: number; top: number }>
  >({});
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointListItemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const draftImageInputRef = useRef<HTMLInputElement>(null);
  const pointImageInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const dragStartClientRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
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
  } = useMapPanZoom(selectedMapKey);

  const projectMarker = useCallback((left: number, top: number) => {
    if (imageSize.width <= 0 || areaSize.width <= 0) return null;
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
  }, [areaSize.height, areaSize.width, imageSize.height, imageSize.width, panX, panY, zoom]);

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

  const beginMarkerDrag = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
    kind: 'personal' | 'fixed',
    left: number,
    top: number,
  ) => {
    if (busy) return;
    if (kind === 'personal' && (!onMovePoint || isAdmin)) return;
    if (kind === 'fixed' && (!onMoveFixedPoint || !isAdmin)) return;

    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragMovedRef.current = false;
    dragStartClientRef.current = { x: event.clientX, y: event.clientY };
    const next = { id, kind, left, top };
    dragStateRef.current = next;
    setDragState(next);
  }, [busy, isAdmin, onMoveFixedPoint, onMovePoint]);

  const onMarkerPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragStateRef.current;
    if (!current) return;
    const start = dragStartClientRef.current;
    if (start) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (dx * dx + dy * dy >= MARKER_DRAG_THRESHOLD_SQ) {
        dragMovedRef.current = true;
      }
    }
    if (!dragMovedRef.current) return;
    const pct = clientToMapPercent(event.clientX, event.clientY);
    if (!pct) return;
    const next = { ...current, left: pct.left, top: pct.top };
    dragStateRef.current = next;
    setDragState(next);
  }, [clientToMapPercent]);

  const endMarkerDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragStateRef.current;
    if (!current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const moved = dragMovedRef.current;
    // Última posición del puntero al soltar (por si el último move no se aplicó).
    const pct = moved ? clientToMapPercent(event.clientX, event.clientY) : null;
    const final = pct
      ? { ...current, left: pct.left, top: pct.top }
      : current;
    dragStartClientRef.current = null;
    if (!moved) {
      setDragState(null);
      dragStateRef.current = null;
      return;
    }

    // Mantener la posición visual mientras el padre aplica el guardado.
    setPositionOverrides((prev) => ({
      ...prev,
      [final.id]: { left: final.left, top: final.top },
    }));
    flushSync(() => {
      if (final.kind === 'personal' && onMovePoint) {
        onMovePoint(final.id, final.left, final.top);
      } else if (final.kind === 'fixed' && onMoveFixedPoint) {
        onMoveFixedPoint(final.id, final.left, final.top);
      }
    });
    setDragState(null);
    dragStateRef.current = null;
  }, [clientToMapPercent, onMoveFixedPoint, onMovePoint]);

  const consumeDragClick = useCallback(() => {
    if (!dragMovedRef.current) return false;
    dragMovedRef.current = false;
    return true;
  }, []);

  const resolvePointPosition = useCallback((point: { id: string; left: number; top: number }) => {
    if (dragState?.id === point.id) {
      return { left: dragState.left, top: dragState.top };
    }
    const override = positionOverrides[point.id];
    if (override) return override;
    return { left: point.left, top: point.top };
  }, [dragState, positionOverrides]);

  // Quitar overrides cuando los props ya traen la posición guardada.
  useEffect(() => {
    setPositionOverrides((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const id of ids) {
        const point =
          points.find((p) => p.id === id)
          ?? fixedPoints.find((p) => p.id === id);
        if (!point) {
          delete next[id];
          changed = true;
          continue;
        }
        const o = prev[id];
        if (Math.abs(point.left - o.left) < 0.001 && Math.abs(point.top - o.top) < 0.001) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [fixedPoints, points]);

  const setPointHovered = useCallback((
    pointId: string | null,
    options?: {
      scrollList?: boolean;
      imageUrl?: string;
      label?: string;
      documentStyle?: boolean;
      anchorEl?: HTMLElement | null;
    },
  ) => {
    setHoveredPointId(pointId);
    if (options?.scrollList && pointId) {
      pointListItemRefs.current.get(pointId)?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
    if (pointId && options?.imageUrl && options.anchorEl) {
      const rect = options.anchorEl.getBoundingClientRect();
      setImageTooltip({
        pointId,
        x: rect.left + rect.width / 2,
        y: rect.top,
        src: options.imageUrl,
        label: options.label ?? '',
        documentStyle: Boolean(options.documentStyle),
      });
    } else if (!pointId || !options?.imageUrl) {
      setImageTooltip(null);
    }
  }, []);

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
    setEditingLabels({});
    setImageModal(null);
    setExtractTooltip(null);
  }, [selectedMapKey]);

  useEffect(() => {
    if (!imageModal) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImageModal(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [imageModal]);

  useEffect(() => {
    if (isAdmin) return;
    if (!(ROUTE_POINT_COLORS as readonly string[]).includes(selectedColor)) {
      onChangeColor(DEFAULT_ROUTE_POINT_COLOR);
    }
  }, [isAdmin, selectedColor, onChangeColor]);

  const openPointImageModal = useCallback((
    src: string,
    label: string,
    documentStyle = false,
  ) => {
    setImageTooltip(null);
    setImageModal({ src, label, documentStyle });
  }, []);

  const colorInputValue = (ROUTE_POINT_COLORS as readonly string[]).includes(selectedColor)
    ? customColor
    : selectedColor;

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (busy) return;
    if (shouldSuppressClick()) return;
    const wrap = imageWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const left = ((event.clientX - rect.left) / rect.width) * 100;
    const top = ((event.clientY - rect.top) / rect.height) * 100;
    onAddPoint(left, top);
  };

  if (!selectedMap || !mapUrl) {
    return (
      <div className="route-maps-view">
        <header className="route-maps-intro">
          <h2>{title ?? t.routesTitle}</h2>
          <p>{hint ?? t.routesHint}</p>
          {fixedError && <p className="route-maps-error">{t.routesFixedLoadError}</p>}
        </header>
        <div className="route-maps-grid">
          {ROUTE_MAPS.map((map) => {
            const personalCount = routes[map.key]?.length ?? 0;
            const fixedCount = fixedRoutes[map.key]?.length ?? 0;
            const thumbUrl = getMapSvgUrl(map.key);
            return (
              <button
                key={map.key}
                type="button"
                className="route-map-card"
                onClick={() => onSelectMap(map.key)}
              >
                <span className="route-map-card-thumb" aria-hidden>
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  ) : null}
                </span>
                <span className="route-map-card-info">
                  <span className="route-map-card-name">{map.name}</span>
                  <span className="route-map-card-meta">
                    {isAdmin
                      ? (fixedCount > 0 ? t.routesFixedPoints(fixedCount) : t.routesOpenMap)
                      : personalCount + fixedCount > 0
                        ? [
                            personalCount > 0 ? t.routesPoints(personalCount) : null,
                            fixedCount > 0 ? t.routesFixedPoints(fixedCount) : null,
                          ].filter(Boolean).join(' · ')
                        : t.routesOpenMap}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const editorHint = isAdmin ? t.adminDrawHint : t.routesDrawHint;

  return (
    <div className={`route-maps-view route-maps-view--editor${busy ? ' is-busy' : ''}`}>
      <aside className="route-maps-sidebar">
        <button
          type="button"
          className="btn btn-reset route-maps-back"
          onClick={() => onSelectMap(null)}
        >
          ← {t.routesBackToMaps}
        </button>

        <h2 className="route-maps-map-title">{selectedMap.name}</h2>
        <p className="route-maps-editor-hint">{editorHint}</p>
        {fixedError && <p className="route-maps-error">{t.routesFixedLoadError}</p>}
        {busy && <p className="route-maps-busy">{t.adminWorking}</p>}

        <section className="route-maps-colors">
          <h3>{t.routesPointColor}</h3>
          <div className="route-color-rows" role="group" aria-label={t.routesPointColor}>
            {ROUTE_POINT_COLORS.map((color) => {
              const playerName = labelForColor(colorLabels, color);
              return (
                <div
                  key={color}
                  className={`route-color-row${selectedColor === color ? ' active' : ''}`}
                >
                  <button
                    type="button"
                    className={`route-color-swatch${selectedColor === color ? ' active' : ''}`}
                    style={{ background: color }}
                    aria-label={playerName || color}
                    aria-pressed={selectedColor === color}
                    onClick={() => onChangeColor(color)}
                  />
                  {!isAdmin && onChangeColorLabel ? (
                    <input
                      type="text"
                      className="route-color-name-input"
                      value={colorLabels[color] ?? ''}
                      placeholder={t.routesPlayerNamePlaceholder}
                      maxLength={24}
                      onFocus={() => onChangeColor(color)}
                      onChange={(e) => onChangeColorLabel(color, e.target.value)}
                    />
                  ) : (
                    <span className="route-color-swatch-hex">{color}</span>
                  )}
                </div>
              );
            })}
          </div>
          {isAdmin && (
            <div className={`route-color-row route-color-row--custom${
              !(ROUTE_POINT_COLORS as readonly string[]).includes(selectedColor) ? ' active' : ''
            }`}
            >
              <label className="route-color-custom" title={t.routesCustomColor}>
                <input
                  type="color"
                  value={colorInputValue}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    onChangeColor(e.target.value);
                  }}
                />
              </label>
              <span className="route-color-swatch-hex">{colorInputValue}</span>
            </div>
          )}
        </section>

        {isAdmin && onChangeDraftLabel && (
          <section className="route-maps-label-draft">
            {onChangeDraftMarkerType && (
              <div className="route-maps-marker-type">
                <h3>{t.adminMarkerType}</h3>
                <div className="route-maps-marker-type-options" role="group" aria-label={t.adminMarkerType}>
                  <button
                    type="button"
                    className={`route-maps-marker-type-btn${draftMarkerType === 'default' ? ' active' : ''}`}
                    aria-pressed={draftMarkerType === 'default'}
                    disabled={busy}
                    onClick={() => onChangeDraftMarkerType('default')}
                  >
                    {t.adminMarkerTypeDefault}
                  </button>
                  <button
                    type="button"
                    className={`route-maps-marker-type-btn route-maps-marker-type-btn--icon${draftMarkerType === 'kb-document' ? ' active' : ''}`}
                    aria-pressed={draftMarkerType === 'kb-document'}
                    aria-label={t.adminMarkerTypeKeyDocument}
                    title={t.adminMarkerTypeKeyDocument}
                    disabled={busy}
                    onClick={() => onChangeDraftMarkerType('kb-document')}
                  >
                    <img src={KB_MARKER_ICON_URL} alt="" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`route-maps-marker-type-btn route-maps-marker-type-btn--icon${draftMarkerType === 'question' ? ' active' : ''}`}
                    aria-pressed={draftMarkerType === 'question'}
                    aria-label={t.adminMarkerTypeQuestion}
                    title={t.adminMarkerTypeQuestion}
                    disabled={busy}
                    onClick={() => onChangeDraftMarkerType('question')}
                  >
                    <img src={QUESTION_MARKER_ICON_URL} alt="" aria-hidden />
                  </button>
                </div>
                {draftMarkerType === 'kb-document' && (
                  <p className="route-maps-layer-hint">{t.adminMarkerTypeKeyDocumentHint}</p>
                )}
                {draftMarkerType === 'question' && (
                  <p className="route-maps-layer-hint">{t.adminMarkerTypeQuestionHint}</p>
                )}
              </div>
            )}
            {allowsFixedPointLabel(draftMarkerType) && (
              <>
                <h3>{t.adminPointLabel}</h3>
                <input
                  type="text"
                  className="route-color-name-input"
                  value={draftLabel}
                  placeholder={
                    draftMarkerType === 'kb-document'
                      ? t.adminKeyDocumentLabelPlaceholder
                      : t.adminPointLabelPlaceholder
                  }
                  maxLength={80}
                  onChange={(e) => onChangeDraftLabel(e.target.value)}
                />
              </>
            )}
            {onChangeDraftImageFile && (
              <div className="route-maps-image-draft">
                <h3>{t.adminPointImage}</h3>
                <p className="route-maps-layer-hint">{t.adminPointImageHint}</p>
                <div className="route-maps-image-actions">
                  <input
                    ref={draftImageInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      onChangeDraftImageFile(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-reset"
                    disabled={busy}
                    onClick={() => draftImageInputRef.current?.click()}
                  >
                    {t.adminPointImageUpload}
                  </button>
                  {draftImageUrl && onClearDraftImage && (
                    <button
                      type="button"
                      className="btn btn-wipe"
                      disabled={busy}
                      onClick={onClearDraftImage}
                    >
                      {t.adminPointImageClear}
                    </button>
                  )}
                </div>
                {draftImageUrl && (
                  <img
                    className="route-maps-image-thumb"
                    src={draftImageUrl}
                    alt=""
                  />
                )}
              </div>
            )}
          </section>
        )}

        <section
          className={[
            'route-maps-points',
            'route-maps-points--fixed-accordion',
            !anyFixedLayerVisible && fixedTotalCount > 0 ? 'is-hidden-layer' : '',
            fixedAccordionOpen ? 'is-open' : 'is-collapsed',
          ].filter(Boolean).join(' ')}
        >
          <div className="route-maps-points-header route-maps-accordion-header">
            <button
              type="button"
              className="route-maps-accordion-trigger"
              aria-expanded={fixedAccordionOpen}
              onClick={() => setFixedAccordionOpen((open) => !open)}
            >
              <span className="route-maps-accordion-chevron" aria-hidden>
                {fixedAccordionOpen ? '▾' : '▸'}
              </span>
              <h3>
                {isAdmin
                  ? t.routesFixedPoints(fixedTotalCount)
                  : `${t.routesFixedSection}${fixedTotalCount > 0 ? ` (${fixedTotalCount})` : ''}`}
              </h3>
            </button>
          </div>
          <FixedLayerToggles
            fixedPoints={fixedPoints}
            extracts={mapExtracts}
            visibility={fixedLayerVisibility}
            onToggle={toggleFixedLayer}
            t={t}
          />
          {fixedAccordionOpen && (
            <div className="route-maps-accordion-body">
              {!isAdmin && (
                <p className="route-maps-layer-hint">{t.routesFixedHint}</p>
              )}
              {fixedLoading ? (
                <p className="route-maps-empty">{t.routesFixedLoading}</p>
              ) : fixedTotalCount === 0 ? (
                <p className="route-maps-empty">{t.routesNoFixedPoints}</p>
              ) : (
              <ol className="route-maps-point-list">
                {mapExtracts.map((extract) => {
                  const isHovered = hoveredPointId === extract.id;
                  const hidden = !isExtractLayerVisible(extract.faction, fixedLayerVisibility);
                  const factionLabel = extractFactionLabel(extract.faction, {
                    pmc: t.routesExtractPmc,
                    scav: t.routesExtractScav,
                    shared: t.routesExtractShared,
                  });
                  return (
                    <li
                      key={extract.id}
                      ref={(el) => {
                        if (el) pointListItemRefs.current.set(extract.id, el);
                        else pointListItemRefs.current.delete(extract.id);
                      }}
                      className={[
                        'route-maps-point-item--fixed',
                        'route-maps-point-item--icon',
                        'route-maps-point-item--extract',
                        hidden ? 'is-layer-hidden' : '',
                        isHovered ? 'route-maps-point-item--hovered' : '',
                      ].filter(Boolean).join(' ') || undefined}
                      onMouseEnter={(e) => setPointHovered(extract.id, {
                        scrollList: false,
                        label: extract.name,
                        anchorEl: e.currentTarget,
                      })}
                      onMouseLeave={() => setPointHovered(null)}
                    >
                      <img
                        className="route-point-icon-thumb"
                        src={extractIconUrl(extract.faction)}
                        alt=""
                        draggable={false}
                      />
                      <div className="route-maps-point-meta">
                        <strong>{extract.name}</strong>
                        <span className="route-maps-point-extract-faction">{factionLabel}</span>
                      </div>
                    </li>
                  );
                })}
                {(isAdmin ? fixedPoints : visibleFixedPoints).map((point, index) => {
                  const isHovered = hoveredPointId === point.id;
                  const iconMarker = isIconMarkerType(point.markerType);
                  const iconUrl = markerTypeIconUrl(point.markerType);
                  const canEditLabel = allowsFixedPointLabel(point.markerType);
                  const documentStyle = isKeyDocumentMarkerType(point.markerType);
                  const labelValue = editingLabels[point.id] ?? point.label ?? '';
                  const imageCaption = imageCaptionForPoint(point);
                  const pointLabel = documentStyle
                    ? (point.label?.trim() || t.adminMarkerTypeKeyDocument)
                    : iconMarker
                      ? markerTypeTitle(point.markerType, t)
                      : (point.label?.trim() || t.routesPointLabel(index + 1));
                  return (
                    <li
                      key={point.id}
                      ref={(el) => {
                        if (el) pointListItemRefs.current.set(point.id, el);
                        else pointListItemRefs.current.delete(point.id);
                      }}
                      className={[
                        'route-maps-point-item--fixed',
                        iconMarker ? 'route-maps-point-item--icon' : '',
                        isHovered ? 'route-maps-point-item--hovered' : '',
                      ].filter(Boolean).join(' ') || undefined}
                      onMouseEnter={(e) => setPointHovered(point.id, {
                        imageUrl: point.imageUrl,
                        label: imageCaption,
                        documentStyle,
                        anchorEl: e.currentTarget,
                      })}
                      onMouseLeave={() => setPointHovered(null)}
                    >
                      {/* En admin el selector de tipo ya muestra el icono; evita el KB duplicado. */}
                      {!isAdmin && (
                        iconUrl ? (
                          <img
                            className="route-point-icon-thumb"
                            src={iconUrl}
                            alt=""
                            aria-hidden
                          />
                        ) : (
                          <span
                            className="route-point-dot route-point-dot--fixed"
                            style={{ background: point.color }}
                            aria-hidden
                          />
                        )
                      )}
                      {isAdmin && onUpdateFixedLabel ? (
                        <div className="route-maps-fixed-edit">
                          {onUpdateFixedMarkerType && (
                            <div className="route-maps-marker-type-options">
                              <button
                                type="button"
                                className={`route-maps-marker-type-btn${point.markerType === 'default' || !point.markerType ? ' active' : ''}`}
                                aria-pressed={point.markerType === 'default' || !point.markerType}
                                disabled={busy}
                                onClick={() => onUpdateFixedMarkerType(point.id, 'default')}
                              >
                                {t.adminMarkerTypeDefault}
                              </button>
                              <button
                                type="button"
                                className={`route-maps-marker-type-btn route-maps-marker-type-btn--icon${isKeyDocumentMarkerType(point.markerType) ? ' active' : ''}`}
                                aria-pressed={isKeyDocumentMarkerType(point.markerType)}
                                aria-label={t.adminMarkerTypeKeyDocument}
                                title={t.adminMarkerTypeKeyDocument}
                                disabled={busy}
                                onClick={() => onUpdateFixedMarkerType(point.id, 'kb-document')}
                              >
                                <img src={KB_MARKER_ICON_URL} alt="" aria-hidden />
                              </button>
                              <button
                                type="button"
                                className={`route-maps-marker-type-btn route-maps-marker-type-btn--icon${point.markerType === 'question' ? ' active' : ''}`}
                                aria-pressed={point.markerType === 'question'}
                                aria-label={t.adminMarkerTypeQuestion}
                                title={t.adminMarkerTypeQuestion}
                                disabled={busy}
                                onClick={() => onUpdateFixedMarkerType(point.id, 'question')}
                              >
                                <img src={QUESTION_MARKER_ICON_URL} alt="" aria-hidden />
                              </button>
                            </div>
                          )}
                          {canEditLabel && (
                            <>
                              <input
                                type="text"
                                className="route-color-name-input"
                                value={labelValue}
                                placeholder={
                                  documentStyle
                                    ? t.adminKeyDocumentLabelPlaceholder
                                    : t.routesPointLabel(index + 1)
                                }
                                maxLength={80}
                                onChange={(e) => {
                                  setEditingLabels((prev) => ({
                                    ...prev,
                                    [point.id]: e.target.value,
                                  }));
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-reset"
                                disabled={busy || labelValue.trim() === (point.label ?? '')}
                                onClick={() => onUpdateFixedLabel(point.id, labelValue.trim())}
                              >
                                {t.adminSaveLabel}
                              </button>
                            </>
                          )}
                          {onUpdateFixedImage && (
                            <div className="route-maps-image-actions">
                              <input
                                ref={(el) => {
                                  if (el) pointImageInputRefs.current.set(point.id, el);
                                  else pointImageInputRefs.current.delete(point.id);
                                }}
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  onUpdateFixedImage(point.id, file);
                                  e.target.value = '';
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-reset"
                                disabled={busy}
                                onClick={() => pointImageInputRefs.current.get(point.id)?.click()}
                              >
                                {point.imageUrl ? t.adminPointImageUpload : t.adminPointImage}
                              </button>
                              {point.imageUrl && (
                                <button
                                  type="button"
                                  className="btn btn-wipe"
                                  disabled={busy}
                                  onClick={() => onUpdateFixedImage(point.id, null)}
                                >
                                  {t.adminPointImageClear}
                                </button>
                              )}
                            </div>
                          )}
                          {point.imageUrl && (
                            <button
                              type="button"
                              className="route-maps-image-thumb-btn"
                              onClick={() => openPointImageModal(
                                point.imageUrl!,
                                imageCaption,
                                documentStyle,
                              )}
                              title={t.routesPointImageModal}
                            >
                              <img
                                className="route-maps-image-thumb"
                                src={point.imageUrl}
                                alt=""
                              />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="route-maps-point-label">
                          {pointLabel}
                          {point.imageUrl && (
                            <span className="route-maps-has-image" aria-hidden title={t.adminPointImage}>
                              <svg viewBox="0 0 16 16" width="12" height="12">
                                <rect
                                  x="1.5"
                                  y="3.5"
                                  width="13"
                                  height="9"
                                  rx="1.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                />
                                <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                              </svg>
                            </span>
                          )}
                        </span>
                      )}
                      {isAdmin && onRemoveFixedPoint && (
                        <button
                          type="button"
                          className="btn-icon-close"
                          aria-label={t.adminDeletePoint}
                          disabled={busy}
                          onClick={() => onRemoveFixedPoint(point.id)}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
              )}
            </div>
          )}
        </section>

        {!isAdmin && (
          <section className="route-maps-points">
            <div className="route-maps-points-header">
              <h3>{t.routesPersonalSection}</h3>
              <div className="route-maps-point-actions">
                {onUndoLast && (
                  <button
                    type="button"
                    className="btn btn-reset"
                    disabled={points.length === 0}
                    onClick={onUndoLast}
                  >
                    {t.routesUndo}
                  </button>
                )}
                {onClearMap && (
                  <button
                    type="button"
                    className="btn btn-wipe"
                    disabled={points.length === 0}
                    onClick={() => {
                      if (window.confirm(t.routesConfirmClear)) onClearMap();
                    }}
                  >
                    {t.routesClear}
                  </button>
                )}
              </div>
            </div>
            {points.length === 0 ? (
              <p className="route-maps-empty">{t.routesNoPoints}</p>
            ) : (
              <ol className="route-maps-point-list">
                {points.map((point, index) => {
                  const playerName = labelForColor(colorLabels, point.color);
                  const isHovered = hoveredPointId === point.id;
                  return (
                    <li
                      key={point.id}
                      ref={(el) => {
                        if (el) pointListItemRefs.current.set(point.id, el);
                        else pointListItemRefs.current.delete(point.id);
                      }}
                      className={isHovered ? 'route-maps-point-item--hovered' : undefined}
                      onMouseEnter={() => setPointHovered(point.id, {})}
                      onMouseLeave={() => setPointHovered(null)}
                    >
                      <span
                        className="route-point-dot"
                        style={{ background: point.color }}
                        aria-hidden
                      />
                      <span>
                        {playerName || t.routesPointLabel(index + 1)}
                      </span>
                      <button
                        type="button"
                        className="btn-icon-close"
                        aria-label={t.routesRemovePoint}
                        onClick={() => onRemovePoint(point.id)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}
      </aside>

      <div
        className={`route-maps-canvas map-modal-map-area map-modal-map-area--placing${zoom > 1 ? ' map-modal-map-area--zoomed' : ''}${isPanning ? ' is-panning' : ''}`}
        ref={setMapAreaRef}
        {...panHandlers}
      >
        <div
          className="map-modal-image-wrap"
          ref={imageWrapRef}
          style={{
            ...(imageSize.width > 0 ? { width: imageSize.width, height: imageSize.height } : undefined),
            ...contentStyle,
          }}
          onClick={handleMapClick}
        >
          <img
            ref={imageRef}
            className="map-modal-image"
            src={mapUrl}
            alt={selectedMap.name}
            onLoad={updateImageSize}
            draggable={false}
          />
          {/* Encima del SVG (mismo wrap, después del img) para no quedar tapado. */}
          {selectedMap && getMapZoneAnnotations(selectedMap.key).map((zone) => (
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
        <div className="map-modal-markers map-modal-markers--overlay">
          {visibleExtracts.map((extract) => {
            const pos = projectMarker(extract.left, extract.top);
            if (!pos) return null;
            const isHovered =
              hoveredPointId === extract.id || extractTooltip?.id === extract.id;
            const factionLabel = extractFactionLabel(extract.faction, {
              pmc: t.routesExtractPmc,
              scav: t.routesExtractScav,
              shared: t.routesExtractShared,
            });
            const accent = extractMarkerColor(extract.faction);
            const iconSrc = extractIconUrl(extract.faction);
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
                  if (imageModal || dragState) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPointHovered(extract.id, {
                    scrollList: true,
                    label: extract.name,
                    anchorEl: e.currentTarget,
                  });
                  setExtractTooltip({
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
                onMouseLeave={() => {
                  if (dragState) return;
                  setPointHovered(null);
                  setExtractTooltip(null);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="route-map-marker-body">
                  <span className="route-map-marker-label route-map-marker-label--extract">
                    {extract.name}
                  </span>
                  <img
                    className="route-map-marker-icon"
                    src={extractIconUrl(extract.faction)}
                    alt=""
                    draggable={false}
                  />
                </span>
              </button>
            );
          })}
          {(isAdmin ? fixedPoints : visibleFixedPoints).map((point, index) => {
            const { left: displayLeft, top: displayTop } = resolvePointPosition(point);
            const pos = projectMarker(displayLeft, displayTop);
            if (!pos) return null;
            const iconMarker = isIconMarkerType(point.markerType);
            const iconUrl = markerTypeIconUrl(point.markerType);
            const documentStyle = isKeyDocumentMarkerType(point.markerType);
            const imageCaption = imageCaptionForPoint(point);
            const markerLabel = documentStyle
              ? (point.label?.trim() || t.adminMarkerTypeKeyDocument)
              : iconMarker
                ? markerTypeTitle(point.markerType, t)
                : (point.label?.trim() || String(index + 1));
            const isHovered = hoveredPointId === point.id;
            const canDragFixed = isAdmin && Boolean(onMoveFixedPoint) && !busy;
            const isDragging = dragState?.id === point.id;
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
                  isHovered ? 'route-map-marker--hovered' : '',
                  point.imageUrl ? 'route-map-marker--has-image' : '',
                  canDragFixed ? 'route-map-marker--draggable' : '',
                  isDragging ? 'route-map-marker--dragging' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  left: pos.x,
                  top: pos.y,
                  '--route-marker-color': point.color,
                  zIndex: isDragging ? 6 : isHovered ? 4 : 3,
                } as CSSProperties}
                title={
                  point.imageUrl
                    ? (imageCaption || t.routesPointImageModal)
                    : isAdmin
                      ? (iconMarker ? t.adminDeletePoint : (point.label?.trim() || t.adminDeletePoint))
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
                  if (imageModal || dragState) return;
                  setPointHovered(point.id, {
                    scrollList: true,
                    imageUrl: point.imageUrl,
                    label: imageCaption,
                    documentStyle,
                    anchorEl: e.currentTarget,
                  });
                }}
                onMouseLeave={() => {
                  if (dragState) return;
                  setPointHovered(null);
                }}
                onPointerDown={(e) => {
                  if (!canDragFixed) return;
                  beginMarkerDrag(e, point.id, 'fixed', displayLeft, displayTop);
                }}
                onPointerMove={onMarkerPointerMove}
                onPointerUp={endMarkerDrag}
                onPointerCancel={endMarkerDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  if (consumeDragClick()) return;
                  if (point.imageUrl) {
                    openPointImageModal(point.imageUrl, imageCaption, documentStyle);
                    return;
                  }
                  if (isAdmin && onRemoveFixedPoint && !busy) {
                    onRemoveFixedPoint(point.id);
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
          {!isAdmin && points.map((point, index) => {
            const { left: displayLeft, top: displayTop } = resolvePointPosition(point);
            const pos = projectMarker(displayLeft, displayTop);
            if (!pos) return null;
            const playerName = labelForColor(colorLabels, point.color);
            const markerLabel = playerName || String(index + 1);
            const isHovered = hoveredPointId === point.id;
            const canDragPersonal = Boolean(onMovePoint) && !busy;
            const isDragging = dragState?.id === point.id;
            return (
              <button
                key={point.id}
                type="button"
                className={[
                  'route-map-marker',
                  isHovered ? 'route-map-marker--hovered' : '',
                  canDragPersonal ? 'route-map-marker--draggable' : '',
                  isDragging ? 'route-map-marker--dragging' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  left: pos.x,
                  top: pos.y,
                  '--route-marker-color': point.color,
                  zIndex: isDragging ? 5 : isHovered ? 3 : 2,
                } as CSSProperties}
                title={playerName ? `${playerName} — ${t.routesRemovePoint}` : t.routesRemovePoint}
                aria-label={playerName || t.routesPointLabel(index + 1)}
                onMouseEnter={() => {
                  if (dragState) return;
                  setPointHovered(point.id, { scrollList: true });
                }}
                onMouseLeave={() => {
                  if (dragState) return;
                  setPointHovered(null);
                }}
                onPointerDown={(e) => {
                  if (!canDragPersonal) return;
                  beginMarkerDrag(e, point.id, 'personal', displayLeft, displayTop);
                }}
                onPointerMove={onMarkerPointerMove}
                onPointerUp={endMarkerDrag}
                onPointerCancel={endMarkerDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  if (consumeDragClick()) return;
                  onRemovePoint(point.id);
                }}
              >
                <span className="route-map-marker-body">
                  <span className="route-map-marker-label">{markerLabel}</span>
                  <span className="route-map-marker-pin" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <MapFloatingTooltip tooltip={extractTooltip} />

      {imageTooltip && !imageModal && (
        <div
          className={[
            'route-fixed-image-tooltip',
            imageTooltip.documentStyle ? 'route-fixed-image-tooltip--document' : '',
          ].filter(Boolean).join(' ')}
          role="tooltip"
          style={{
            left: imageTooltip.x,
            top: imageTooltip.y,
          }}
        >
          {imageTooltip.documentStyle && imageTooltip.label && (
            <span className="route-fixed-image-tooltip-label">{imageTooltip.label}</span>
          )}
          <img src={imageTooltip.src} alt={imageTooltip.label} />
          {!imageTooltip.documentStyle && imageTooltip.label && (
            <span className="route-fixed-image-tooltip-label">{imageTooltip.label}</span>
          )}
        </div>
      )}

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
    </div>
  );
}
