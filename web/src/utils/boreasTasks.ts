/** IDs de misiones Boreas / Icebreaker en tarkov.dev (capítulo Story 10). */
export const BOREAS_API_TASK_IDS = new Set([
  '69c26c07683c9831020018c7', // Stick to It
  '69c27158e350f01390049e77', // Saving Private Roman
  '69c277f3ea6da9c23e07f8d2', // A Bitter Victory
  '69c2a2d004de49c8f0055a3d', // Hangover
  '69ce1de03e15cd80bd06f6c9', // Oil Change
  '69ce1f84ebbdbf36a200627c', // Peaceful Atom
  '69e5583240c3e6c8ba0edbd5', // Wiring the Vessel
  '69ce204c8702b378f9091e4b', // War Never Changes
  '69ce213a298a6529b30d7134', // Biochemistry
  '69ce21e990144e437802b1e0', // Fresh Stock
  '69ce1cfb298a6529b30d712b', // A Wedge Between Us
]);

export function isBoreasApiTaskId(id: string): boolean {
  return BOREAS_API_TASK_IDS.has(id);
}
