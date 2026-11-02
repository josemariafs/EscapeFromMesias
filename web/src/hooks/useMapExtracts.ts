import { useEffect, useState } from 'react';
import { fetchMapGeoData, type MapGeoData } from '../api/mapExtracts';
import type { GameMode } from '../types';
import type { MapExtractsData } from '../utils/mapExtracts';
import type { MapPmcSpawnsData } from '../utils/mapSpawns';

const cache = new Map<string, MapGeoData>();

export function useMapExtracts(lang: 'es' | 'en', gameMode: GameMode) {
  const cacheKey = `${gameMode}:${lang}:geo-v1`;
  const [extracts, setExtracts] = useState<MapExtractsData>(
    () => cache.get(cacheKey)?.extracts ?? {},
  );
  const [pmcSpawns, setPmcSpawns] = useState<MapPmcSpawnsData>(
    () => cache.get(cacheKey)?.pmcSpawns ?? {},
  );
  const [loading, setLoading] = useState(() => !cache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(cacheKey);
    if (cached) {
      setExtracts(cached.extracts);
      setPmcSpawns(cached.pmcSpawns);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetchMapGeoData(lang, gameMode)
      .then((data) => {
        if (cancelled) return;
        cache.set(cacheKey, data);
        setExtracts(data.extracts);
        setPmcSpawns(data.pmcSpawns);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setExtracts({});
        setPmcSpawns({});
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, lang, gameMode]);

  return { extracts, pmcSpawns, loading, error };
}
