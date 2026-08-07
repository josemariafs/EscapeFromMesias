import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.12;

interface PanZoomState {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Zoom con rueda (hacia el cursor) y arrastre para panear cuando hay zoom.
 * Usa callback ref para enganchar la rueda en cuanto existe el contenedor del mapa.
 */
export function useMapPanZoom(resetKey: unknown) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const setContainerRef = useCallback((node: HTMLElement | null) => {
    containerRef.current = node;
    setContainer(node);
  }, []);

  const [state, setState] = useState<PanZoomState>({ zoom: 1, panX: 0, panY: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const didPanRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    setState({ zoom: 1, panX: 0, panY: 0 });
    dragRef.current = null;
    didPanRef.current = false;
    setIsPanning(false);
  }, [resetKey]);

  useEffect(() => {
    if (!container) return undefined;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = container.getBoundingClientRect();
      const cursorX = event.clientX - rect.left - rect.width / 2;
      const cursorY = event.clientY - rect.top - rect.height / 2;
      const { zoom, panX, panY } = stateRef.current;

      const direction = event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * direction));
      if (nextZoom === zoom) return;

      const ratio = nextZoom / zoom;
      let nextPanX = cursorX - (cursorX - panX) * ratio;
      let nextPanY = cursorY - (cursorY - panY) * ratio;

      if (nextZoom <= MIN_ZOOM + 0.001) {
        nextPanX = 0;
        nextPanY = 0;
      }

      setState({ zoom: nextZoom, panX: nextPanX, panY: nextPanY });
    };

    container.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => container.removeEventListener('wheel', onWheel, { capture: true });
  }, [container]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if (stateRef.current.zoom <= MIN_ZOOM) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, label')) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: stateRef.current.panX,
      originY: stateRef.current.panY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && dx * dx + dy * dy > 9) {
      drag.moved = true;
    }
    setState((prev) => ({
      ...prev,
      panX: drag.originX + dx,
      panY: drag.originY + dy,
    }));
  }, []);

  const endPan = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    didPanRef.current = drag.moved;
    dragRef.current = null;
    setIsPanning(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const shouldSuppressClick = useCallback(() => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return true;
    }
    return false;
  }, []);

  const contentStyle: CSSProperties = {
    transform: `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`,
    transformOrigin: 'center center',
    willChange: 'transform',
  };

  return {
    containerRef,
    setContainerRef,
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    isPanning,
    contentStyle,
    panHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPan,
      onPointerCancel: endPan,
    },
    shouldSuppressClick,
  };
}

/** Proyecta un punto en % del mapa a coordenadas px del área (fuera del transform). */
export function mapPercentToAreaPoint(
  leftPct: number,
  topPct: number,
  imageWidth: number,
  imageHeight: number,
  areaWidth: number,
  areaHeight: number,
  zoom: number,
  panX: number,
  panY: number,
): { x: number; y: number } {
  const relX = (leftPct / 100) * imageWidth - imageWidth / 2;
  const relY = (topPct / 100) * imageHeight - imageHeight / 2;
  return {
    x: areaWidth / 2 + panX + relX * zoom,
    y: areaHeight / 2 + panY + relY * zoom,
  };
}
