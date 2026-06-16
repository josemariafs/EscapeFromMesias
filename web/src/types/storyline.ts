import type { TaskProgressState } from '../types';

export type StoryNodeType = 'default' | 'optional' | 'choice';

export interface StoryNodeItem {
  name: string;
  count: number;
  fir: boolean;
}

export interface StoryNodeRequirement {
  task: { id: string };
}

export interface StoryNode {
  id: string;
  name: string;
  type: StoryNodeType;
  minPlayerLevel: number;
  taskRequirements: StoryNodeRequirement[];
  items?: StoryNodeItem[];
}

export interface StoryChapter {
  id: number;
  title: string;
  desc: string;
  image: string;
}

export interface StoryTree {
  id: number;
  title: string;
  nodes: StoryNode[];
}

export interface StorylineData {
  chapters: StoryChapter[];
  trees: Record<string, StoryTree>;
}

export interface StoryNodeFlat extends StoryNode {
  chapterId: number;
  chapterTitle: string;
  orderIndex: number;
}

export interface StoryProgress {
  nodeStates: Record<string, TaskProgressState>;
  updatedAt: string;
}

export const STORY_STORAGE_KEY = 'eft-quest-tracker-story-progress';
