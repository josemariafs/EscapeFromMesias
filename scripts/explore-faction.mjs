const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) {
      id name normalizedName factionName tarkovDataId restartable
      map { normalizedName }
      taskRequirements { task { id name } }
    } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

const factions = [...new Set(tasks.map((t) => t.factionName).filter(Boolean))];
console.log('factionName values:', factions);

for (const name of ['Shooting Cans', 'First in Line', 'Debut', 'The Choice', 'Talk to Therapist', 'Falling Skies', 'Tour']) {
  const t = tasks.find((x) => x.name === name || x.name.includes(name));
  if (t) console.log(t.name, { factionName: t.factionName, tarkovDataId: t.tarkovDataId, restartable: t.restartable });
}

// Group by factionName
for (const f of factions) {
  const group = tasks.filter((t) => t.factionName === f);
  console.log(`\n${f}: ${group.length}`, group.slice(0, 8).map((t) => t.name).join(', '));
}

// Tasks with null tarkovDataId - faction breakdown
const nullId = tasks.filter((t) => t.tarkovDataId == null);
const nullFactions = [...new Set(nullId.map((t) => t.factionName ?? 'null'))];
console.log('\nnull tarkovDataId:', nullId.length, 'factions:', nullFactions);
for (const f of nullFactions) {
  const g = nullId.filter((t) => (t.factionName ?? 'null') === f);
  console.log(`  ${f}: ${g.length}`, g.slice(0, 5).map((t) => t.name));
}
