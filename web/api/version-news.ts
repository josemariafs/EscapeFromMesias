import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthorized, unauthorizedBody } from './_lib/auth.js';
import { ensureSchema, getVersionNews, setVersionNews } from './_lib/db.js';
import { applyCors, handleOptions, readJsonBody, serverError } from './_lib/http.js';

const MAX_NEWS_CHARS = 4000;

interface PutBody {
  news?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const data = await getVersionNews();
      applyCors(res);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(data);
      return;
    }

    if (req.method === 'PUT') {
      if (!isAuthorized(req)) {
        applyCors(res);
        res.status(401).json(unauthorizedBody());
        return;
      }

      const body = readJsonBody<PutBody>(req);
      const news = typeof body.news === 'string' ? body.news : '';
      if (news.length > MAX_NEWS_CHARS) {
        applyCors(res);
        res.status(400).json({ error: `News must be at most ${MAX_NEWS_CHARS} characters` });
        return;
      }

      const data = await setVersionNews(news);
      applyCors(res);
      res.status(200).json(data);
      return;
    }

    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    serverError(res, err);
  }
}
