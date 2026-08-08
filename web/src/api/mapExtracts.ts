import { toJsonGameMode, type GameMode, type MapPosition } from '../types';
import {
  projectExtractToMap,
  type MapExtractMarker,
  type MapExtractsData,
} from '../utils/mapExtracts';

const JSON_API_BASE = 'https://json.tarkov.dev';

type LocaleDict = Record<string, string>;

interface JsonMapExtract {
  id: string;
  name?: string | null;
  faction?: string | null;
  position?: MapPosition | null;
  outline?: MapPosition[] | null;
}

interface JsonMapWithExtracts {
  id: string;
  name: string;
  normalizedName: string;
  extracts?: JsonMapExtract[] | null;
}

function translate(dict: LocaleDict | undefined, key: string | null | undefined, fallback = ''): string {
  if (!key) return fallback;
  return dict?.[key] ?? (fallback || key);
}

async function fetchJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${JSON_API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('No se pudo contactar con json.tarkov.dev (error de red).');
  }

  if (!response.ok) {
    throw new Error(`json.tarkov.dev error (HTTP ${response.status}) en ${path}`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`json.tarkov.dev devolvió JSON inválido en ${path}`);
  }
}

/** Extracciones PMC/SCAV/shared por mapa, proyectadas a % sobre el SVG. */
export async function fetchMapExtracts(
  lang: 'es' | 'en' = 'es',
  gameMode: GameMode = 'regular',
): Promise<MapExtractsData> {
  const mode = toJsonGameMode(gameMode);
  const [mapsRes, mapsLocaleRes] = await Promise.all([
    fetchJson<{ data: { maps: Record<string, JsonMapWithExtracts> } }>(`/${mode}/maps`),
    fetchJson<{ data: LocaleDict }>(`/${mode}/maps_${lang}`),
  ]);

  const mapsLocale = mapsLocaleRes.data ?? {};
  const byMap: MapExtractsData = {};

  for (const raw of Object.values(mapsRes.data?.maps ?? {})) {
    if (!raw?.normalizedName || !Array.isArray(raw.extracts) || raw.extracts.length === 0) {
      continue;
    }

    for (const extract of raw.extracts) {
      if (!extract?.id) continue;
      const name = translate(mapsLocale, extract.name, extract.name ?? extract.id);
      const marker = projectExtractToMap(raw.normalizedName, {
        ...extract,
        name,
      });
      if (!marker) continue;
      const list = byMap[marker.mapKey] ?? (byMap[marker.mapKey] = []);
      if (list.some((existing) => existing.id === marker.id)) continue;
      list.push(marker);
    }
  }

  for (const list of Object.values(byMap)) {
    list.sort((a, b) => a.name.localeCompare(b.name) || a.faction.localeCompare(b.faction));
  }

  return byMap;
}

export type { MapExtractMarker, MapExtractsData };
