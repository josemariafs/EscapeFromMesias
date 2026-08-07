import { useCallback, useEffect, useRef, useState } from 'react';
import { CRT_TRANSITION_MS } from '../components/CrtViewTransition';

/** Ejecuta un cambio de vista bajo un flash CRT de 0,7s. */
export function useCrtViewTransition() {
  const [active, setActive] = useState(false);
  const [playId, setPlayId] = useState(0);
  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  }, []);

  const transitionTo = useCallback((apply: () => void) => {
    if (busyRef.current) return;

    busyRef.current = true;
    setPlayId((n) => n + 1);
    setActive(true);
    apply();

    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setActive(false);
      busyRef.current = false;
      timerRef.current = null;
    }, CRT_TRANSITION_MS);
  }, []);

  return { active, playId, transitionTo };
}
