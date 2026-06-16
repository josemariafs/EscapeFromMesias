const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{
      pve: tasks(gameMode: pve, lang: en) { id name }
      regular: tasks(gameMode: regular, lang: en) { id name }
    }`,
  }),
});
const data = (await res.json()).data;
console.log('pve', data.pve.length, 'regular', data.regular.length);
const pveIds = new Set(data.pve.map((t) => t.id));
const regIds = new Set(data.regular.map((t) => t.id));
const onlyPve = data.pve.filter((t) => !regIds.has(t.id));
const onlyReg = data.regular.filter((t) => !pveIds.has(t.id));
console.log('only pve', onlyPve.length, onlyPve.slice(0, 15).map((t) => t.name));
console.log('only regular', onlyReg.length, onlyReg.slice(0, 15).map((t) => t.name));
