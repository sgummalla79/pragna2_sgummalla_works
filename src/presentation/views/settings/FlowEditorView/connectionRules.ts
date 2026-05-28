/**
 * Draw-time connection validity for the flow canvas. Passed to React
 * Flow's `isValidConnection`, so an invalid connection can't even be
 * dropped — the user gets immediate feedback instead of a server-side
 * rejection at Save.
 *
 * Rules mirror the backend graph contract:
 *  - no self-loops (a node can't edge to itself),
 *  - nothing connects INTO `__start__`,
 *  - nothing connects OUT OF `__end__`,
 *  - no duplicate source→target (routing conditions live on one edge;
 *    a second parallel edge is noise the backend would collapse).
 */

import type { Connection, Edge } from 'reactflow';

import { NODE_END, NODE_START } from './editorTypes';

export function isValidFlowConnection(edges: Edge[], conn: Connection): boolean {
  const { source, target } = conn;
  if (!source || !target) return false;
  if (source === target) return false;
  if (target === NODE_START) return false;
  if (source === NODE_END) return false;
  if (edges.some((e) => e.source === source && e.target === target)) return false;
  return true;
}
