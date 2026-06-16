import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join('web', 'public', 'traders');

const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ traders { id name normalizedName imageLink image4xLink } }`,
  }),
});

const traders = (await res.json()).data.traders;
fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest = {};

for (const trader of traders) {
  const url = trader.image4xLink || trader.imageLink;
  if (!url) continue;

  const ext = url.endsWith('.webp') ? 'webp' : 'png';
  const filename = `${trader.normalizedName}.${ext}`;
  const filePath = path.join(OUT_DIR, filename);

  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    console.error('Failed', trader.name, imgRes.status);
    continue;
  }

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  manifest[trader.normalizedName] = `/traders/${filename}`;
  manifest[trader.id] = `/traders/${filename}`;
  console.log('Saved', trader.name, '->', filename);
}

fs.writeFileSync(
  path.join('web', 'src', 'data', 'trader-images.json'),
  JSON.stringify(manifest, null, 2),
);

console.log('Done:', Object.keys(manifest).length / 2, 'traders');
