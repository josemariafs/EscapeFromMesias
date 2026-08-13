import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from 'react';
import { submitKbDocumentReport } from '../api/kbReports';
import {
  areaPointToMapPercent,
  useMapPanZoom,
} from '../hooks/useMapPanZoom';
import type { Translations } from '../i18n/translations';
import {
  KB_MARKER_ICON_URL,
  type RouteEnvironment,
} from '../types/routes';
import { getMapSvgUrl, ROUTE_MAPS } from '../utils/maps';
import { fileToCompressedDataUrl } from '../utils/routePointImage';

interface KbDocumentReportModalProps {
  open: boolean;
  onClose: () => void;
  defaultEnvironment: RouteEnvironment;
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

export function KbDocumentReportModal({
  open,
  onClose,
  defaultEnvironment,
  t,
}: KbDocumentReportModalProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [environment, setEnvironment] = useState<RouteEnvironment>(defaultEnvironment);
  const [mapKey, setMapKey] = useState<string>(ROUTE_MAPS[0]?.key ?? 'customs');
  const [pin, setPin] = useState<{ left: number; top: number } | null>(null);
  const [label, setLabel] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 });

  const mapUrl = getMapSvgUrl(mapKey);
  const {
    setContainerRef: setMapAreaRef,
    containerRef: mapAreaRef,
    zoom,
    panX,
    panY,
    isPanning,
    contentStyle,
    panHandlers,
    shouldSuppressClick,
  } = useMapPanZoom(mapKey);

  const reset = useCallback(() => {
    setEnvironment(defaultEnvironment);
    setMapKey(ROUTE_MAPS[0]?.key ?? 'customs');
    setPin(null);
    setLabel('');
    setImageUrl(null);
    setBusy(false);
    setError(null);
    setDone(false);
    setImageSize({ width: 0, height: 0 });
  }, [defaultEnvironment]);

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
  }, [mapAreaRef]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setEnvironment(defaultEnvironment);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy, reset, defaultEnvironment]);

  useEffect(() => {
    if (!open || !mapUrl) return undefined;
    updateImageSize();
    const area = mapAreaRef.current;
    if (!area) return undefined;
    const observer = new ResizeObserver(() => updateImageSize());
    observer.observe(area);
    return () => observer.disconnect();
  }, [open, mapUrl, mapKey, updateImageSize, mapAreaRef]);

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (busy || done) return;
    if (shouldSuppressClick()) return;
    const area = mapAreaRef.current;
    if (!area || imageSize.width <= 0 || areaSize.width <= 0) return;
    const rect = area.getBoundingClientRect();
    const point = areaPointToMapPercent(
      event.clientX - rect.left,
      event.clientY - rect.top,
      imageSize.width,
      imageSize.height,
      areaSize.width,
      areaSize.height,
      zoom,
      panX,
      panY,
    );
    if (!point) return;
    setPin(point);
    setError(null);
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      setImageUrl(await fileToCompressedDataUrl(file));
    } catch {
      setError(t.kbReportImageError);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || done) return;
    if (!pin) {
      setError(t.kbReportNeedPin);
      return;
    }
    if (!imageUrl) {
      setError(t.kbReportNeedImage);
      return;
    }

    setBusy(true);
    setError(null);
    const result = await submitKbDocumentReport({
      mapKey,
      environment,
      left: pin.left,
      top: pin.top,
      label: label.trim() || undefined,
      imageUrl,
    });
    setBusy(false);
    if (!result.ok) {
      setError(
        result.error === 'session'
          ? t.kbReportSessionError
          : result.error === 'network'
            ? t.kbReportNetworkError
            : t.kbReportSubmitError,
      );
      return;
    }
    setDone(true);
  };

  if (!open) return null;

  return (
    <div className="feedback-modal-backdrop kb-report-modal-backdrop" onClick={() => !busy && onClose()}>
      <div
        className="feedback-modal kb-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="feedback-modal-header">
          <h2 id={titleId}>{t.kbReportTitle}</h2>
          <button
            type="button"
            className="feedback-modal-close"
            onClick={() => !busy && onClose()}
            aria-label={t.close}
          >
            ×
          </button>
        </header>

        {done ? (
          <div className="feedback-modal-body">
            <p className="feedback-modal-success">{t.kbReportSuccess}</p>
            <div className="feedback-modal-actions">
              <button type="button" className="btn btn-start" onClick={onClose}>
                {t.close}
              </button>
            </div>
          </div>
        ) : (
          <form className="feedback-modal-body kb-report-form" onSubmit={(e) => { void handleSubmit(e); }}>
            <p className="kb-report-hint">{t.kbReportHint}</p>

            <div className="kb-report-top-row">
              <fieldset className="kb-report-fieldset">
                <legend>{t.kbReportEnvironment}</legend>
                <div className="segmented" role="radiogroup" aria-label={t.kbReportEnvironment}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={environment === 'regular'}
                    className={`segmented-item${environment === 'regular' ? ' active' : ''}`}
                    onClick={() => setEnvironment('regular')}
                    disabled={busy}
                  >
                    {t.routeEnvironmentRegular}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={environment === 'seasonal'}
                    className={`segmented-item${environment === 'seasonal' ? ' active' : ''}`}
                    onClick={() => setEnvironment('seasonal')}
                    disabled={busy}
                  >
                    {t.routeEnvironmentSeasonal}
                  </button>
                </div>
              </fieldset>

              <label className="kb-report-field">
                <span>{t.kbReportMap}</span>
                <select
                  value={mapKey}
                  disabled={busy}
                  onChange={(e) => {
                    setMapKey(e.target.value);
                    setPin(null);
                  }}
                >
                  {ROUTE_MAPS.map((map) => (
                    <option key={map.key} value={map.key}>{map.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="kb-report-map-block">
              <span className="kb-report-field-label">
                {t.kbReportPlaceHint}
                {zoom > 1 ? ` · ${Math.round(zoom * 100)}%` : ''}
              </span>
              {mapUrl ? (
                <div
                  className={`kb-report-map-area${zoom > 1 ? ' is-zoomed' : ''}${isPanning ? ' is-panning' : ''}`}
                  ref={setMapAreaRef}
                  onPointerDown={panHandlers.onPointerDown}
                  onClick={handleMapClick}
                  role="button"
                  tabIndex={0}
                  aria-label={t.kbReportPlaceHint}
                >
                  <div
                    className="kb-report-map-wrap"
                    style={{
                      width: imageSize.width > 0 ? imageSize.width : undefined,
                      height: imageSize.height > 0 ? imageSize.height : undefined,
                      ...contentStyle,
                    }}
                  >
                    <img
                      ref={imageRef}
                      src={mapUrl}
                      alt=""
                      className="kb-report-map-image"
                      draggable={false}
                      onLoad={updateImageSize}
                    />
                    {pin && (
                      <span
                        className="kb-report-map-pin"
                        style={{ left: `${pin.left}%`, top: `${pin.top}%` }}
                      >
                        <img src={KB_MARKER_ICON_URL} alt="" draggable={false} />
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="feedback-modal-error">{t.kbReportMapMissing}</p>
              )}
            </div>

            <div className="kb-report-bottom-row">
              <label className="kb-report-field">
                <span>{t.kbReportLabel}</span>
                <input
                  type="text"
                  value={label}
                  maxLength={80}
                  placeholder={t.kbReportLabelPlaceholder}
                  disabled={busy}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>

              <div className="kb-report-image-block">
                <span className="kb-report-field-label">{t.kbReportImage}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => { void handleImageChange(e); }}
                />
                <div className="kb-report-image-actions">
                  <button
                    type="button"
                    className="btn btn-reset"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUrl ? t.kbReportImageReplace : t.kbReportImageUpload}
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      className="btn btn-wipe"
                      disabled={busy}
                      onClick={() => setImageUrl(null)}
                    >
                      {t.kbReportImageClear}
                    </button>
                  )}
                </div>
                {imageUrl && (
                  <img className="kb-report-image-preview" src={imageUrl} alt="" />
                )}
              </div>
            </div>

            {error && <p className="feedback-modal-error">{error}</p>}

            <div className="feedback-modal-actions">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
                {t.close}
              </button>
              <button type="submit" className="btn btn-start" disabled={busy}>
                {busy ? t.kbReportSending : t.kbReportSubmit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
