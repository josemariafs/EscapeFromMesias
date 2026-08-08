import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

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

  return createPortal(
    <div
      className={[
        'map-floating-tooltip',
        tooltip.y < 140 ? 'is-below' : '',
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
      </div>
    </div>,
    document.body,
  );
}
