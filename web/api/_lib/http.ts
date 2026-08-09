import type { VercelRequest, VercelResponse } from '@vercel/node';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function applyCors(res: VercelResponse): void {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function readJsonBody<T>(req: VercelRequest): T {
  const body = req.body;
  if (body == null) return {} as T;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as T;
    } catch {
      return {} as T;
    }
  }
  return body as T;
}

export function serverError(res: VercelResponse, err: unknown): void {
  applyCors(res);
  const message = err instanceof Error ? err.message : 'Internal server error';
  const isConfig =
    message.includes('TURSO_DATABASE_URL')
    || message.includes('ADMIN_TOKEN')
    || message.includes('ADMIN_EMAIL')
    || message.includes('RESEND_API_KEY');
  res.status(isConfig ? 503 : 500).json({ error: message });
}
