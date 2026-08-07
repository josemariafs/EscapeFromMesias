import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const srcPath = join(tmpdir(), 'Interchange.svg');
const outPath = join('public', 'maps', 'Interchange.svg');

const src = readFileSync(srcPath, 'utf8');
const needle = '<g id="Second_Floor" data-name="Second Floor">';
const replacement = '<g id="Second_Floor" data-name="Second Floor" style="display:none">';

if (!src.includes(needle)) {
  console.error('PATCH_FAILED: Second_Floor marker not found');
  process.exit(1);
}

const patched = src.replace(needle, replacement);
mkdirSync(join('public', 'maps'), { recursive: true });
writeFileSync(outPath, patched);
console.log('Wrote', outPath, 'bytes=', patched.length);
