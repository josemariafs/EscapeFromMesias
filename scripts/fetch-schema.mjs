const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ __type(name: "Task") { fields { name type { name kind ofType { name kind ofType { name } } } } } }`,
  }),
});
console.log(JSON.stringify(await res.json(), null, 2));
