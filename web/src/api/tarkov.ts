import { MIN_VALID_TASK_COUNT, type Task } from '../types';

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
          zones { id map { normalizedName name } position { x y z } }
        }
        ... on TaskObjectiveBasic {
          zones { id map { normalizedName name } position { x y z } }
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
          zones { id map { normalizedName name } position { x y z } }
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
          zones { id map { normalizedName name } position { x y z } }
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

  // La API de tarkov.dev a veces sufre caídas parciales y devuelve una respuesta válida
  // (HTTP 200, sin "errors") pero con un listado de misiones truncado/incompleto. Si eso
  // se guardase en caché tal cual, la app quedaría "atascada" con datos rotos durante horas.
  if (json.data.tasks.length < MIN_VALID_TASK_COUNT) {
    throw new Error(
      lang === 'en'
        ? `tarkov.dev API returned an incomplete quest list (${json.data.tasks.length} quests). The service might be degraded; please retry in a moment.`
        : `La API de tarkov.dev devolvió una lista de misiones incompleta (${json.data.tasks.length} misiones). El servicio podría estar degradado; reinténtalo en un momento.`,
    );
  }

  return json.data.tasks;
}
