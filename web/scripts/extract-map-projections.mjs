import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(
  readFileSync(
    'C:/Users/rames/.cursor/projects/c-Users-rames-Documents-Dev-EscapeFromMesias/agent-tools/4d5f98f5-da68-423f-af8c-a7caa98afed1.txt',
    'utf8',
  ),
);

const keys = new Set([
  'factory',
  'customs',
  'woods',
  'lighthouse',
  'shoreline',
  'reserve',
  'interchange',
  'streets-of-tarkov',
  'the-lab',
  'ground-zero',
  'terminal',
]);

const out = {};
for (const entry of raw) {
  if (!keys.has(entry.normalizedName)) continue;
  const interactive = entry.maps.find((m) => m.projection === 'interactive');
  if (!interactive) continue;
  out[entry.normalizedName] = {
    transform: interactive.transform,
    coordinateRotation: interactive.coordinateRotation ?? 0,
    bounds: interactive.bounds,
    svgBounds: interactive.svgBounds ?? null,
  };
}

writeFileSync(
  'src/data/mapProjections.json',
  JSON.stringify(out, null, 2) + '\n',
);
console.log(Object.keys(out));
