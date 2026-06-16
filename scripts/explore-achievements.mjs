const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ achievements { id name description hidden side normalizedSide rarity } }`,
  }),
});
const ach = (await res.json()).data.achievements;
console.log('count', ach.length);
console.log(JSON.stringify(ach.slice(0, 10), null, 2));
const sides = [...new Set(ach.map(a => a.side))];
console.log('sides', sides);
