const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name tarkovDataId } }`,
  }),
});
const tasks = (await res.json()).data.tasks;
const keywords = ['Choice', 'Ending', 'Ticket', 'Falling', 'Batya', 'Witness', 'Blue Fire', 'Unheard', 'Already Here', 'Tour'];
for (const kw of keywords) {
  const m = tasks.filter((t) => t.name.toLowerCase().includes(kw.toLowerCase()));
  if (m.length) console.log(kw, m.map((t) => `${t.name} (${t.tarkovDataId ?? 'null'})`).join(' | '));
}
