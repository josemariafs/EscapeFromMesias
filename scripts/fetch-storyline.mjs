/**
 * Descarga la campaña Story desde TarkovBuddy y guarda storyline.json local.
 * Fuente: https://www.tarkovbuddy.org/api/storyline
 */
import fs from 'fs';

const res = await fetch('https://www.tarkovbuddy.org/api/storyline');
if (!res.ok) {
  throw new Error(`HTTP ${res.status} al descargar storyline`);
}

const data = await res.json();
const outPath = 'web/src/data/storyline.json';
fs.mkdirSync('web/src/data', { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

let nodeCount = 0;
for (const tree of Object.values(data.trees)) {
  nodeCount += tree.nodes.length;
}

console.log(`Wrote ${data.chapters.length} chapters, ${nodeCount} nodes → ${outPath}`);
