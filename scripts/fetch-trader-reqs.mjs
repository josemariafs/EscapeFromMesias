const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{
      tasks(lang: es) {
        id name
        traderRequirements { requirementType compareMethod value trader { name } }
      }
    }`,
  }),
});
const tasks = (await res.json()).data.tasks;
const withTraderReqs = tasks.filter((t) => t.traderRequirements.length > 0);
console.log('with trader reqs:', withTraderReqs.length);
console.log(JSON.stringify(withTraderReqs.slice(0, 3), null, 2));
