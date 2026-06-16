const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name normalizedName tarkovDataId taskRequirements { task { name } } } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

const storyKeywords = [
  'fallen plane', 'falling skies', 'viewer', 'possessor', 'belka', 'strelka',
  'provide viewership', 'seizing the initiative', 'all is revealed', 'the door',
  'debtor', 'survivor', 'savior', 'fallen', 'invisible hand', 'cease fire',
  'note from mr', 'kerman', 'flight recorder', 'armored case', 'chairman',
  'elektronik', 'g-wagon', 'transcript', 'fisher', 'pathfinder',
  'talk to', 'ask prapor', 'ask therapist', 'ask skier', 'ask mechanic', 'ask jaeger',
  'witness', 'blue fire', 'labyrinth', 'unheard', 'already here', 'ticket',
  'batya', 'bogatyr', 'against the conscience', 'between two fires',
];

for (const kw of storyKeywords) {
  const m = tasks.filter((t) => t.name.toLowerCase().includes(kw));
  if (m.length) console.log(kw, m.map((t) => t.name));
}

// Tasks with "Ask " prefix
console.log('\nAsk prefix:', tasks.filter((t) => t.name.startsWith('Ask ')).map((t) => t.name));

// Tasks with story-ish names
console.log('\nViewer chain:', tasks.filter((t) => /viewer|viewership|possessor|belka|strelka/i.test(t.name)).map((t) => t.name));
