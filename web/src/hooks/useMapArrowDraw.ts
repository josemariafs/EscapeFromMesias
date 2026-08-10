import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { RouteArrowDraft } from '../types/routes';

/** Distancia mínima en px de pantalla para considerar flecha (vs clic de punto). */
const ARROW_THRESHOLD_SQ = 100; // 10px

interface UseMapArrowDrawOptions {
  enabled: boolean;
  color: string;
  /** Convierte coordenadas de cliente → % del mapa. */
  clientToPercent: (clientX: number, clientY: number) => { left: number; top: number } | null;
  onComplete: (fromLeft: number, fromTop: number, toLeft: number, toTop: number) => void;
  /** Clic corto sin arrastre (añadir punto, etc.). */
  onTap?: (left: number, top: number) => void;
}

/**
 * Clic + arrastre sobre el mapa → flecha con preview en vivo.
 * Un clic sin movimiento suficiente dispara `onTap` (si existe).
 */
export function useMapArrowDraw({
  enabled,
  color,
  clientToPercent,
  onComplete,
  onTap,
}: UseMapArrowDrawOptions) {
  const [draft, setDraft] = useState<RouteArrowDraft | null>(null);
  const drawingRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    fromLeft: number;
    fromTop: number;
    active: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const clearWindowListeners = useRef<(() => void) | null>(null);

  const stopTracking = useCallback(() => {
    clearWindowListeners.current?.();
    clearWindowListeners.current = null;
  }, []);

  const shouldSuppressClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        'button, a, input, label, .route-map-marker, .map-quest-marker, .route-map-arrows line',
      )
    ) {
      return;
    }

    const start = clientToPercent(event.clientX, event.clientY);
    if (!start) return;

    event.preventDefault();
    event.stopPropagation();

    stopTracking();
    const drawing = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      fromLeft: start.left,
      fromTop: start.top,
      active: false,
    };
    drawingRef.current = drawing;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    const onWindowMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== drawing.pointerId) return;
      const dx = moveEvent.clientX - drawing.startClientX;
      const dy = moveEvent.clientY - drawing.startClientY;
      if (!drawing.active) {
        if (dx * dx + dy * dy <= ARROW_THRESHOLD_SQ) return;
        drawing.active = true;
      }

      const end = clientToPercent(moveEvent.clientX, moveEvent.clientY);
      if (!end) return;
      setDraft({
        fromLeft: drawing.fromLeft,
        fromTop: drawing.fromTop,
        toLeft: end.left,
        toTop: end.top,
        color,
      });
    };

    const onWindowUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== drawing.pointerId) return;
      stopTracking();
      drawingRef.current = null;
      setDraft(null);

      try {
        (upEvent.target as HTMLElement | null)?.releasePointerCapture?.(upEvent.pointerId);
      } catch {
        // ignore
      }

      if (drawing.active) {
        const end = clientToPercent(upEvent.clientX, upEvent.clientY);
        if (end) {
          suppressClickRef.current = true;
          onComplete(drawing.fromLeft, drawing.fromTop, end.left, end.top);
        }
        return;
      }

      // Tap: no hubo arrastre suficiente.
      if (onTap) {
        suppressClickRef.current = true;
        onTap(drawing.fromLeft, drawing.fromTop);
      }
    };

    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
    clearWindowListeners.current = () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
    };
  }, [clientToPercent, color, enabled, onComplete, onTap, stopTracking]);

  return {
    draft,
    isDrawing: draft != null,
    drawHandlers: enabled
      ? {
          onPointerDown,
        }
      : {},
    shouldSuppressClick,
  };
}
