import { useMemo } from 'react';
import type { Task, TaskProgressState } from '../types';
import type { Translations } from '../i18n/translations';
import { layoutApiTaskTree } from '../utils/apiStoryGraph';
import { edgeStroke, pointsToPath } from '../utils/storylineGraph';

interface StoryApiTreeViewProps {
  tasks: Task[];
  taskStates: Record<string, TaskProgressState>;
  selectedId: string | null;
  title?: string;
  t: Translations;
  onSelect: (id: string) => void;
}

export function StoryApiTreeView({
  tasks,
  taskStates,
  selectedId,
  title,
  t,
  onSelect,
}: StoryApiTreeViewProps) {
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const layout = useMemo(() => layoutApiTaskTree(tasks), [tasks]);

  if (!layout || tasks.length === 0) {
    return null;
  }

  return (
    <section className="story-tree-chapter story-api-tree">
      {title && (
        <header className="story-tree-chapter-header">
          <h3>{title}</h3>
        </header>
      )}
      <div className="story-tree-canvas-wrap">
        <svg
          className="story-tree-canvas"
          width={layout.width}
          height={layout.height}
          role="img"
          aria-label={title ?? 'Story quests'}
        >
          <defs>
            <marker
              id="arrow-api-story"
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
              const fromState = taskStates[edge.from] ?? 'locked';
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
                  markerEnd={isActive ? 'url(#arrow-api-story)' : undefined}
                />
              );
            })}
          </g>
          <g className="story-tree-nodes">
            {layout.nodes.map((ln) => {
              const task = taskById.get(ln.id);
              if (!task) return null;
              const state = taskStates[task.id] ?? 'locked';

              return (
                <foreignObject
                  key={task.id}
                  x={ln.x}
                  y={ln.y}
                  width={ln.width}
                  height={ln.height}
                  className="story-tree-node-fo"
                >
                  <button
                    type="button"
                    className={`story-tree-node state-${state}${selectedId === task.id ? ' selected' : ''}`}
                    onClick={() => onSelect(task.id)}
                    title={`${task.name} (${task.trader.name})`}
                  >
                    <span className={`state-badge state-${state}`}>{t.state[state]}</span>
                    <span className="story-tree-node-trader">{task.trader.name}</span>
                    <span className="story-tree-node-name">{task.name}</span>
                  </button>
                </foreignObject>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}
