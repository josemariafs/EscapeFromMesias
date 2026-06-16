const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ __type(name: "Trader") { fields { name } } }`,
  }),
});
console.log((await res.json()).data.__type.fields.map((f) => f.name).join('\n'));

const res2 = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ traders { id name normalizedName imageLink image4xLink } }`,
  }),
});
console.log(JSON.stringify((await res2.json()).data?.traders?.slice(0, 3), null, 2));
