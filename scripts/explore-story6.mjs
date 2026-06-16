const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name restartable lightkeeperRequired tarkovDataId } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

const nonRestart = tasks.filter((t) => t.restartable === false);
const restart = tasks.filter((t) => t.restartable === true);
const nullRestart = tasks.filter((t) => t.restartable == null);

console.log('restartable false:', nonRestart.length);
console.log('restartable true:', restart.length);
console.log('restartable null:', nullRestart.length);

console.log('\nfalse sample:', nonRestart.slice(0, 25).map((t) => t.name));

// Is restartable false == story?
const storyByRestart = nonRestart;
const sideByRestart = tasks.filter((t) => t.restartable !== false);
console.log('\nSide by restartable!==false:', sideByRestart.length);

// cross check known side
for (const name of ['Debut', 'Checking', 'Delivery From the Past', 'First in Line', 'Shooting Cans']) {
  const t = tasks.find((x) => x.name.toLowerCase() === name.toLowerCase());
  console.log(name, 'restartable:', t?.restartable);
}
