const introspect = async (name) => {
  const res = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{ __type(name: "${name}") { fields { name type { name kind ofType { name } } } } }` }),
  });
  return (await res.json()).data.__type?.fields ?? [];
};

console.log('Quest fields:', (await introspect('Quest')).map((f) => f.name));

const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ quests { id title giver { name } } }`,
  }),
});
const q = await res.json();
console.log('quests sample:', JSON.stringify(q.data?.quests?.slice(0, 3), null, 2));
console.log('quests count:', q.data?.quests?.length);
console.log('errors:', q.errors);

// Check task for story-related fields in raw data via tarkovDataId patterns
const res2 = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name lightkeeperRequired kappaRequired restartable factionName trader { normalizedName } } }`,
  }),
});
const tasks = (await res2.json()).data.tasks;

// Try to find story chapter quests - search for "Tour", "Falling Skies" etc
const storyKeywords = ['Tour', 'Falling Skies', 'Ticket', 'Batya', 'Accidental', 'Blue Fire', 'Labyrinth', 'Unheard', 'Already Here'];
for (const kw of storyKeywords) {
  const matches = tasks.filter((t) => t.name.toLowerCase().includes(kw.toLowerCase()));
  if (matches.length) console.log(kw, matches.map((t) => t.name));
}

// Compare lightkeeper vs non-lightkeeper
console.log('LK traders:', [...new Set(tasks.filter(t=>t.lightkeeperRequired).map(t=>t.trader.normalizedName))]);
