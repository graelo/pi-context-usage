import assert from "node:assert/strict";
import test from "node:test";
import { aggregate, type Snapshot } from "../src/aggregate.ts";
import { DEFAULT_CATEGORIES, resolveCategories } from "../src/categories.ts";
import type { Collected } from "../src/sources/index.ts";
import type { Item } from "../src/sources/types.ts";
import { charsCounter } from "../src/tokens.ts";

/** An item whose chars/4 count is exactly `tokens`. */
const item = (key: string, tokens: number): Item => ({ key, label: key, text: "x".repeat(tokens * 4) });

const table = resolveCategories(DEFAULT_CATEGORIES);
const byId = (s: Snapshot) => Object.fromEntries(s.categories.map((c) => [c.id, c.tokens]));

function collected(overrides: Partial<Collected> = {}): Collected {
  return {
    prompt: {
      structured: true,
      items: [item("preamble", 100), item("skills", 40), item("project_context", 20), item("mcp_servers", 5), item("brand_new", 7)],
    },
    tools: [item("read", 200), item("mcp__docs__search", 30)],
    mcp: [
      { name: "mcp__docs__search", server: "docs", exposure: "direct" },
      { name: "mcp__docs__other", server: "docs", exposure: "codemode" },
    ],
    contextFiles: [item("AGENTS.md", 18)],
    skills: [item("a", 10), item("b", 10)],
    messages: { items: [item("0", 1000)], images: 0 },
    usage: { tokens: 10_000, contextWindow: 200_000, model: { name: "M", id: "m" }, compaction: { enabled: true, reserveTokens: 16_384 } },
    commands: new Set(["mcp"]),
    ...overrides,
  };
}

test("sections and tools land in their categories; unknown sections count as system prompt", async () => {
  const s = await aggregate(collected(), charsCounter, table);
  assert.deepEqual(byId(s), { system: 107, tools: 200, mcp: 35, memory: 20, skills: 40, messages: 1000 });
  assert.equal(s.total, 10_000);
  assert.equal(s.estimated, false);
  assert.equal(s.unattributed, 10_000 - 1402);
  assert.equal(s.free, 200_000 - 10_000 - 16_384);
  assert.deepEqual(
    s.sections.map((d) => `${d.label}:${d.category}`),
    ["preamble:system", "skills:skills", "project_context:memory", "mcp_servers:mcp", "brand_new:system"],
  );
});

test("estimates above the measured total: no unattributed tokens, the total follows the estimates", async () => {
  const s = await aggregate(
    collected({ usage: { tokens: 1000, contextWindow: 200_000, model: null, compaction: { enabled: true, reserveTokens: 0 } } }),
    charsCounter,
    table,
  );
  assert.equal(s.unattributed, 0);
  assert.equal(s.total, 1402);
});

test("MCP details: declared tools carry their schema cost, others are on demand", async () => {
  const s = await aggregate(collected(), charsCounter, table);
  assert.equal(s.mcp.onDemand, false);
  assert.deepEqual(s.mcp.items, [
    { label: "mcp__docs__search", tokens: 30 },
    { label: "mcp__docs__other", tokens: 0 },
  ]);
  assert.deepEqual(s.commands, { mcp: "mcp" });
  assert.deepEqual(s.tools, [{ label: "read", tokens: 200 }]);
});

test("unknown total: the total is the sum of the estimates", async () => {
  const s = await aggregate(
    collected({
      usage: { tokens: null, contextWindow: 200_000, model: null, compaction: { enabled: false, reserveTokens: 0 } },
      messages: { items: [item("0", 50)], images: 1 },
    }),
    charsCounter,
    table,
  );
  assert.equal(s.estimated, true);
  assert.equal(byId(s).messages, 50 + 1200);
  assert.equal(s.total, 402 + 1250);
  assert.equal(s.unattributed, 0);
  assert.equal(s.buffer, null);
});

test("opaque prompt: memory and skills are carved out of it from the structured sources", async () => {
  const s = await aggregate(collected({ prompt: { structured: false, items: [item("", 500)] } }), charsCounter, table);
  assert.equal(byId(s).memory, 18);
  assert.equal(byId(s).skills, 20);
  assert.equal(byId(s).system, 500 - 18 - 20);
  assert.deepEqual(s.sections, []);
});

test("a custom category claims sections and sits where configured", async () => {
  const custom = resolveCategories({
    ...DEFAULT_CATEGORIES,
    guidance: { label: "Pi guidance", sections: ["brand_new"], color: 109, after: "tools" },
  });
  const s = await aggregate(collected(), charsCounter, custom);
  assert.deepEqual(s.categories.map((c) => c.id), ["system", "tools", "guidance", "mcp", "memory", "skills", "messages"]);
  assert.equal(byId(s).guidance, 7);
  assert.equal(byId(s).system, 100);
});
