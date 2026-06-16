const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name wikiLink tarkovDataId } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

const storyWiki = tasks.filter((t) => t.wikiLink && /story|chapter|narrative/i.test(t.wikiLink));
console.log('story wiki links:', storyWiki.length, storyWiki.map((t) => ({ name: t.name, wiki: t.wikiLink })));

// Check wiki categories in links
const wikiPatterns = new Map();
for (const t of tasks) {
  if (!t.wikiLink) continue;
  const path = t.wikiLink.replace('https://escapefromtarkov.fandom.com/wiki/', '');
  const prefix = path.split('_')[0];
  wikiPatterns.set(prefix, (wikiPatterns.get(prefix) ?? 0) + 1);
}

// Search for tasks with unique wiki paths suggesting story
for (const t of tasks) {
  if (t.wikiLink && /Story|Chapter|Ending|Tour|Falling|Ticket|Batya|Witness|Blue_Fire|Labyrinth|Unheard|Already_Here/i.test(t.wikiLink)) {
    console.log('wiki match:', t.name, t.wikiLink);
  }
}

console.log('\nNull id tasks without wiki:', tasks.filter((t) => t.tarkovDataId == null && !t.wikiLink).length);
