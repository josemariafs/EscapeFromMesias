const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) {
      id name normalizedName
      descriptionMessageId startMessageId successMessageId failMessageId
      tarkovDataId
    } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

for (const name of ['Shooting Cans', 'First in Line', 'Debut', 'Viewer', 'Possessor', 'Debtor', 'The Invisible Hand', 'Green Corridor']) {
  const t = tasks.find((x) => x.name === name);
  if (t) console.log(name, t);
}

// Group by message id prefix patterns
const storyLike = tasks.filter((t) =>
  [t.descriptionMessageId, t.startMessageId, t.successMessageId, t.failMessageId]
    .some((m) => m && /story|chapter|narrative|main/i.test(m)),
);
console.log('\nstory-like message ids:', storyLike.length, storyLike.slice(0, 10).map((t) => t.name));

// Check if null tarkovDataId tasks share message id pattern vs side
const nullId = tasks.filter((t) => t.tarkovDataId == null);
const withId = tasks.filter((t) => t.tarkovDataId != null);
console.log('\nnull id message sample:', nullId.slice(0, 3).map((t) => ({ name: t.name, start: t.startMessageId })));
console.log('with id message sample:', withId.slice(0, 3).map((t) => ({ name: t.name, start: t.startMessageId })));

// Unique prefixes in startMessageId for null vs non-null
function prefix(m) {
  if (!m) return 'null';
  const parts = m.split(' ');
  return parts.slice(0, 2).join(' ');
}
const nullPrefixes = new Map();
for (const t of nullId) {
  const p = prefix(t.startMessageId);
  nullPrefixes.set(p, (nullPrefixes.get(p) ?? 0) + 1);
}
console.log('\nTop null-id startMessage prefixes:', [...nullPrefixes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
