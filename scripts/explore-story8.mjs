const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{
      __type(name: "Query") {
        fields {
          name
          args { name type { name kind ofType { name } } }
        }
      }
    }`,
  }),
});
const tasksField = (await res.json()).data.__type.fields.find((f) => f.name === 'tasks');
console.log('tasks args:', JSON.stringify(tasksField?.args, null, 2));
