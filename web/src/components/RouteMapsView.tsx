import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import type { Translations } from '../i18n/translations';
import {
  DEFAULT_FIXED_MARKER_TYPE,
  DEFAULT_ROUTE_POINT_COLOR,
  KB_MARKER_ICON_URL,
  QUESTION_MARKER_ICON_URL,
  ROUTE_POINT_COLORS,
  isIconMarkerType,
  markerTypeIconUrl,
  type FixedMarkerType,
  type FixedRouteMapsData,
  type FixedRoutePoint,
  type RouteColorLabels,
  type RouteMapsData,
  type RoutePoint,
} from '../types/routes';
import { mapPercentToAreaPoint, useMapPanZoom } from '../hooks/useMapPanZoom';
import { getMapSvgUrl, ROUTE_MAPS } from '../utils/maps';

export type RouteMapsViewMode = 'user' | 'admin';

function markerTypeTitle(markerType: FixedMarkerType | undefined, t: Translations): string {
  if (markerType === 'kb') return t.adminMarkerTypeKb;
  if (markerType === 'question') return t.adminMarkerTypeQuestion;
  return t.adminMarkerTypeDefault;
}

interface RouteMapsViewProps {
  routes: RouteMapsData;
  fixedRoutes?: FixedRouteMapsData;
  selectedMapKey: string | null;
  onSelectMap: (mapKey: string | null) => void;
  points: RoutePoint[];
  fixedPoints?: FixedRoutePoint[];
  selectedColor: string;
  colorLabels: RouteColorLabels;
  onChangeColor: (color: string) => void;
  onChangeColorLabel?: (color: string, name: string) => void;
  onAddPoint: (left: number, top: number) => void;
  onRemovePoint: (pointId: string) => void;
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
  selectedColor,
  colorLabels,
  onChangeColor,
  onChangeColorLabel,
  onAddPoint,
  onRemovePoint,
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
  } | null>(null);
  const [imageModal, setImageModal] = useState<{
    src: string;
    label: string;
  } | null>(null);
  const [editingLabels, setEditingLabels] = useState<Record<string, string>>({});
  const [showFixedPoints, setShowFixedPoints] = useState(true);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointListItemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const draftImageInputRef = useRef<HTMLInputElement>(null);
  const pointImageInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
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

  const setPointHovered = useCallback((
    pointId: string | null,
    options?: {
      scrollList?: boolean;
      imageUrl?: string;
      label?: string;
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

  const openPointImageModal = useCallback((src: string, label: string) => {
    setImageTooltip(null);
    setImageModal({ src, label });
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
                    className={`route-maps-marker-type-btn route-maps-marker-type-btn--icon${draftMarkerType === 'kb' ? ' active' : ''}`}
                    aria-pressed={draftMarkerType === 'kb'}
                    disabled={busy}
                    onClick={() => onChangeDraftMarkerType('kb')}
                  >
                    <img src={KB_MARKER_ICON_URL} alt="" aria-hidden />
                    {t.adminMarkerTypeKb}
                  </button>
                  <button
                    type="button"
                    className={`route-maps-marker-type-btn route-maps-marker-type-btn--icon${draftMarkerType === 'question' ? ' active' : ''}`}
                    aria-pressed={draftMarkerType === 'question'}
                    disabled={busy}
                    onClick={() => onChangeDraftMarkerType('question')}
                  >
                    <img src={QUESTION_MARKER_ICON_URL} alt="" aria-hidden />
                    {t.adminMarkerTypeQuestion}
                  </button>
                </div>
                {draftMarkerType === 'kb' && (
                  <p className="route-maps-layer-hint">{t.adminMarkerTypeKbHint}</p>
                )}
                {draftMarkerType === 'question' && (
                  <p className="route-maps-layer-hint">{t.adminMarkerTypeQuestionHint}</p>
                )}
              </div>
            )}
            {draftMarkerType === 'default' && (
              <>
                <h3>{t.adminPointLabel}</h3>
                <input
                  type="text"
                  className="route-color-name-input"
                  value={draftLabel}
                  placeholder={t.adminPointLabelPlaceholder}
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

        <section className={`route-maps-points${!isAdmin && !showFixedPoints ? ' is-hidden-layer' : ''}`}>
          <div className="route-maps-points-header">
            <h3>
              {isAdmin
                ? t.routesFixedPoints(fixedPoints.length)
                : t.routesFixedSection}
            </h3>
            {!isAdmin && (
              <button
                type="button"
                className={`btn-icon-ghost route-maps-visibility-toggle${showFixedPoints ? '' : ' is-off'}`}
                aria-label={showFixedPoints ? t.routesHideFixedPoints : t.routesShowFixedPoints}
                aria-pressed={showFixedPoints}
                title={showFixedPoints ? t.routesHideFixedPoints : t.routesShowFixedPoints}
                onClick={() => setShowFixedPoints((prev) => !prev)}
              >
                {showFixedPoints ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                    />
                    <line
                      x1="1"
                      y1="1"
                      x2="23"
                      y2="23"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
          {!isAdmin && showFixedPoints && (
            <p className="route-maps-layer-hint">{t.routesFixedHint}</p>
          )}
          {showFixedPoints && (
            fixedLoading ? (
              <p className="route-maps-empty">{t.routesFixedLoading}</p>
            ) : fixedPoints.length === 0 ? (
              <p className="route-maps-empty">{t.routesNoFixedPoints}</p>
            ) : (
              <ol className="route-maps-point-list">
                {fixedPoints.map((point, index) => {
                  const isHovered = hoveredPointId === point.id;
                  const iconMarker = isIconMarkerType(point.markerType);
                  const iconUrl = markerTypeIconUrl(point.markerType);
                  const labelValue = editingLabels[point.id] ?? point.label ?? '';
                  const pointLabel = iconMarker
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
                        label: iconMarker ? '' : pointLabel,
                        anchorEl: e.currentTarget,
                      })}
                      onMouseLeave={() => setPointHovered(null)}
                    >
                      {iconUrl ? (
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
                      )}
                      {isAdmin && onUpdateFixedLabel ? (
                        <div className="route-maps-fixed-edit">
                          {onUpdateFixedMarkerType && (
                            <div className="route-maps-marker-type-options">
                              <button
                                type="button"
                                className={`route-maps-marker-type-btn${point.markerType !== 'kb' && point.markerType !== 'question' ? ' active' : ''}`}
                                aria-pressed={!iconMarker}
                                disabled={busy}
                                onClick={() => onUpdateFixedMarkerType(point.id, 'default')}
                              >
                                {t.adminMarkerTypeDefault}
                              </button>
                              <button
                                type="button"
                                className={`route-maps-marker-type-btn route-maps-marker-type-btn--icon${point.markerType === 'kb' ? ' active' : ''}`}
                                aria-pressed={point.markerType === 'kb'}
                                disabled={busy}
                                onClick={() => onUpdateFixedMarkerType(point.id, 'kb')}
                              >
                                <img src={KB_MARKER_ICON_URL} alt="" aria-hidden />
                                {t.adminMarkerTypeKb}
                              </button>
                              <button
                                type="button"
                                className={`route-maps-marker-type-btn route-maps-marker-type-btn--icon${point.markerType === 'question' ? ' active' : ''}`}
                                aria-pressed={point.markerType === 'question'}
                                disabled={busy}
                                onClick={() => onUpdateFixedMarkerType(point.id, 'question')}
                              >
                                <img src={QUESTION_MARKER_ICON_URL} alt="" aria-hidden />
                                {t.adminMarkerTypeQuestion}
                              </button>
                            </div>
                          )}
                          {!iconMarker && (
                            <>
                              <input
                                type="text"
                                className="route-color-name-input"
                                value={labelValue}
                                placeholder={t.routesPointLabel(index + 1)}
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
                                point.label?.trim() || '',
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
            )
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
        </div>
        <div className="map-modal-markers map-modal-markers--overlay">
          {(isAdmin || showFixedPoints) && fixedPoints.map((point, index) => {
            const pos = projectMarker(point.left, point.top);
            if (!pos) return null;
            const iconMarker = isIconMarkerType(point.markerType);
            const iconUrl = markerTypeIconUrl(point.markerType);
            const markerLabel = iconMarker
              ? markerTypeTitle(point.markerType, t)
              : (point.label?.trim() || String(index + 1));
            const isHovered = hoveredPointId === point.id;
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
                  isHovered ? 'route-map-marker--hovered' : '',
                  point.imageUrl ? 'route-map-marker--has-image' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  left: pos.x,
                  top: pos.y,
                  '--route-marker-color': point.color,
                  zIndex: isHovered ? 4 : 3,
                } as CSSProperties}
                title={
                  point.imageUrl
                    ? t.routesPointImageModal
                    : isAdmin
                      ? (iconMarker ? t.adminDeletePoint : (point.label?.trim() || t.adminDeletePoint))
                      : (iconMarker ? markerLabel : (point.label?.trim() || t.routesFixedSection))
                }
                aria-label={iconMarker ? markerLabel : (point.label?.trim() || t.routesPointLabel(index + 1))}
                onMouseEnter={(e) => {
                  if (imageModal) return;
                  setPointHovered(point.id, {
                    scrollList: true,
                    imageUrl: point.imageUrl,
                    label: iconMarker ? '' : markerLabel,
                    anchorEl: e.currentTarget,
                  });
                }}
                onMouseLeave={() => setPointHovered(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (point.imageUrl) {
                    openPointImageModal(
                      point.imageUrl,
                      iconMarker ? '' : markerLabel,
                    );
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
            const pos = projectMarker(point.left, point.top);
            if (!pos) return null;
            const playerName = labelForColor(colorLabels, point.color);
            const markerLabel = playerName || String(index + 1);
            const isHovered = hoveredPointId === point.id;
            return (
              <button
                key={point.id}
                type="button"
                className={`route-map-marker${isHovered ? ' route-map-marker--hovered' : ''}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  '--route-marker-color': point.color,
                  zIndex: isHovered ? 3 : 2,
                } as CSSProperties}
                title={playerName ? `${playerName} — ${t.routesRemovePoint}` : t.routesRemovePoint}
                aria-label={playerName || t.routesPointLabel(index + 1)}
                onMouseEnter={() => setPointHovered(point.id, { scrollList: true })}
                onMouseLeave={() => setPointHovered(null)}
                onClick={(e) => {
                  e.stopPropagation();
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

      {imageTooltip && !imageModal && (
        <div
          className="route-fixed-image-tooltip"
          role="tooltip"
          style={{
            left: imageTooltip.x,
            top: imageTooltip.y,
          }}
        >
          <img src={imageTooltip.src} alt={imageTooltip.label} />
          {imageTooltip.label && (
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
