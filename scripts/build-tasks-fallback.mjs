/**
 * Genera un snapshot offline de misiones a partir de los datos públicos de SPT,
 * para que EscapeFromGorditos funcione cuando api.tarkov.dev está caído.
 *
 * Uso: node scripts/build-tasks-fallback.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SPT_BASE =
  'https://raw.githubusercontent.com/sp-tarkov/server/master/project/assets/database';

const TRADER_META = {
  '54cb50c76803fa8b248b4571': { name: 'Prapor', normalizedName: 'prapor' },
  '54cb57776803fa99248b456e': { name: 'Therapist', normalizedName: 'therapist' },
  '579dc571d53a0658a154fbec': { name: 'Fence', normalizedName: 'fence' },
  '58330581ace78e27b8b10cee': { name: 'Skier', normalizedName: 'skier' },
  '5935c25fb3acc3127c3d8cd9': { name: 'Peacekeeper', normalizedName: 'peacekeeper' },
  '5a7c2eca46aef81a7ca2145d': { name: 'Mechanic', normalizedName: 'mechanic' },
  '5ac3b934156ae10c4430e83c': { name: 'Ragman', normalizedName: 'ragman' },
  '5c0647fdd443bc2504c2d371': { name: 'Jaeger', normalizedName: 'jaeger' },
  '638f541a29ffd1183d187f57': { name: 'Lightkeeper', normalizedName: 'lightkeeper' },
  '656f0f98d80a697f855d34b1': { name: 'BTR Driver', normalizedName: 'btr-driver' },
  '6617beeaa9cfa777ca915b7c': { name: 'Ref', normalizedName: 'ref' },
  '68fe15910f29ba3fdbba9d54': { name: 'Taran', normalizedName: 'taran' },
  '68fe15990f29ba3fdbba9d55': { name: 'Radio Station', normalizedName: 'radio-station' },
  '688246518448b05efd61d461': { name: 'Mr. Kerman', normalizedName: 'mr-kerman' },
  '688246958448b05efd61d462': { name: 'Voevoda', normalizedName: 'voevoda' },
  '69e0d6cc77b63940375b9173': { name: 'Survivor', normalizedName: 'survivor' },
};

const LOCATION_MAP = {
  any: null,
  factory4_day: { normalizedName: 'factory', name: 'Factory' },
  factory4_night: { normalizedName: 'factory', name: 'Factory' },
  bigmap: { normalizedName: 'customs', name: 'Customs' },
  woods: { normalizedName: 'woods', name: 'Woods' },
  shoreline: { normalizedName: 'shoreline', name: 'Shoreline' },
  interchange: { normalizedName: 'interchange', name: 'Interchange' },
  rezervbase: { normalizedName: 'reserve', name: 'Reserve' },
  laboratory: { normalizedName: 'the-lab', name: 'The Lab' },
  lighthouse: { normalizedName: 'lighthouse', name: 'Lighthouse' },
  tarkovstreets: { normalizedName: 'streets-of-tarkov', name: 'Streets of Tarkov' },
  sandbox: { normalizedName: 'ground-zero', name: 'Ground Zero' },
  sandbox_high: { normalizedName: 'ground-zero', name: 'Ground Zero' },
  labirint: { normalizedName: 'the-labyrinth', name: 'The Labyrinth' },
  terminal: { normalizedName: 'terminal', name: 'Terminal' },
};

const QUEST_STATUS = {
  2: 'started',
  3: 'failed',
  4: 'complete',
  5: 'complete',
};

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function t(locale, key, fallback = '') {
  if (!key) return fallback;
  const value = locale[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'quest';
}

function traderOf(traderId, locale) {
  const meta = TRADER_META[traderId];
  const localized = t(locale, `${traderId} Nickname`, meta?.name ?? 'Unknown');
  return {
    id: traderId,
    name: localized,
    normalizedName: meta?.normalizedName ?? slugify(localized),
  };
}

function itemRef(itemId, locale) {
  const name = t(locale, `${itemId} Name`, itemId);
  const shortName = t(locale, `${itemId} ShortName`, name);
  return {
    id: itemId,
    name,
    shortName,
    iconLink: null,
  };
}

function mapQuestStatuses(statusCodes) {
  const mapped = [...new Set((statusCodes ?? [4]).map((code) => QUEST_STATUS[code] ?? 'complete'))];
  return mapped.length ? mapped : ['complete'];
}

function buildObjectives(quest, locale) {
  const objectives = [];
  for (const cond of quest.conditions?.AvailableForFinish ?? []) {
    const id = cond.id;
    const description = t(locale, id, cond.conditionType ?? 'Objective');
    const optional = cond.isNecessary === false;
    const maps = [];
    let type = 'visit';
    const objective = {
      id,
      type,
      description,
      optional,
      maps,
    };

    switch (cond.conditionType) {
      case 'HandoverItem':
      case 'FindItem': {
        type = cond.conditionType === 'HandoverItem' ? 'giveItem' : 'findItem';
        const targets = Array.isArray(cond.target) ? cond.target : [cond.target];
        const refs = targets.filter(Boolean).map((tid) => itemRef(tid, locale));
        objective.type = type;
        objective.count = Number(cond.value) || 1;
        objective.foundInRaid = Boolean(cond.onlyFoundInRaid);
        if (refs.length === 1) objective.item = refs[0];
        if (refs.length > 1) objective.items = refs;
        break;
      }
      case 'LeaveItemAtLocation':
      case 'PlaceBeacon': {
        objective.type = cond.conditionType === 'PlaceBeacon' ? 'mark' : 'plantItem';
        const targets = Array.isArray(cond.target) ? cond.target : [cond.target];
        if (targets[0]) objective.item = itemRef(targets[0], locale);
        objective.count = Number(cond.value) || 1;
        const loc = LOCATION_MAP[cond.zoneId] ?? LOCATION_MAP[quest.location];
        if (loc) objective.maps = [loc];
        break;
      }
      case 'CounterCreator': {
        objective.type = 'shoot';
        objective.count = Number(cond.value) || 1;
        const kill = cond.counter?.conditions?.find((c) => c.conditionType === 'Kills');
        if (kill?.target) {
          objective.targetNames = Array.isArray(kill.target) ? kill.target : [kill.target];
        }
        break;
      }
      case 'WeaponAssembly':
        objective.type = 'buildWeapon';
        if (cond.target) objective.item = itemRef(cond.target, locale);
        break;
      default:
        objective.type = (cond.conditionType ?? 'visit').toLowerCase();
        break;
    }

    objectives.push(objective);
  }
  return objectives;
}

function transformQuest(quest, locale, questNameById) {
  const name = t(locale, quest.name, quest.QuestName || quest._id);
  const trader = traderOf(quest.traderId, locale);
  const map = LOCATION_MAP[quest.location] ?? null;

  let minPlayerLevel = null;
  const taskRequirements = [];
  const traderRequirements = [];

  for (const cond of quest.conditions?.AvailableForStart ?? []) {
    if (cond.conditionType === 'Level') {
      minPlayerLevel = Number(cond.value) || null;
    } else if (cond.conditionType === 'Quest') {
      const prereqId = cond.target;
      taskRequirements.push({
        status: mapQuestStatuses(cond.status),
        task: {
          id: prereqId,
          name: questNameById.get(prereqId) ?? prereqId,
        },
      });
    } else if (cond.conditionType === 'TraderLoyalty') {
      traderRequirements.push({
        requirementType: 'level',
        compareMethod: cond.compareMethod ?? '>=',
        value: Number(cond.value) || 1,
        trader: traderOf(cond.target, locale),
      });
    } else if (cond.conditionType === 'TraderStanding') {
      traderRequirements.push({
        requirementType: 'reputation',
        compareMethod: cond.compareMethod ?? '>=',
        value: Number(cond.value) || 0,
        trader: traderOf(cond.target, locale),
      });
    }
  }

  const xpReward = (quest.rewards?.Success ?? []).find((r) => r.type === 'Experience');
  const standingRewards = (quest.rewards?.Success ?? [])
    .filter((r) => r.type === 'TraderStanding')
    .map((r) => ({
      standing: Number(r.value) || 0,
      trader: { name: traderOf(r.target, locale).name },
    }));

  return {
    id: quest._id,
    name,
    normalizedName: slugify(quest.QuestName || name),
    minPlayerLevel,
    wikiLink: null,
    experience: Number(xpReward?.value) || 0,
    kappaRequired: null,
    factionName: quest.side === 'Bear' || quest.side === 'Usec' ? quest.side : 'Any',
    trader,
    map,
    taskRequirements,
    traderRequirements,
    objectives: buildObjectives(quest, locale),
    finishRewards: {
      traderStanding: standingRewards,
      items: [],
    },
  };
}

function buildForLang(quests, locale) {
  const questNameById = new Map();
  for (const quest of Object.values(quests)) {
    questNameById.set(quest._id, t(locale, quest.name, quest.QuestName || quest._id));
  }

  return Object.values(quests)
    .filter((q) => q?._id && q?.traderId)
    .map((q) => transformQuest(q, locale, questNameById))
    .sort((a, b) => a.name.localeCompare(b.name));
}

console.log('Descargando datos SPT…');
const [quests, localeEn, localeEs] = await Promise.all([
  fetchJson(`${SPT_BASE}/templates/quests.json`),
  fetchJson(`${SPT_BASE}/locales/global/en.json`),
  fetchJson(`${SPT_BASE}/locales/global/es.json`),
]);

console.log('Quests SPT:', Object.keys(quests).length);

const en = buildForLang(quests, localeEn);
const es = buildForLang(quests, localeEs);
console.log('Transformadas EN/ES:', en.length, es.length);

const outDir = path.resolve('web/src/data');
fs.mkdirSync(outDir, { recursive: true });

const meta = {
  source: 'sp-tarkov/server templates/quests.json',
  fetchedAt: new Date().toISOString(),
  note: 'Fallback offline cuando api.tarkov.dev no responde. Puede no reflejar todos los cambios de EFT 1.1.',
};

for (const [lang, tasks] of [
  ['en', en],
  ['es', es],
]) {
  const outPath = path.join(outDir, `tasks-fallback-${lang}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ ...meta, lang, tasks }));
  const mb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${outPath} (${mb} MB, ${tasks.length} tasks)`);
}

// Limpia el bundle monolítico antiguo si existe.
const legacy = path.join(outDir, 'tasks-fallback.json');
if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
