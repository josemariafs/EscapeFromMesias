import type { Task } from '../types';

const API_URL = 'https://api.tarkov.dev/graphql';

const TASKS_QUERY = `
  query Tasks($lang: LanguageCode) {
    tasks(lang: $lang) {
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
        requirementType
        compareMethod
        value
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
  }
`;

export async function fetchTasks(lang: 'es' | 'en' = 'es'): Promise<Task[]> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: TASKS_QUERY,
      variables: { lang },
    }),
  });

  const json = (await response.json()) as {
    data?: { tasks: Task[] };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(', '));
  }

  if (!json.data?.tasks) {
    throw new Error(lang === 'en' ? 'Could not load quests' : 'No se pudieron cargar las misiones');
  }

  return json.data.tasks;
}
