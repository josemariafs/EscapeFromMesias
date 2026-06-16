const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ achievements { id name description hidden } }`,
  }),
});
const achievements = (await res.json()).data.achievements;
console.log('count', achievements.length);

const storyAch = achievements.filter((a) =>
  /story|pathfinder|fallen|debtor|survivor|savior|just business|man of his word|chapter|ending/i.test(
    `${a.name} ${a.description ?? ''}`,
  ),
);
console.log('\nStory achievements:', storyAch.map((a) => a.name));

// All achievement names for manual review
console.log('\nAll achievements sample:', achievements.slice(0, 40).map((a) => a.name));
