import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { QuestItemRequirement } from '../utils/unlock';

export interface MapFloatingTooltipData {
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  description?: string;
  iconSrc?: string | null;
  iconAlt?: string;
  /** Color de acento (borde / subtítulo). */
  accent?: string;
  /** Objetos / llaves necesarios para la misión. */
  items?: QuestItemRequirement[];
  /** Texto para requisitos genéricos (`anyItem`). */
  anyItemLabel?: string;
}

interface MapFloatingTooltipProps {
  tooltip: MapFloatingTooltipData | null;
}

/** Tooltip elegante en portal (por encima del modal / overflow). */
export function MapFloatingTooltip({ tooltip }: MapFloatingTooltipProps) {
  if (!tooltip) return null;

  const style = {
    left: tooltip.x,
    top: tooltip.y,
    ...(tooltip.accent
      ? ({ '--map-tooltip-accent': tooltip.accent } as CSSProperties)
      : {}),
  };

  const items = tooltip.items ?? [];

  return createPortal(
    <div
      className={[
        'map-floating-tooltip',
        tooltip.y < 140 ? 'is-below' : '',
        items.length > 0 ? 'has-items' : '',
      ].filter(Boolean).join(' ')}
      role="tooltip"
      style={style}
    >
      {tooltip.iconSrc && (
        <img
          className="map-floating-tooltip-icon"
          src={tooltip.iconSrc}
          alt={tooltip.iconAlt ?? ''}
          draggable={false}
        />
      )}
      <div className="map-floating-tooltip-body">
        <strong className="map-floating-tooltip-title">{tooltip.title}</strong>
        {tooltip.subtitle && (
          <span className="map-floating-tooltip-subtitle">{tooltip.subtitle}</span>
        )}
        {tooltip.description && (
          <p className="map-floating-tooltip-desc">{tooltip.description}</p>
        )}
        {items.length > 0 && (
          <div className="map-floating-tooltip-items">
            {items.map((req, index) => {
              const chipLabel = req.groupLabel
                ?? (req.anyItem ? (tooltip.anyItemLabel ?? '…') : req.item!.shortName);
              const chipTitle = req.groupLabel
                ?? (req.anyItem ? (tooltip.anyItemLabel ?? '…') : req.item!.name);
              const chipKey = req.groupLabel
                ?? (req.anyItem ? `any-item-${index}` : req.item!.id);

              return (
                <span key={chipKey} className="map-floating-tooltip-item" title={chipTitle}>
                  {!req.anyItem && !req.groupLabel && req.item!.iconLink && (
                    <img src={req.item!.iconLink} alt="" draggable={false} />
                  )}
                  <span>
                    {req.count != null && req.count > 1 ? `${req.count}x ` : ''}
                    {chipLabel}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
