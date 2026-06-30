import { useEffect } from 'react';
import type { Translations } from '../i18n/translations';

interface MapViewerModalProps {
  mapName: string;
  mapUrl: string;
  tarkovDevUrl: string;
  t: Translations;
  onClose: () => void;
}

export function MapViewerModal({
  mapName,
  mapUrl,
  tarkovDevUrl,
  t,
  onClose,
}: MapViewerModalProps) {
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
          <img src={mapUrl} alt={mapName} className="map-modal-image" />
        </div>
      </div>
    </div>
  );
}
