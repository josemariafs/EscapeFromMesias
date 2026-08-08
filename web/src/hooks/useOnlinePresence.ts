import { useEffect, useState } from 'react';
import { fetchOnlineCount, sendPresenceHeartbeat } from '../api/siteStats';
import { readOrCreateVisitorId } from '../utils/visitorId';

const HEARTBEAT_MS = 25_000;
const POLL_MS = 20_000;

/** Heartbeat + conteo de usuarios con actividad reciente en la web. */
export function useOnlinePresence() {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const visitorId = readOrCreateVisitorId();

    const apply = (value: number) => {
      if (!cancelled) setOnline(value);
    };

    const heartbeat = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      try {
        apply(await sendPresenceHeartbeat(visitorId));
      } catch {
        try {
          apply(await fetchOnlineCount());
        } catch {
          // keep last known value
        }
      }
    };

    const poll = async () => {
      try {
        apply(await fetchOnlineCount());
      } catch {
        // ignore
      }
    };

    void heartbeat();

    const heartbeatTimer = window.setInterval(() => {
      void heartbeat();
    }, HEARTBEAT_MS);
    const pollTimer = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void heartbeat();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { online };
}
