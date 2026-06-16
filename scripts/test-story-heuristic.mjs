const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) {
      id name normalizedName tarkovDataId kappaRequired
      taskRequirements { task { id name } }
      trader { normalizedName }
      map { normalizedName }
    } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

// Known side quest roots on Ground Zero (trader starter quests, NOT story)
const GZ_SIDE_ROOTS = new Set([
  'first-in-line',
  'shooting-cans',
  'burning-rubber',
  'saving-the-mole',
]);

// Side quest name patterns (existing + extensions)
const SIDE_NAME_PATTERNS = [
  /\[pvp zone\]/i,
  /\[pve zone\]/i,
  /^drip-out/i,
  /^is this a reference\?/i,
  /^to great heights!/i,
  /^between two fires/i,
  /^against the conscience/i,
  /^decisions, decisions/i,
  /^surprise \[/i,
  /^easy money/i,
  /^balancing -/i,
  /^create a distraction/i,
  /^the tarkov shooter/i,
  /^gunsmith -/i,
  /^sew it good/i,
  /^spa tour/i,
  /^the survivalist path/i,
  /^the huntsman path/i,
  /^the punisher/i,
  /^test drive/i,
  /^the good times/i,
  /^hell on earth/i,
  /^debut$/i,
  /^checking$/i,
  /^shootout picnic/i,
  /^delivery from the past/i,
  /^luxurious life$/i,
  /^background check$/i,
  /^shortage$/i,
  /^introduction$/i,
  /^acquaintance$/i,
  /^only business$/i,
  /^fishing gear$/i,
  /^make ultra great again$/i,
];

const FORCE_STORY = new Set([
  'the-choice',
  'the-invisible-hand',
]);

function isSideByHeuristic(task) {
  if (FORCE_STORY.has(task.normalizedName)) return false;
  if (GZ_SIDE_ROOTS.has(task.normalizedName)) return true;
  if (task.tarkovDataId != null) return true;
  if (SIDE_NAME_PATTERNS.some((r) => r.test(task.name))) return true;
  return false;
}

function bfsFrom(rootIds, allTasks) {
  const ids = new Set();
  const queue = [...rootIds];
  while (queue.length) {
    const id = queue.shift();
    if (ids.has(id)) continue;
    ids.add(id);
    for (const t of allTasks) {
      if (ids.has(t.id)) continue;
      if (t.taskRequirements.length > 0 && t.taskRequirements.every((r) => ids.has(r.task.id))) {
        queue.push(t.id);
      }
    }
  }
  return ids;
}

// Story seeds: null tarkovDataId tasks that aren't side by heuristic
const storySeeds = tasks.filter((t) => !isSideByHeuristic(t) && t.tarkovDataId == null);
console.log('Story seeds:', storySeeds.length);
console.log(storySeeds.map((t) => t.name).slice(0, 30));

const storyIds = bfsFrom(storySeeds.map((t) => t.id), tasks);
// Also add force story
for (const t of tasks) {
  if (FORCE_STORY.has(t.normalizedName)) storyIds.add(t.id);
}

const story = tasks.filter((t) => storyIds.has(t.id));
const side = tasks.filter((t) => !storyIds.has(t.id));

console.log('\nStory:', story.length, 'Side:', side.length);
console.log('Shooting Cans story?', storyIds.has(tasks.find((t) => t.name === 'Shooting Cans')?.id));
console.log('First in Line story?', storyIds.has(tasks.find((t) => t.name === 'First in Line')?.id));
console.log('Debut story?', storyIds.has(tasks.find((t) => t.name === 'Debut')?.id));
console.log('Viewer story?', storyIds.has(tasks.find((t) => t.name === 'Viewer')?.id));
console.log('Possessor story?', storyIds.has(tasks.find((t) => t.name === 'Possessor')?.id));
console.log('Luxurious Life story?', storyIds.has(tasks.find((t) => t.name === 'Luxurious Life')?.id));
console.log('The Invisible Hand story?', storyIds.has(tasks.find((t) => t.name === 'The Invisible Hand')?.id));
console.log('The Choice story?', storyIds.has(tasks.find((t) => t.name === 'The Choice')?.id));

console.log('\nStory sample:', story.slice(0, 25).map((t) => t.name));
console.log('\nSide wrongly in story? (kappa null id side roots)');
for (const n of ['Shooting Cans', 'First in Line', 'Burning Rubber', 'Saving the Mole', 'Luxurious Life']) {
  console.log(n, storyIds.has(tasks.find((t) => t.name === n)?.id) ? 'STORY (bad)' : 'side (good)');
}

// Check if any classic side ended up in story
const classicSide = ['Debut', 'Gunsmith - Part 1', 'Spa Tour - Part 1', 'The Tarkov Shooter - Part 1'];
for (const n of classicSide) {
  console.log(n, storyIds.has(tasks.find((t) => t.name === n)?.id) ? 'STORY (bad)' : 'side (good)');
}

// Story tasks that might be wrong (have tarkovDataId)
const storyWithId = story.filter((t) => t.tarkovDataId != null);
console.log('\nStory with tarkovDataId:', storyWithId.length, storyWithId.map((t) => t.name));

// Side null-id that might be story
const sideNull = side.filter((t) => t.tarkovDataId == null);
console.log('\nSide null-id count:', sideNull.length);
console.log('Side null sample:', sideNull.slice(0, 30).map((t) => t.name));
