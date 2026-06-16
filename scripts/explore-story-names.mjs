const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name normalizedName taskRequirements { task { id name } } } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

const storyNames = [
  'Tour',
  'Falling Skies',
  'The Ticket',
  'Batya',
  'Accidental Witness',
  'Blue Fire',
  'The Labyrinth',
  'The Unheard',
  'They Are Already Here',
  'The Choice',
  'The Invisible Hand',
];

for (const n of storyNames) {
  const matches = tasks.filter((t) => t.name === n || t.name.startsWith(n + ' -') || t.name.includes(n));
  console.log(n, matches.map((t) => t.name));
}

// Search chapter-related names
const keywords = ['Talk to', 'Escape Ground', 'Pathfinder', 'Witness', 'Ticket', 'Falling', 'Batya', 'Blue Fire', 'Labyrinth', 'Unheard', 'Already Here', 'Ending', 'Debtor', 'Survivor', 'Savior', 'Fallen'];
for (const kw of keywords) {
  const m = tasks.filter((t) => t.name.toLowerCase().includes(kw.toLowerCase()));
  if (m.length && m.length < 30) console.log('KW', kw, m.length, m.map((t) => t.name).slice(0, 10));
}

// Tasks with no requirements and name contains Talk
const talk = tasks.filter((t) => t.name.startsWith('Talk to') || t.name.startsWith('Ensure access'));
console.log('\nTalk/Ensure:', talk.map((t) => t.name));
