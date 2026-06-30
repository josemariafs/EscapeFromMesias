const q = `query {
  tasks(lang: en) {
    id name normalizedName
    minPlayerLevel
    map { normalizedName name }
    trader { id name normalizedName }
    taskRequirements { status task { id name normalizedName } }
    objectives { description maps { normalizedName } }
  }
}`;

const r = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: q }),
});
const tasks = (await r.json()).data.tasks;

function isBoreasRelated(t) {
  const text = `${t.name} ${t.objectives.map((o) => o.description).join(' ')}`;
  return (
    t.map?.normalizedName === 'icebreaker'
    || t.objectives.some((o) => o.maps.some((m) => m.normalizedName === 'icebreaker'))
    || /boreas|icebreaker/i.test(text)
  );
}

const boreas = tasks.filter(isBoreasRelated);
console.log('count', boreas.length);
for (const t of boreas.sort((a, b) => a.name.localeCompare(b.name))) {
  const reqs = t.taskRequirements.map((r) => r.task.name).join(' | ') || '(none)';
  console.log(`\n${t.name}`);
  console.log('  id:', t.id);
  console.log('  trader:', t.trader.name);
  console.log('  map:', t.map?.normalizedName ?? '—');
  console.log('  reqs:', reqs);
}
