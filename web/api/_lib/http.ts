import type { VercelRequest, VercelResponse } from '@vercel/node';
import { gzipSync } from 'node:zlib';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
};

const GZIP_MIN_BYTES = 1024;

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

export function etagMatches(
  header: string | string[] | undefined,
  etag: string,
): boolean {
  const raw = Array.isArray(header) ? header.join(',') : header ?? '';
  return raw
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === etag || value === `W/${etag}`);
}

export function sendNotModified(
  res: VercelResponse,
  cacheControl?: string,
  etag?: string,
): void {
  applyCors(res);
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  if (etag) res.setHeader('ETag', etag);
  res.status(304).end();
}

export function sendJson(
  req: VercelRequest,
  res: VercelResponse,
  status: number,
  data: unknown,
  headers?: { cacheControl?: string; etag?: string },
): void {
  applyCors(res);
  if (headers?.cacheControl) res.setHeader('Cache-Control', headers.cacheControl);
  if (headers?.etag) res.setHeader('ETag', headers.etag);
  const body = JSON.stringify(data);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const accept = String(req.headers['accept-encoding'] ?? '');
  if (accept.includes('gzip') && body.length >= GZIP_MIN_BYTES) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.status(status).send(gzipSync(Buffer.from(body, 'utf8')));
    return;
  }
  res.status(status).send(body);
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
