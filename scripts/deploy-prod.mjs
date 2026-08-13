/**
 * Deploy a Vercel Production.
 * Uso (desde la raiz del repo):
 *   npm run deploy:prod
 *   node scripts/deploy-prod.mjs
 *
 * Las "Novedades de version" se editan en /admin (Turso), no en el deploy.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function main() {
  await run('npx', ['vercel', '--prod', '--yes', '--scope', 'ramesias'], repoRoot);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
