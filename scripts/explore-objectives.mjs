const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) {
      id name normalizedName tarkovDataId
      objectives { type description ... on TaskObjectiveBasic { description } }
    } }`,
  }),
});
const data = await res.json();
if (data.errors) console.log('errors', data.errors);
const tasks = data.data.tasks;

const objectiveText = (t) =>
  t.objectives.map((o) => o.description ?? '').join(' ').toLowerCase();

const storyObjKeywords = [
  'fallen plane', 'crashed plane', 'flight recorder', 'armored case', 'g-wagon',
  'story chapter', 'chapter', 'ending', 'ending choice', 'mr. kerman', 'kerman',
  'transcript', 'elektronik', 'fisher', 'chairman', 'pathfinder', 'tour',
  'falling skies', 'the ticket', 'batya', 'accidental witness', 'blue fire',
  'labyrinth', 'unheard', 'already here', 'arrs', 'cultist',
];

for (const kw of storyObjKeywords) {
  const m = tasks.filter((t) => objectiveText(t).includes(kw) || t.name.toLowerCase().includes(kw));
  if (m.length && m.length < 50) console.log(kw, m.length, m.map((t) => t.name));
}

// Tasks whose objectives mention "story"
const storyMention = tasks.filter((t) => /story|chapter|ending|narrative/i.test(objectiveText(t)));
console.log('\nObjective mentions story:', storyMention.length, storyMention.map((t) => t.name));

// Sample objectives for null-id tasks that might be story
const nullId = tasks.filter((t) => t.tarkovDataId == null);
console.log('\nNull id count:', nullId.length);
for (const t of nullId.slice(0, 15)) {
  console.log(t.name, '->', t.objectives.slice(0, 2).map((o) => o.description));
}
