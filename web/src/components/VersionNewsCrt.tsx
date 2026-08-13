import { useEffect, useState } from 'react';
import { fetchVersionNews } from '../api/versionNews';
import { APP_VERSION } from '../buildInfo';
import type { Translations } from '../i18n/translations';

interface VersionNewsCrtProps {
  t: Translations;
}

/** Panel de novedades de versión con estética CRT (home, todos los usuarios). */
export function VersionNewsCrt({ t }: VersionNewsCrtProps) {
  const [news, setNews] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchVersionNews();
        if (!cancelled) setNews(typeof data.news === 'string' ? data.news.trim() : '');
      } catch {
        if (!cancelled) setNews('');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const body = !loaded ? '…' : news || t.versionNewsEmpty;

  return (
    <section className="version-news-crt" aria-label={t.versionNewsTitle}>
      <div className="version-news-crt-bezel">
        <div className="version-news-crt-screen">
          <div className="version-news-crt-fx" aria-hidden>
            <div className="version-news-crt-bg" />
            <div className="version-news-crt-scanlines" />
            <div className="version-news-crt-flicker" />
            <div className="version-news-crt-sweep" />
            <div className="version-news-crt-vignette" />
          </div>
          <div className="version-news-crt-content">
            <header className="version-news-crt-header">
              <span className="version-news-crt-title">{t.versionNewsTitle}</span>
              <span className="version-news-crt-version">v{APP_VERSION}</span>
            </header>
            <div className="version-news-crt-body">{body}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
