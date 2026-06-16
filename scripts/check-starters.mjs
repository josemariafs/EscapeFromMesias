const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: es) { id name minPlayerLevel taskRequirements { task { name } } traderRequirements { trader { name } } } }`,
  }),
});
const tasks = (await res.json()).data.tasks;
const starters = tasks.filter((t) => t.taskRequirements.length === 0 && t.traderRequirements.length === 0);
console.log('starter quests:', starters.length);
console.log(starters.slice(0, 10).map((t) => `${t.name} (lvl ${t.minPlayerLevel ?? 1})`).join('\n'));
