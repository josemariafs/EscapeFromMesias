import dagre from '@dagrejs/dagre';
import type { StoryNodeFlat } from '../types/storyline';
import type { TaskProgressState } from '../types';

export interface StoryGraphEdge {
  from: string;
  to: string;
}

export interface StoryGraph {
  nodes: StoryNodeFlat[];
  edges: StoryGraphEdge[];
  roots: string[];
}

const NODE_WIDTH = 210;
const NODE_HEIGHT = 72;
const CHAPTER_GAP = 80;

export function buildStoryGraph(nodes: StoryNodeFlat[]): StoryGraph {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: StoryGraphEdge[] = [];

  for (const node of nodes) {
    for (const req of node.taskRequirements) {
      if (nodeIds.has(req.task.id)) {
        edges.push({ from: req.task.id, to: node.id });
      }
    }
  }

  const roots = nodes
    .filter((n) => n.taskRequirements.every((r) => !nodeIds.has(r.task.id)))
    .map((n) => n.id);

  return { nodes, edges, roots };
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  points: { x: number; y: number }[];
}

export interface StoryChapterLayout {
  chapterId: number;
  chapterTitle: string;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

function layoutChapterGraph(
  graph: StoryGraph,
  offsetY: number,
): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    nodesep: 36,
    ranksep: 56,
    marginx: 24,
    marginy: 24,
  });

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of graph.edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const layoutNodes: LayoutNode[] = graph.nodes.map((node) => {
    const pos = g.node(node.id);
    const x = pos.x - NODE_WIDTH / 2;
    const y = pos.y - NODE_HEIGHT / 2 + offsetY;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + NODE_WIDTH);
    maxY = Math.max(maxY, y + NODE_HEIGHT);
    return { id: node.id, x, y, width: NODE_WIDTH, height: NODE_HEIGHT };
  });

  const layoutEdges: LayoutEdge[] = graph.edges.map((edge) => {
    const edgeData = g.edge(edge.from, edge.to);
    const points = (edgeData?.points ?? []).map((p: { x: number; y: number }) => ({
      x: p.x,
      y: p.y + offsetY,
    }));
    return { from: edge.from, to: edge.to, points };
  });

  const width = Math.max(maxX - minX + 48, 320);
  const height = maxY + 48;

  return { nodes: layoutNodes, edges: layoutEdges, width, height };
}

export function layoutStoryChapters(
  nodesByChapter: Map<number, { title: string; nodes: StoryNodeFlat[] }>,
  chapterOrder: number[],
): StoryChapterLayout[] {
  const layouts: StoryChapterLayout[] = [];
  let offsetY = 48;

  for (const chapterId of chapterOrder) {
    const chapter = nodesByChapter.get(chapterId);
    if (!chapter?.nodes.length) continue;

    const graph = buildStoryGraph(chapter.nodes);
    const laid = layoutChapterGraph(graph, offsetY);

    layouts.push({
      chapterId,
      chapterTitle: chapter.title,
      ...laid,
    });

    offsetY = laid.height + CHAPTER_GAP;
  }

  return layouts;
}

export function edgeStroke(
  fromState: TaskProgressState,
): { stroke: string; strokeWidth: number; strokeDasharray?: string; opacity: number } {
  if (fromState === 'completed') {
    return { stroke: 'var(--accent)', strokeWidth: 2, opacity: 0.85 };
  }
  if (fromState === 'started') {
    return { stroke: '#8b95a8', strokeWidth: 1.5, strokeDasharray: '6 4', opacity: 0.7 };
  }
  return { stroke: '#4a5160', strokeWidth: 1.5, strokeDasharray: '4 6', opacity: 0.45 };
}

export function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y}${rest.map((p) => ` L ${p.x} ${p.y}`).join('')}`;
}
