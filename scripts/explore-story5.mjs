const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name tarkovDataId lightkeeperRequired trader { name } map { normalizedName } } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

const withId = tasks.filter((t) => t.tarkovDataId != null);
const withoutId = tasks.filter((t) => t.tarkovDataId == null);

console.log('with tarkovDataId:', withId.length);
console.log('without tarkovDataId:', withoutId.length);
console.log('without sample:', withoutId.slice(0, 20).map((t) => t.name));

// Maybe story quests are ones WITHOUT tarkovDataId? (new 1.0 quests)
console.log('\nwithout ID - LK true:', withoutId.filter(t=>t.lightkeeperRequired).length);
console.log('without ID - ground zero map:', withoutId.filter(t=>t.map?.normalizedName==='ground-zero').length);

// Search tarkov.dev for isStory in raw json from cloudflare
const res2 = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ task(id: "657315df034d76585f032e01") { id name tarkovDataId lightkeeperRequired kappaRequired restartable factionName } }`,
  }),
});
console.log('\nShooting Cans:', JSON.stringify((await res2.json()).data.task));

// Try all tasks with map ground-zero as story starter
const gz = tasks.filter((t) => t.map?.normalizedName === 'ground-zero');
console.log('\nGround Zero tasks:', gz.length, gz.map(t => t.name));
