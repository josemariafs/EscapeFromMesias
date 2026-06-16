const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) {
      id name normalizedName
      taskRequirements { task { id } }
      map { normalizedName }
      tarkovDataId
    } }`,
  }),
});
const tasks = (await res.json()).data.tasks;
const byId = new Map(tasks.map((t) => [t.id, t]));

function bfsFrom(rootIds) {
  const ids = new Set();
  const queue = [...rootIds];
  while (queue.length) {
    const id = queue.shift();
    if (ids.has(id)) continue;
    ids.add(id);
    for (const t of tasks) {
      if (ids.has(t.id)) continue;
      const reqs = t.taskRequirements;
      if (reqs.length > 0 && reqs.every((r) => ids.has(r.task.id))) {
        queue.push(t.id);
      }
    }
  }
  return ids;
}

const gzStarters = tasks.filter(
  (t) => t.map?.normalizedName === 'ground-zero' && t.taskRequirements.length === 0,
);
console.log('GZ starters:', gzStarters.map((t) => t.name));

const storyIds = bfsFrom(gzStarters.map((t) => t.id));
console.log('From GZ starters only:', storyIds.size);
console.log('Side:', tasks.length - storyIds.size);

const side = tasks.filter((t) => !storyIds.has(t.id));
console.log('Side sample:', side.slice(0, 20).map((t) => t.name));

const story = tasks.filter((t) => storyIds.has(t.id));
console.log('Story sample last 20:', story.slice(-20).map((t) => t.name));

// Check Luxurious Life - has req Shooting Cans
const ll = tasks.find((t) => t.name === 'Luxurious Life');
console.log('Luxurious Life in story?', storyIds.has(ll?.id));

// Tasks with tarkovDataId null not in story
const nullNotStory = tasks.filter((t) => t.tarkovDataId == null && !storyIds.has(t.id));
console.log('null id not in GZ BFS:', nullNotStory.length, nullNotStory.slice(0,15).map(t=>t.name));
