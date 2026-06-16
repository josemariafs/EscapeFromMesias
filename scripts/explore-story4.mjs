const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name tarkovDataId lightkeeperRequired kappaRequired restartable requiredPrestige { id } } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

// tarkovDataId distribution
const ids = tasks.map((t) => t.tarkovDataId).filter(Boolean).sort((a, b) => a - b);
console.log('tarkovDataId range', ids[0], '-', ids[ids.length - 1], 'count', ids.length);

// Group by id ranges
const ranges = [[0, 100], [100, 200], [200, 300], [300, 400], [400, 500], [500, 600], [600, 700], [700, 800], [800, 900], [900, 1000]];
for (const [lo, hi] of ranges) {
  const inRange = tasks.filter((t) => t.tarkovDataId >= lo && t.tarkovDataId < hi);
  if (inRange.length) {
    console.log(`${lo}-${hi}: ${inRange.length} (LK ${inRange.filter(t=>t.lightkeeperRequired).length}) e.g. ${inRange.slice(0,2).map(t=>t.name).join(', ')}`);
  }
}

// prestige required
const prestige = tasks.filter((t) => t.requiredPrestige);
console.log('prestige required:', prestige.length, prestige.slice(0,5).map(t=>t.name));
