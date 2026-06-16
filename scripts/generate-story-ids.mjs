/**
 * Genera web/src/data/story-quest-ids.json
 *
 * En EFT 1.0 la campaña Story (Tour, Falling Skies, The Ticket, etc.) es un
 * sistema de capítulos aparte. La API de tarkov.dev solo expone misiones de
 * comerciantes (~510), que en el juego son Side Quest.
 *
 * Si tarkov.dev añade un campo story/chapter, actualizar isStory() aquí.
 */
import fs from 'fs';

const res = await fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ tasks(lang: en) { id name normalizedName tarkovDataId } }`,
  }),
});
const tasks = (await res.json()).data.tasks;

function isStory(_task) {
  return false;
}

const story = tasks.filter(isStory);
const side = tasks.filter((t) => !isStory(t));

console.log('Story:', story.length, 'Side:', side.length);
console.log('Side has Shooting Cans?', side.some((t) => t.name === 'Shooting Cans'));
console.log('Side has First in Line?', side.some((t) => t.name === 'First in Line'));
console.log('Side has Debut?', side.some((t) => t.name === 'Debut'));

const storyIds = story.map((t) => t.id);
fs.writeFileSync('web/src/data/story-quest-ids.json', JSON.stringify(storyIds, null, 2));
console.log('Wrote', storyIds.length, 'ids');
