const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ __schema { queryType { fields { name } } } }`,
  }),
});
console.log((await res.json()).data.__schema.queryType.fields.map(f => f.name).filter(n => /task|quest|story/i.test(n)));
