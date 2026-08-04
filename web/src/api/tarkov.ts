import { MIN_VALID_TASK_COUNT, toApiGameMode, type GameMode, type Task } from '../types';

const API_URL = 'https://api.tarkov.dev/graphql';

const TASKS_QUERY = `
  query Tasks($lang: LanguageCode, $gameMode: GameMode) {
    tasks(lang: $lang, gameMode: $gameMode) {
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

function formatGraphqlErrors(errors: unknown): string | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const parts = errors.map((err) => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message);
    }
    return String(err);
  });
  return parts.filter(Boolean).join(', ') || null;
}

export async function fetchTasks(
  lang: 'es' | 'en' = 'es',
  gameMode: GameMode = 'regular',
): Promise<Task[]> {
  const apiMode = toApiGameMode(gameMode);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: TASKS_QUERY,
        variables: { lang, gameMode: apiMode },
      }),
    });
  } catch {
    throw new Error(
      lang === 'en'
        ? 'Could not reach tarkov.dev (network error). The API may be down — try again in a moment.'
        : 'No se pudo contactar con tarkov.dev (error de red). La API puede estar caída; reinténtalo en un momento.',
    );
  }

  let json: {
    data?: { tasks: Task[] };
    errors?: unknown;
  };
  try {
    json = (await response.json()) as typeof json;
  } catch {
    throw new Error(
      lang === 'en'
        ? `tarkov.dev returned an invalid response (HTTP ${response.status}).`
        : `tarkov.dev devolvió una respuesta inválida (HTTP ${response.status}).`,
    );
  }

  const graphqlError = formatGraphqlErrors(json.errors);
  if (graphqlError) {
    throw new Error(graphqlError);
  }

  if (!response.ok) {
    throw new Error(
      lang === 'en'
        ? `tarkov.dev API error (HTTP ${response.status}).`
        : `Error de la API de tarkov.dev (HTTP ${response.status}).`,
    );
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
