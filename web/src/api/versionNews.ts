export interface VersionNews {
  news: string;
  updatedAt: string | null;
}

/** GET público / PUT admin vía stats/visit (límite Hobby de funciones). */
const VERSION_NEWS_URL = '/api/stats/visit?view=version-news';

export async function fetchVersionNews(): Promise<VersionNews> {
  const res = await fetch(VERSION_NEWS_URL);
  if (!res.ok) {
    throw new Error(`version-news ${res.status}`);
  }
  return (await res.json()) as VersionNews;
}

export async function saveVersionNews(token: string, news: string): Promise<VersionNews> {
  const res = await fetch(VERSION_NEWS_URL, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ news }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `version-news ${res.status}`);
  }
  return (await res.json()) as VersionNews;
}
