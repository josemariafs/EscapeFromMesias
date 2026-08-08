import { useEffect, useState } from 'react';
import { fetchMapExtracts } from '../api/mapExtracts';
import type { GameMode } from '../types';
import type { MapExtractsData } from '../utils/mapExtracts';

const cache = new Map<string, MapExtractsData>();

export function useMapExtracts(lang: 'es' | 'en', gameMode: GameMode) {
  const cacheKey = `${gameMode}:${lang}`;
  const [extracts, setExtracts] = useState<MapExtractsData>(() => cache.get(cacheKey) ?? {});
  const [loading, setLoading] = useState(() => !cache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(cacheKey);
    if (cached) {
      setExtracts(cached);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetchMapExtracts(lang, gameMode)
      .then((data) => {
        if (cancelled) return;
        cache.set(cacheKey, data);
        setExtracts(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setExtracts({});
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, lang, gameMode]);

  return { extracts, loading, error };
}
