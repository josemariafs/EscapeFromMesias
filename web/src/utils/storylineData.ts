import storylineJson from '../data/storyline.json';
import type { StorylineData, StoryNodeFlat } from '../types/storyline';

export const storylineData = storylineJson as StorylineData;

export function flattenStoryNodes(data: StorylineData = storylineData): StoryNodeFlat[] {
  const chapterById = new Map(data.chapters.map((c) => [c.id, c.title]));
  const nodes: StoryNodeFlat[] = [];

  for (const tree of Object.values(data.trees)) {
    const chapterTitle = chapterById.get(tree.id) ?? tree.title;
    tree.nodes.forEach((node, orderIndex) => {
      nodes.push({
        ...node,
        chapterId: tree.id,
        chapterTitle,
        orderIndex,
      });
    });
  }

  return nodes;
}

export function getStoryNodeById(
  id: string,
  nodes: StoryNodeFlat[] = flattenStoryNodes(),
): StoryNodeFlat | undefined {
  return nodes.find((n) => n.id === id);
}

export function getStoryNodeCount(): number {
  return flattenStoryNodes().length;
}
