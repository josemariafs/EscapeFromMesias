const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name restartable trader { name } } }`,
  }),
});
const tasks = (await res.json()).data.tasks;
console.log('restartable true:', tasks.filter(t => t.restartable === true).map(t => t.name));
