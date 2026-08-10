import type { CSSProperties } from 'react';
import type { RouteArrow, RouteArrowDraft } from '../types/routes';

interface ProjectedPoint {
  x: number;
  y: number;
}

interface RouteMapArrowsProps {
  arrows: RouteArrow[];
  draft?: RouteArrowDraft | null;
  project: (left: number, top: number) => ProjectedPoint | null;
  markerIdPrefix: string;
  onRemoveArrow?: (arrowId: string) => void;
  removeLabel?: string;
}

const ARROW_STROKE_WIDTH = 12;
const ARROW_HIT_WIDTH = 28;
const MARKER_ID = 'head';

function ArrowLine({
  from,
  to,
  gradientId,
  markerId,
  interactive,
  onClick,
  title,
}: {
  from: ProjectedPoint;
  to: ProjectedPoint;
  gradientId: string;
  markerId: string;
  interactive?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return null;

  return (
    <g>
      <defs>
        <linearGradient
          id={gradientId}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#15803d" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#22c55e" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#86efac" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* Hit area más ancha para poder pulsar/eliminar */}
      {interactive && (
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="transparent"
          strokeWidth={ARROW_HIT_WIDTH}
          style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
          onPointerDown={(event) => {
            // Evita iniciar dibujo/pan al eliminar.
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onClick?.();
          }}
        >
          {title ? <title>{title}</title> : null}
        </line>
      )}
      {/* Halo suave */}
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={`url(#${gradientId})`}
        strokeWidth={ARROW_STROKE_WIDTH + 6}
        strokeLinecap="round"
        opacity={0.35}
        pointerEvents="none"
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={`url(#${gradientId})`}
        strokeWidth={ARROW_STROKE_WIDTH}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        pointerEvents="none"
      />
      <circle
        cx={from.x}
        cy={from.y}
        r={ARROW_STROKE_WIDTH * 0.45}
        fill="#15803d"
        fillOpacity={0.55}
        pointerEvents="none"
      />
    </g>
  );
}

/** Overlay de flechas proyectadas sobre el área del mapa (fuera del transform del zoom). */
export function RouteMapArrows({
  arrows,
  draft,
  project,
  markerIdPrefix,
  onRemoveArrow,
  removeLabel,
}: RouteMapArrowsProps) {
  const markerId = `${markerIdPrefix}-${MARKER_ID}`;

  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    overflow: 'visible',
    // Solo las hit-areas de flecha capturan eventos; el resto deja pasar el dibujo/pan.
    pointerEvents: 'none',
    zIndex: 3,
  };

  return (
    <svg className="route-map-arrows" style={style} aria-hidden={!onRemoveArrow}>
      <defs>
        <marker
          id={markerId}
          markerWidth="2.2"
          markerHeight="2.2"
          refX="1.9"
          refY="1.1"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L2.2,1.1 L0,2.2 Z" fill="#86efac" fillOpacity="0.55" />
        </marker>
      </defs>

      {arrows.map((arrow) => {
        const from = project(arrow.fromLeft, arrow.fromTop);
        const to = project(arrow.toLeft, arrow.toTop);
        if (!from || !to) return null;
        return (
          <ArrowLine
            key={arrow.id}
            from={from}
            to={to}
            gradientId={`${markerIdPrefix}-grad-${arrow.id}`}
            markerId={markerId}
            interactive={Boolean(onRemoveArrow)}
            onClick={onRemoveArrow ? () => onRemoveArrow(arrow.id) : undefined}
            title={removeLabel}
          />
        );
      })}

      {draft && (() => {
        const from = project(draft.fromLeft, draft.fromTop);
        const to = project(draft.toLeft, draft.toTop);
        if (!from || !to) return null;
        return (
          <ArrowLine
            from={from}
            to={to}
            gradientId={`${markerIdPrefix}-grad-draft`}
            markerId={markerId}
          />
        );
      })()}
    </svg>
  );
}
