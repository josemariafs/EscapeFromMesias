const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) {
      id name normalizedName tarkovDataId restartable kappaRequired
      taskRequirements { task { id name } status }
      finishRewards { traderStanding { trader { name } standing } }
    } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

const endings = ['Debtor', 'Survivor', 'Savior', 'Fallen', 'The Choice'];
for (const n of endings) {
  const t = tasks.find((x) => x.name === n);
  console.log(n, t ? { id: t.id, reqs: t.taskRequirements.map((r) => r.task.name) } : 'NOT FOUND');
}

// Search story-ish patterns
const patterns = [
  /^Viewer$/i, /^Possessor$/i, /^Belka/i, /^Half Empty$/i, /^Stick in the Wheel$/i,
  /^Forge a Friendship$/i, /^Special Comms$/i, /^Shipping Delay/i, /^Against the Conscience/i,
  /^Decisions, Decisions/i, /^Between Two Fires/i, /^To Great Heights/i, /^Surprise \[/i,
  /^Easy Money/i, /^Balancing -/i, /^Create a Distraction/i,
  /^Green Corridor$/i, /^Road Closed$/i, /^Our Own Land$/i, /^Counteraction$/i,
];
for (const p of patterns) {
  const m = tasks.filter((t) => p.test(t.name));
  if (m.length) console.log(p, m.map((t) => t.name));
}

// BFS from The Choice backwards? Or from tasks that lead to endings
function bfsFrom(rootIds) {
  const ids = new Set();
  const queue = [...rootIds];
  while (queue.length) {
    const id = queue.shift();
    if (ids.has(id)) continue;
    ids.add(id);
    for (const t of tasks) {
      if (ids.has(t.id)) continue;
      if (t.taskRequirements.length > 0 && t.taskRequirements.every((r) => ids.has(r.task.id))) {
        queue.push(t.id);
      }
    }
  }
  return ids;
}

const choice = tasks.find((t) => t.name === 'The Choice');
if (choice) {
  const storyFromChoice = bfsFrom([choice.id]);
  console.log('\nBFS from The Choice:', storyFromChoice.size);
  const side = tasks.filter((t) => !storyFromChoice.has(t.id));
  console.log('Side count:', side.length);
  console.log('Shooting Cans in story?', storyFromChoice.has(tasks.find((t) => t.name === 'Shooting Cans')?.id));
  console.log('Debut in story?', storyFromChoice.has(tasks.find((t) => t.name === 'Debut')?.id));
  console.log('First in Line in story?', storyFromChoice.has(tasks.find((t) => t.name === 'First in Line')?.id));
  console.log('Luxurious Life in story?', storyFromChoice.has(tasks.find((t) => t.name === 'Luxurious Life')?.id));
  console.log('The Invisible Hand in story?', storyFromChoice.has(tasks.find((t) => t.name === 'The Invisible Hand')?.id));
}

// Reverse BFS - find all tasks that eventually lead to The Choice
function reverseBfs(targetIds) {
  const ids = new Set(targetIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (ids.has(t.id)) continue;
      if (t.taskRequirements.some((r) => ids.has(r.task.id))) {
        ids.add(t.id);
        changed = true;
      }
    }
  }
  return ids;
}

if (choice) {
  const rev = reverseBfs([choice.id]);
  console.log('\nReverse from The Choice:', rev.size);
  console.log('Shooting Cans?', rev.has(tasks.find((t) => t.name === 'Shooting Cans')?.id));
  console.log('Debut?', rev.has(tasks.find((t) => t.name === 'Debut')?.id));
}

// Find story roots - tasks with no reqs that are in reverse BFS from choice
if (choice) {
  const rev = reverseBfs([choice.id]);
  const roots = tasks.filter((t) => rev.has(t.id) && t.taskRequirements.length === 0);
  console.log('\nStory roots (no reqs, lead to choice):', roots.map((t) => t.name));
}
