import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  getDailyAccessCode,
  getSpanishAuthDayKey,
  hasSiteAccessPasswords,
  resolveSiteLogin,
  resolveSiteSession,
} from './api/_lib/siteAccess';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

/** Emula /api/auth/* en `vite` con la misma lógica que las funciones Vercel. */
function siteAuthDevPlugin(): Plugin {
  return {
    name: 'site-auth-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (
          path !== '/api/auth/login'
          && path !== '/api/auth/session'
          && path !== '/api/auth/daily-code'
        ) {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        if (!hasSiteAccessPasswords()) {
          sendJson(res, 503, {
            error: 'PERMANENT_TOKEN_PUBLIC / PERMANENT_TOKEN_PRIVATE are not configured',
          });
          return;
        }

        const body = await readJsonBody(req);

        if (path === '/api/auth/login') {
          const password = typeof body.password === 'string' ? body.password : '';
          const result = resolveSiteLogin(password);
          if (!result.ok) {
            sendJson(res, 401, { error: 'Invalid password' });
            return;
          }
          sendJson(res, 200, {
            ok: true,
            token: result.token,
            kind: result.kind,
          });
          return;
        }

        if (path === '/api/auth/session') {
          const token = typeof body.token === 'string' ? body.token : '';
          const result = resolveSiteSession(token);
          if (!result.ok) {
            sendJson(res, 401, { ok: false });
            return;
          }
          sendJson(res, 200, { ok: true, kind: result.kind });
          return;
        }

        const token = typeof body.token === 'string' ? body.token : '';
        const session = resolveSiteSession(token);
        if (!session.ok) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        if (session.kind !== 'public') {
          sendJson(res, 403, { error: 'Forbidden' });
          return;
        }

        const code = getDailyAccessCode();
        if (!code) {
          sendJson(res, 503, { error: 'Daily code is not configured' });
          return;
        }

        sendJson(res, 200, {
          ok: true,
          code,
          dayKey: getSpanishAuthDayKey(),
          rotatesAtHour: 5,
          timeZone: 'Europe/Madrid',
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carga .env / .env.local para process.env usado por siteAccess.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [react(), siteAuthDevPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  };
});
