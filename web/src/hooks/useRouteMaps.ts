import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_ROUTE_POINT_COLOR,
  ROUTE_COLOR_LABELS_STORAGE_KEY,
  ROUTE_MAPS_STORAGE_KEY,
  type RouteColorLabels,
  type RouteMapsData,
  type RoutePoint,
} from '../types/routes';

function readStoredRoutes(): RouteMapsData {
  try {
    const raw = localStorage.getItem(ROUTE_MAPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RouteMapsData;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readStoredColorLabels(): RouteColorLabels {
  try {
    const raw = localStorage.getItem(ROUTE_COLOR_LABELS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RouteColorLabels;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function newPointId(): string {
  return `rp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useRouteMaps() {
  const [routes, setRoutes] = useState<RouteMapsData>(readStoredRoutes);
  const [colorLabels, setColorLabels] = useState<RouteColorLabels>(readStoredColorLabels);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_ROUTE_POINT_COLOR);

  useEffect(() => {
    localStorage.setItem(ROUTE_MAPS_STORAGE_KEY, JSON.stringify(routes));
  }, [routes]);

  useEffect(() => {
    localStorage.setItem(ROUTE_COLOR_LABELS_STORAGE_KEY, JSON.stringify(colorLabels));
  }, [colorLabels]);

  const getPoints = useCallback((mapKey: string): RoutePoint[] => {
    return routes[mapKey] ?? [];
  }, [routes]);

  const setColorLabel = useCallback((color: string, name: string) => {
    setColorLabels((prev) => {
      const trimmed = name.trim();
      if (!trimmed) {
        if (!(color in prev)) return prev;
        const next = { ...prev };
        delete next[color];
        return next;
      }
      if (prev[color] === trimmed) return prev;
      return { ...prev, [color]: trimmed };
    });
  }, []);

  const addPoint = useCallback((mapKey: string, left: number, top: number, color?: string) => {
    const point: RoutePoint = {
      id: newPointId(),
      left: Math.min(100, Math.max(0, left)),
      top: Math.min(100, Math.max(0, top)),
      color: color ?? selectedColor,
    };
    setRoutes((prev) => ({
      ...prev,
      [mapKey]: [...(prev[mapKey] ?? []), point],
    }));
  }, [selectedColor]);

  const removePoint = useCallback((mapKey: string, pointId: string) => {
    setRoutes((prev) => {
      const current = prev[mapKey];
      if (!current) return prev;
      const nextPoints = current.filter((p) => p.id !== pointId);
      const next = { ...prev };
      if (nextPoints.length === 0) {
        delete next[mapKey];
      } else {
        next[mapKey] = nextPoints;
      }
      return next;
    });
  }, []);

  const undoLast = useCallback((mapKey: string) => {
    setRoutes((prev) => {
      const current = prev[mapKey];
      if (!current?.length) return prev;
      const nextPoints = current.slice(0, -1);
      const next = { ...prev };
      if (nextPoints.length === 0) {
        delete next[mapKey];
      } else {
        next[mapKey] = nextPoints;
      }
      return next;
    });
  }, []);

  const clearMap = useCallback((mapKey: string) => {
    setRoutes((prev) => {
      if (!prev[mapKey]) return prev;
      const next = { ...prev };
      delete next[mapKey];
      return next;
    });
  }, []);

  return {
    routes,
    colorLabels,
    selectedColor,
    setSelectedColor,
    setColorLabel,
    getPoints,
    addPoint,
    removePoint,
    undoLast,
    clearMap,
  };
}
