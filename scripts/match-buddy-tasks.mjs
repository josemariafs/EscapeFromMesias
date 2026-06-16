const resBuddy = await fetch('https://www.tarkovbuddy.org/api/storyline');
const buddy = await resBuddy.json();

const resTasks = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name normalizedName tarkovDataId } }`,
  }),
});
const tasks = (await resTasks.json()).data.tasks;
const taskByName = new Map(tasks.map((t) => [t.name.toLowerCase(), t]));

const buddyNodeNames = [];
for (const tree of Object.values(buddy.trees)) {
  for (const node of tree.nodes) {
    buddyNodeNames.push(node.name);
  }
}

const matches = [];
for (const nodeName of buddyNodeNames) {
  const t = taskByName.get(nodeName.toLowerCase());
  if (t) matches.push({ node: nodeName, task: t.name, id: t.id });
}

console.log('Buddy nodes:', buddyNodeNames.length);
console.log('Exact name matches with API tasks:', matches.length);
console.log(matches);

// Fuzzy: API task name contained in buddy node or vice versa
const fuzzy = [];
for (const t of tasks) {
  const tl = t.name.toLowerCase();
  for (const node of buddyNodeNames) {
    const nl = node.toLowerCase();
    if (tl === nl || nl.includes(tl) || tl.includes(nl)) {
      fuzzy.push({ task: t.name, node });
      break;
    }
  }
}
console.log('\nFuzzy matches:', fuzzy.length);
console.log(fuzzy.slice(0, 40));
