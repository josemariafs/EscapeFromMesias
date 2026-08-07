export const FIXED_MARKER_TYPES = ['default', 'kb', 'question'] as const;

export type FixedMarkerType = (typeof FIXED_MARKER_TYPES)[number];

export const DEFAULT_FIXED_MARKER_TYPE: FixedMarkerType = 'default';

/** Marcadores con icono propio (sin etiqueta de texto en el mapa). */
export function isIconMarkerType(value: string | null | undefined): boolean {
  return value === 'kb' || value === 'question';
}

export function resolveMarkerType(value: string | null | undefined): FixedMarkerType {
  if (value && (FIXED_MARKER_TYPES as readonly string[]).includes(value)) {
    return value as FixedMarkerType;
  }
  return DEFAULT_FIXED_MARKER_TYPE;
}

export function normalizeMarkerType(value: unknown): {
  ok: true;
  value: FixedMarkerType | undefined;
} | {
  ok: false;
  error: string;
} {
  if (value === undefined) return { ok: true, value: undefined };
  if (value == null || value === '') {
    return { ok: true, value: DEFAULT_FIXED_MARKER_TYPE };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'Invalid markerType' };
  }
  const trimmed = value.trim().toLowerCase();
  if ((FIXED_MARKER_TYPES as readonly string[]).includes(trimmed)) {
    return { ok: true, value: trimmed as FixedMarkerType };
  }
  return { ok: false, error: 'Invalid markerType' };
}
