import { useMemo } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { StoryNodeFlat } from '../types/storyline';
import type { Translations } from '../i18n/translations';
import {
  edgeStroke,
  layoutStoryChapters,
  pointsToPath,
} from '../utils/storylineGraph';

interface StoryTreeViewProps {
  nodes: StoryNodeFlat[];
  nodeStates: Record<string, TaskProgressState>;
  taskStates?: Record<string, TaskProgressState>;
  apiTaskMeta?: Map<string, Pick<Task, 'trader'>>;
  chapterFilter: number | 'all';
  selectedId: string | null;
  search: string;
  t: Translations;
  onSelect: (id: string) => void;
}

export function StoryTreeView({
  nodes,
  nodeStates,
  taskStates = {},
  apiTaskMeta,
  chapterFilter,
  selectedId,
  search,
  t,
  onSelect,
}: StoryTreeViewProps) {
  const q = search.trim().toLowerCase();

  const resolveState = (id: string): TaskProgressState => {
    if (apiTaskMeta?.has(id)) {
      return taskStates[id] ?? 'locked';
    }
    return nodeStates[id] ?? 'locked';
  };

  const nodesByChapter = useMemo(() => {
    const map = new Map<number, { title: string; nodes: StoryNodeFlat[] }>();

    for (const node of nodes) {
      if (chapterFilter !== 'all' && node.chapterId !== chapterFilter) continue;
      if (q && !node.name.toLowerCase().includes(q) && !node.chapterTitle.toLowerCase().includes(q)) {
        continue;
      }

      if (!map.has(node.chapterId)) {
        map.set(node.chapterId, { title: node.chapterTitle, nodes: [] });
      }
      map.get(node.chapterId)!.nodes.push(node);
    }

    return map;
  }, [nodes, chapterFilter, q]);

  const chapterOrder = useMemo(() => {
    if (chapterFilter !== 'all') return [chapterFilter];
    return [...nodesByChapter.keys()].sort((a, b) => a - b);
  }, [chapterFilter, nodesByChapter]);

  const layouts = useMemo(
    () => layoutStoryChapters(nodesByChapter, chapterOrder),
    [nodesByChapter, chapterOrder],
  );

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  if (layouts.length === 0) {
    return null;
  }

  return (
    <div className="story-tree-view">
      {layouts.map((layout) => (
        <section key={layout.chapterId} className="story-tree-chapter">
          {chapterFilter === 'all' && (
            <header className="story-tree-chapter-header">
              <h3>{layout.chapterTitle}</h3>
            </header>
          )}
          <div className="story-tree-canvas-wrap">
            <svg
              className="story-tree-canvas"
              width={layout.width}
              height={layout.height}
              role="img"
              aria-label={layout.chapterTitle}
            >
              <defs>
                <marker
                  id={`arrow-${layout.chapterId}`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" opacity="0.7" />
                </marker>
              </defs>
              <g className="story-tree-edges">
                {layout.edges.map((edge) => {
                  const fromState = resolveState(edge.from);
                  const style = edgeStroke(fromState);
                  const path = pointsToPath(edge.points);
                  if (!path) return null;
                  const isActive = fromState === 'completed';
                  return (
                    <path
                      key={`${edge.from}-${edge.to}`}
                      d={path}
                      fill="none"
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                      strokeDasharray={style.strokeDasharray}
                      opacity={style.opacity}
                      markerEnd={isActive ? `url(#arrow-${layout.chapterId})` : undefined}
                    />
                  );
                })}
              </g>
              <g className="story-tree-nodes">
                {layout.nodes.map((ln) => {
                  const node = nodeById.get(ln.id);
                  if (!node) return null;
                  const state = resolveState(node.id);
                  const trader = apiTaskMeta?.get(node.id)?.trader.name;
                  const dimmed = q.length > 0
                    && !node.name.toLowerCase().includes(q)
                    && !node.chapterTitle.toLowerCase().includes(q);

                  return (
                    <foreignObject
                      key={node.id}
                      x={ln.x}
                      y={ln.y}
                      width={ln.width}
                      height={ln.height}
                      className={dimmed ? 'story-tree-node-fo dimmed' : 'story-tree-node-fo'}
                    >
                      <button
                        type="button"
                        className={`story-tree-node state-${state}${selectedId === node.id ? ' selected' : ''}`}
                        onClick={() => onSelect(node.id)}
                        title={node.name}
                      >
                        <span className={`state-badge state-${state}`}>{t.state[state]}</span>
                        {node.type !== 'default' && (
                          <span className={`story-type-badge type-${node.type}`}>
                            {t.storyNodeType[node.type]}
                          </span>
                        )}
                        {trader && (
                          <span className="story-tree-node-trader">{trader}</span>
                        )}
                        <span className="story-tree-node-name">{node.name}</span>
                      </button>
                    </foreignObject>
                  );
                })}
              </g>
            </svg>
          </div>
        </section>
      ))}
    </div>
  );
}
