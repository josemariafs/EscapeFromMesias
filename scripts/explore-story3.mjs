const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name lightkeeperRequired kappaRequired trader { name } } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

const story = tasks.filter((t) => t.lightkeeperRequired);
const side = tasks.filter((t) => !t.lightkeeperRequired);

console.log('Story (lightkeeperRequired):', story.length);
console.log('Side:', side.length);

console.log('\nSample STORY:', story.slice(0, 15).map((t) => `${t.name} (${t.trader.name})`));
console.log('\nSample SIDE:', side.slice(0, 15).map((t) => `${t.name} (${t.trader.name})`));

// Known classic side quests
for (const name of ['Debut', 'Checking', 'Shootout Picnic', 'Delivery From the Past', 'The Cultist Circle']) {
  const t = tasks.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (t) console.log(name, '-> LK:', t.lightkeeperRequired);
}

// Known story from tarkovforge chapters
for (const name of ['First in Line', 'Shooting Cans', 'Luxurious Life', 'Talk to Therapist', 'Falling Skies']) {
  const t = tasks.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
  if (t) console.log('found', t.name, '-> LK:', t.lightkeeperRequired);
}
