const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{
      __schema { queryType { fields { name } } }
    }`,
  }),
});
const fields = (await res.json()).data.__schema.queryType.fields.map((f) => f.name);
console.log(fields.filter((f) => /story|quest|task|chapter/i.test(f)).join('\n'));

const res2 = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ __type(name: "Achievement") { fields { name } } }`,
  }),
});
console.log('Achievement:', (await res2.json()).data.__type?.fields?.map((f) => f.name));

const res3 = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ achievements { id name tasks { id name } } }`,
  }),
});
const ach = await res3.json();
if (ach.errors) console.log('ach errors', ach.errors);
else {
  console.log('achievements count', ach.data.achievements.length);
  const withTasks = ach.data.achievements.filter((a) => a.tasks?.length);
  console.log('with tasks', withTasks.length);
  console.log('sample', JSON.stringify(withTasks.slice(0, 5), null, 2));
}
