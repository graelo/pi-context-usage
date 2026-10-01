import type { Snapshot } from "../aggregate.ts";

export const GLYPH = {
  full: "⛁",
  partial: "⛀",
  free: "⛶",
  buffer: "⛝",
} as const;

export interface Cell {
  /** A category id, or a space: `unattributed`, `free`, `buffer`. */
  id: string;
  glyph: string;
}

/** Large windows get a wider grid, so each cell stays a meaningful slice. */
export function gridSize(contextWindow: number): { cols: number; rows: number } {
  return contextWindow >= 1_000_000 ? { cols: 20, rows: 10 } : { cols: 10, rows: 10 };
}

/**
 * One cell per `window / (cols × rows)` tokens: categories in order, then unattributed tokens,
 * free space, and the autocompact buffer at the end. Anything with tokens gets at least one
 * cell, and its last cell shows as partial when it doesn't fill it.
 */
export function buildCells(s: Snapshot): Cell[] {
  const { cols, rows } = gridSize(s.contextWindow);
  const total = cols * rows;
  if (s.contextWindow <= 0) return Array.from({ length: total }, () => ({ id: "free", glyph: GLYPH.free }));
  const cellSize = s.contextWindow / total;

  const used = [...s.categories, { id: "unattributed", tokens: s.unattributed }].map(({ id, tokens }) => ({
    id,
    tokens,
    cells: tokens > 0 ? Math.max(1, Math.round(tokens / cellSize)) : 0,
  }));
  let bufferCells = s.buffer ? Math.max(1, Math.round(s.buffer / cellSize)) : 0;

  // Rounding can overshoot the grid: shrink the largest first, then the buffer.
  const overflow = () => used.reduce((n, u) => n + u.cells, 0) + bufferCells - total;
  while (overflow() > 0) {
    const largest = used.reduce((a, b) => (b.cells > a.cells ? b : a));
    if (largest.cells > 1) largest.cells--;
    else if (bufferCells > 0) bufferCells--;
    else break;
  }

  const cells: Cell[] = [];
  for (const u of used) {
    for (let i = 0; i < u.cells; i++) {
      const partial = i === u.cells - 1 && u.tokens < u.cells * cellSize;
      cells.push({ id: u.id, glyph: partial ? GLYPH.partial : GLYPH.full });
    }
  }
  const freeCells = Math.max(0, total - cells.length - bufferCells);
  for (let i = 0; i < freeCells; i++) cells.push({ id: "free", glyph: GLYPH.free });
  for (let i = 0; i < bufferCells; i++) cells.push({ id: "buffer", glyph: GLYPH.buffer });
  return cells.slice(0, total);
}
