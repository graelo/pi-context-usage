import assert from "node:assert/strict";
import test from "node:test";
import type { Snapshot } from "../src/aggregate.ts";
import { DEFAULT_CATEGORIES, resolveCategories } from "../src/categories.ts";
import { formatPercent, formatTokens } from "../src/report/format.ts";
import { buildCells, GLYPH } from "../src/report/grid.ts";
import { layout } from "../src/report/layout.ts";
import type { Paint } from "../src/report/paint.ts";

const spaces = resolveCategories(DEFAULT_CATEGORIES).spaces;
const plain: Paint = { color: (_id, t) => t, bold: (t) => t, italic: (t) => t, dim: (t) => t };

/** The numbers from Claude Code's own `/context` screenshot. */
function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    version: 2,
    model: { id: "claude-sonnet-5-5" },
    contextWindow: 1_000_000,
    total: 133_300,
    estimated: false,
    categories: [
      { id: "system", label: "System prompt", tokens: 2_200 },
      { id: "tools", label: "System tools", tokens: 20_900 },
      { id: "mcp", label: "MCP tools", tokens: 0 },
      { id: "memory", label: "Memory files", tokens: 222 },
      { id: "skills", label: "Skills", tokens: 4_200 },
      { id: "messages", label: "Messages", tokens: 105_700 },
    ],
    unattributed: 0,
    sections: [
      { label: "preamble", tokens: 2_200, category: "system" },
      { label: "skills", tokens: 4_200, category: "skills" },
    ],
    free: 833_700,
    buffer: 33_000,
    tools: [
      { label: "subagent", tokens: 4_500 },
      { label: "read", tokens: 230 },
    ],
    mcp: { tools: 14, onDemand: true, items: [] },
    memory: [{ label: "CLAUDE.md", tokens: 222 }],
    skills: Array.from({ length: 25 }, (_, i) => ({ label: `s${i}`, tokens: 168 })),
    commands: { mcp: "mcp" },
    counter: { name: "chars/4" },
    ...overrides,
  };
}

test("token and percent formatting", () => {
  assert.deepEqual(
    [222, 2_200, 33_000, 133_300, 833_700, 999_990, 1_000_000, 1_500_000].map(formatTokens),
    ["222", "2.2k", "33k", "133.3k", "833.7k", "1m", "1m", "1.5m"],
  );
  assert.equal(formatPercent(222, 1_000_000), "0.0%");
  assert.equal(formatPercent(105_700, 1_000_000), "10.6%");
});

test("grid: 20×10 for a 1M window, categories in order, free then buffer", () => {
  const cells = buildCells(snapshot());
  assert.equal(cells.length, 200);
  const glyphs = cells.slice(0, 7).map((c) => `${c.id}:${c.glyph}`);
  assert.deepEqual(glyphs, [
    `system:${GLYPH.partial}`,
    `tools:${GLYPH.full}`,
    `tools:${GLYPH.full}`,
    `tools:${GLYPH.full}`,
    `tools:${GLYPH.full}`,
    `memory:${GLYPH.partial}`,
    `skills:${GLYPH.partial}`,
  ]);
  assert.equal(cells.filter((c) => c.id === "buffer").length, 7);
  assert.equal(cells.at(-1)!.glyph, GLYPH.buffer);
  assert.equal(cells.filter((c) => c.id === "mcp").length, 0);
});

test("grid never overflows, even when rounding overshoots", () => {
  const cells = buildCells(
    snapshot({
      contextWindow: 100,
      categories: ["system", "tools", "mcp", "memory", "skills", "messages"].map((id) => ({ id, label: id, tokens: 30 })),
      buffer: 50,
    }),
  );
  assert.equal(cells.length, 100);
});

test("layout: legend beside the grid when wide, below it when narrow", () => {
  const wide = layout(snapshot(), plain, spaces, 120, false);
  assert.match(wide[1]!, /⛀ ⛁ .* {3}claude-sonnet-5-5$/);
  assert.match(wide[2]!, / {3}133\.3k\/1m tokens \(13%\)$/);
  assert.ok(wide.some((l) => l.includes("Messages: 105.7k tokens (10.6%)")));
  assert.ok(wide.some((l) => l.includes("Free space: 833.7k (83.4%)")));
  assert.ok(wide.some((l) => l.includes("MCP tools · /mcp (loaded on-demand)")));
  assert.ok(wide.some((l) => l.includes("└ 25 skills · 4.2k tokens")));
  assert.equal(wide.at(-1), "  /context all to expand");
  assert.ok(!wide.includes("  System tools"));

  const narrow = layout(snapshot(), plain, spaces, 50, false);
  assert.ok(!narrow[1]!.includes("claude"));
  assert.ok(narrow.includes("  claude-sonnet-5-5"));
});

test("layout: unattributed tokens get their own legend line and cells", () => {
  const s = snapshot({ unattributed: 10_000 });
  assert.ok(layout(s, plain, spaces, 120, false).some((l) => l.includes("Unattributed: 10k tokens (1.0%)")));
  assert.equal(buildCells(s).filter((c) => c.id === "unattributed").length, 2);
});

test("layout: `all` lists every item, and the prompt sections with their category", () => {
  const lines = layout(snapshot(), plain, spaces, 120, true);
  assert.ok(lines.includes("    CLAUDE.md: 222 tokens"));
  assert.ok(lines.includes("  System tools"));
  assert.deepEqual(lines.slice(lines.indexOf("  System tools") + 1, lines.indexOf("  System tools") + 4), [
    "  └ 2 tools · 20.9k tokens",
    "    subagent: 4.5k tokens",
    "    read: 230 tokens",
  ]);
  assert.ok(lines.includes("    preamble: 2.2k tokens"));
  assert.ok(lines.includes("    skills: 4.2k tokens → Skills"));
  assert.ok(!lines.some((l) => l.includes("/context all to expand")));
});
