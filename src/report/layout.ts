import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Detail, Snapshot } from "../aggregate.ts";
import type { CategoryTable } from "../categories.ts";
import { formatPercent, formatTokens } from "./format.ts";
import { buildCells, GLYPH, gridSize } from "./grid.ts";
import type { Paint } from "./paint.ts";

const MARGIN = "  ";
const GUTTER = "   ";

type Spaces = CategoryTable["spaces"];

/**
 * The full report: title, grid with its legend, then the per-source sections. Category labels
 * come from the snapshot; space labels and colors from the current config.
 */
export function layout(s: Snapshot, paint: Paint, spaces: Spaces, width: number, expanded: boolean): string[] {
  const lines = [
    paint.bold("Context Usage"),
    ...besideOrBelow(gridLines(s, paint), legendLines(s, paint, spaces), width - MARGIN.length),
    ...sectionLines(s, paint, expanded),
  ];
  return lines.map((line) => (line ? truncateToWidth(MARGIN + line, width) : ""));
}

function gridLines(s: Snapshot, paint: Paint): string[] {
  const { cols } = gridSize(s.contextWindow);
  const cells = buildCells(s).map((c) => paint.color(c.id, c.glyph));
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols).join(" "));
  return rows;
}

function legendLines(s: Snapshot, paint: Paint, spaces: Spaces): string[] {
  const window = s.contextWindow;
  const pct = s.total > 0 && window > 0 ? Math.round((s.total / window) * 100) : 0;
  const lines = [
    s.model?.id ?? "No model",
    `${formatTokens(s.total)}/${formatTokens(window)} tokens (${pct}%)${s.estimated ? paint.dim(" · estimated") : ""}`,
    "",
    paint.italic("Estimated usage by category"),
  ];

  const entry = (id: string, glyph: string, label: string, tokens: number, unit = " tokens") =>
    `${paint.color(id, glyph)} ${label}: ${formatTokens(tokens)}${unit} (${formatPercent(tokens, window)})`;

  for (const c of s.categories) if (c.tokens > 0) lines.push(entry(c.id, GLYPH.full, c.label, c.tokens));
  if (s.unattributed > 0) lines.push(entry("unattributed", GLYPH.full, spaces.unattributed.label, s.unattributed));
  lines.push(entry("free", GLYPH.free, spaces.free.label, s.free, ""));
  if (s.buffer !== null) lines.push(entry("buffer", GLYPH.buffer, spaces.buffer.label, s.buffer));
  return lines;
}

/** Legend to the right of the grid when it fits, otherwise below it. */
function besideOrBelow(left: string[], right: string[], width: number): string[] {
  const leftWidth = Math.max(...left.map(visibleWidth));
  const rightWidth = Math.max(...right.map(visibleWidth));
  if (leftWidth + GUTTER.length + rightWidth > width) return [...left, "", ...right];

  const rows = Math.max(left.length, right.length);
  return Array.from({ length: rows }, (_, i) => {
    const l = left[i] ?? "";
    const r = right[i] ?? "";
    return r ? l + " ".repeat(leftWidth - visibleWidth(l)) + GUTTER + r : l;
  });
}

function sectionLines(s: Snapshot, paint: Paint, expanded: boolean): string[] {
  const lines = [
    "",
    `${paint.bold("Auto-compact window:")} ${s.buffer === null ? "disabled" : `${formatTokens(s.contextWindow)} tokens`}`,
  ];

  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  const category = (id: string) => s.categories.find((c) => c.id === id);
  const section = (id: string, noun: string, count_: number, items: Detail[], note = "") => {
    // The category total is what the model sees; when pi didn't attribute a section to it,
    // the items' own counts are the best we have.
    const tokens = category(id)?.tokens || items.reduce((n, d) => n + d.tokens, 0);
    const command = s.commands[id];
    lines.push(
      "",
      `${paint.bold(category(id)?.label ?? id)}${command ? ` · /${command}` : ""}${note}`,
      `└ ${count(count_, noun)} · ${formatTokens(tokens)} tokens`,
    );
    if (expanded) for (const d of items) lines.push(`  ${d.label}: ${formatTokens(d.tokens)} tokens`);
  };

  // Not in Claude Code's collapsed view either: the legend already has the total.
  if (expanded && s.tools.length > 0) section("tools", "tool", s.tools.length, s.tools);
  if (s.mcp.tools > 0) section("mcp", "tool", s.mcp.tools, s.mcp.items, s.mcp.onDemand ? " (loaded on-demand)" : "");
  if (s.memory.length > 0) section("memory", "file", s.memory.length, s.memory);
  if (s.skills.length > 0) section("skills", "skill", s.skills.length, s.skills);

  // The section names are what `categories.<id>.sections` refers to, so `all` shows them.
  if (expanded && s.sections.length > 0) {
    const total = s.sections.reduce((n, d) => n + d.tokens, 0);
    lines.push("", paint.bold("System prompt sections"), `└ ${count(s.sections.length, "section")} · ${formatTokens(total)} tokens`);
    for (const d of s.sections) {
      const owner = d.category === "system" ? "" : paint.dim(` → ${category(d.category)?.label ?? d.category}`);
      lines.push(`  ${d.label}: ${formatTokens(d.tokens)} tokens${owner}`);
    }
  }

  if (s.counter.failure) {
    lines.push("", paint.dim(`Tokenizer failed, counted with chars/4: ${s.counter.failure}`));
  }
  if (!expanded) {
    lines.push("", paint.dim("/context all to expand"));
  }
  return lines;
}
