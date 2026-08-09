export const FIXED_MARKER_TYPES = ['default', 'kb-document', 'question'] as const;

/** Valores legados aceptados en lectura/escritura y normalizados al canónico. */
const LEGACY_MARKER_ALIASES: Record<string, FixedMarkerType> = {
  kb: 'kb-document',
};

export type FixedMarkerType = (typeof FIXED_MARKER_TYPES)[number];

export const DEFAULT_FIXED_MARKER_TYPE: FixedMarkerType = 'default';

/** Marcadores con icono propio (sin número/texto sobre el mapa). */
export function isIconMarkerType(value: string | null | undefined): boolean {
  return value === 'kb' || value === 'kb-document' || value === 'question';
}

/** Tipos que no permiten etiqueta persistida. */
export function isLabellessMarkerType(value: string | null | undefined): boolean {
  return value === 'question';
}

export function isKeyDocumentMarkerType(value: string | null | undefined): boolean {
  return value === 'kb' || value === 'kb-document';
}

export function resolveMarkerType(value: string | null | undefined): FixedMarkerType {
  if (!value) return DEFAULT_FIXED_MARKER_TYPE;
  const trimmed = value.trim().toLowerCase();
  if (trimmed in LEGACY_MARKER_ALIASES) {
    return LEGACY_MARKER_ALIASES[trimmed];
  }
  if ((FIXED_MARKER_TYPES as readonly string[]).includes(trimmed)) {
    return trimmed as FixedMarkerType;
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
  if (trimmed in LEGACY_MARKER_ALIASES) {
    return { ok: true, value: LEGACY_MARKER_ALIASES[trimmed] };
  }
  if ((FIXED_MARKER_TYPES as readonly string[]).includes(trimmed)) {
    return { ok: true, value: trimmed as FixedMarkerType };
  }
  return { ok: false, error: 'Invalid markerType' };
}
