const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name normalizedName tarkovDataId trader { name } } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

// Per EFT 1.0: trader tasks = side quests. Story is separate chapter system.
// Check if ANY tasks look like pure story (not trader side content)
const endings = tasks.filter((t) => ['Debtor', 'Survivor', 'Savior', 'Fallen'].includes(t.name));
console.log('Endings in API:', endings);

// Tasks that might bridge story chapters - search narrative names
const narrative = tasks.filter((t) =>
  /kerman|elektronik|bogatyr|voevoda|unheard|blue fire|labyrinth|eye of the world|cobalt|item 1156|alpha-1|pathfinder|armored case|flight recorder|fallen plane|mr\. kerman/i.test(
    t.name,
  ),
);
console.log('Narrative names:', narrative.map((t) => t.name));

// Compare counts
console.log('Total tasks:', tasks.length);
console.log('With tarkovDataId:', tasks.filter((t) => t.tarkovDataId != null).length);
console.log('Without tarkovDataId:', tasks.filter((t) => t.tarkovDataId == null).length);

// GZ trader starters - confirmed side
const gzSide = ['first-in-line', 'shooting-cans', 'burning-rubber', 'saving-the-mole', 'luxurious-life'];
for (const n of gzSide) {
  const t = tasks.find((x) => x.normalizedName === n);
  console.log(n, t?.name, 'trader:', t?.trader.name);
}
