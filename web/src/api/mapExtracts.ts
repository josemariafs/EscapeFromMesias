import { toJsonGameMode, type GameMode, type MapPosition } from '../types';
import {
  projectExtractToMap,
  type MapExtractMarker,
  type MapExtractsData,
} from '../utils/mapExtracts';
import {
  projectPmcSpawnToMap,
  type MapPmcSpawnMarker,
  type MapPmcSpawnsData,
} from '../utils/mapSpawns';

const JSON_API_BASE = 'https://json.tarkov.dev';

type LocaleDict = Record<string, string>;

interface JsonMapExtract {
  id: string;
  name?: string | null;
  faction?: string | null;
  position?: MapPosition | null;
  outline?: MapPosition[] | null;
}

interface JsonMapSpawn {
  position?: MapPosition | null;
  sides?: string[] | null;
  zoneName?: string | null;
}

interface JsonMapWithExtracts {
  id: string;
  name: string;
  normalizedName: string;
  extracts?: JsonMapExtract[] | null;
  spawns?: JsonMapSpawn[] | null;
}

export interface MapGeoData {
  extracts: MapExtractsData;
  pmcSpawns: MapPmcSpawnsData;
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

/** Extracciones y spawns PMC por mapa, proyectados a % sobre el SVG. */
export async function fetchMapGeoData(
  lang: 'es' | 'en' = 'es',
  gameMode: GameMode = 'regular',
): Promise<MapGeoData> {
  const mode = toJsonGameMode(gameMode);
  const [mapsRes, mapsLocaleRes] = await Promise.all([
    fetchJson<{ data: { maps: Record<string, JsonMapWithExtracts> } }>(`/${mode}/maps`),
    fetchJson<{ data: LocaleDict }>(`/${mode}/maps_${lang}`),
  ]);

  const mapsLocale = mapsLocaleRes.data ?? {};
  const byMap: MapExtractsData = {};
  const spawnsByMap: MapPmcSpawnsData = {};

  for (const raw of Object.values(mapsRes.data?.maps ?? {})) {
    if (!raw?.normalizedName) continue;

    if (Array.isArray(raw.extracts)) {
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

    if (Array.isArray(raw.spawns)) {
      raw.spawns.forEach((spawn, spawnIndex) => {
        if (!(spawn.sides ?? []).includes('pmc')) return;
        const marker = projectPmcSpawnToMap(raw.normalizedName, spawn, spawnIndex);
        if (!marker) return;
        const list = spawnsByMap[marker.mapKey] ?? (spawnsByMap[marker.mapKey] = []);
        if (list.some((existing) => existing.id === marker.id)) return;
        list.push(marker);
      });
    }
  }

  for (const list of Object.values(byMap)) {
    list.sort((a, b) => a.name.localeCompare(b.name) || a.faction.localeCompare(b.faction));
  }

  return { extracts: byMap, pmcSpawns: spawnsByMap };
}

/** Extracciones PMC/SCAV/shared por mapa, proyectadas a % sobre el SVG. */
export async function fetchMapExtracts(
  lang: 'es' | 'en' = 'es',
  gameMode: GameMode = 'regular',
): Promise<MapExtractsData> {
  const { extracts } = await fetchMapGeoData(lang, gameMode);
  return extracts;
}

export type { MapExtractMarker, MapExtractsData, MapPmcSpawnMarker, MapPmcSpawnsData };
