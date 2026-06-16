const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{
      tasks(lang: es) {
        id
        name
        normalizedName
        minPlayerLevel
        wikiLink
        experience
        kappaRequired
        factionName
        trader { id name normalizedName }
        map { normalizedName name }
        taskRequirements {
          status
          task { id name }
        }
        traderRequirements {
          compareMethod
          value
          requirementType
          trader { id name }
        }
        objectives {
          id
          type
          description
          optional
          maps { normalizedName name }
          ... on TaskObjectiveItem {
            item { id name shortName iconLink }
            items { id name shortName iconLink }
            count
            foundInRaid
            requiredKeys { id name shortName iconLink }
          }
          ... on TaskObjectiveBasic {
            zones { id map { normalizedName name } }
            requiredKeys { id name shortName iconLink }
          }
          ... on TaskObjectiveShoot {
            targetNames
            count
            bodyParts
          }
          ... on TaskObjectiveUseItem {
            useAny { id name shortName iconLink }
            compareMethod
            count
          }
          ... on TaskObjectiveMark {
            markerItem { id name shortName iconLink }
          }
          ... on TaskObjectiveExtract {
            exitName
            exitStatus
          }
          ... on TaskObjectiveBuildItem {
            item { id name shortName iconLink }
          }
          ... on TaskObjectiveQuestItem {
            questItem { id name shortName iconLink }
            count
          }
        }
        finishRewards {
          traderStanding { trader { name } standing }
          items { item { name shortName iconLink } count }
        }
      }
    }`,
  }),
});
const data = await res.json();
if (data.errors) {
  console.error(JSON.stringify(data.errors, null, 2));
  process.exit(1);
}
console.log('task count:', data.data.tasks.length);
const withReqs = data.data.tasks.filter((t) => t.taskRequirements.length > 0);
console.log('with requirements:', withReqs.length);
console.log('sample:', JSON.stringify(withReqs[0], null, 2));
