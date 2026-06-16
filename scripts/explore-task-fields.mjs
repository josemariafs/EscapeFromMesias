const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ __type(name: "Task") { fields { name type { name kind ofType { name ofType { name } } } } } }`,
  }),
});
console.log((await res.json()).data.__type.fields.map((f) => f.name).sort().join('\n'));
