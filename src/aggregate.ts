import type { CategoryTable } from "./categories.ts";
import type { Collected } from "./sources/index.ts";
import { IMAGE_TOKENS } from "./sources/messages.ts";
import type { Item } from "./sources/types.ts";
import type { Counter } from "./tokens.ts";

export interface Detail {
  label: string;
  tokens: number;
}

/**
 * The report's data, independent of pi and of rendering. Stored in the session as is, so it
 * holds labels and counts only, never context content.
 */
export interface Snapshot {
  version: 2;
  model: { id: string } | null;
  contextWindow: number;
  total: number;
  /** True when pi had no measured total and `total` is the sum of our estimates. */
  estimated: boolean;
  /** Content categories in grid order, with their labels at the time of the report. */
  categories: { id: string; label: string; tokens: number }[];
  /** Measured total minus the estimates: tokenizer mismatch and provider format overhead. */
  unattributed: number;
  free: number;
  /** Tokens reserved before auto-compaction kicks in; null when auto-compaction is off. */
  buffer: number | null;
  /** The system prompt's named sections and the category each landed in. Empty when opaque. */
  sections: (Detail & { category: string })[];
  /** Declared non-MCP tools, costliest first. */
  tools: Detail[];
  mcp: { tools: number; onDemand: boolean; items: Detail[] };
  memory: Detail[];
  skills: Detail[];
  /** Slash commands to mention per category id, only those the session has. */
  commands: Record<string, string>;
  counter: { name: string; failure?: string };
}

/** Category ids whose tokens come from somewhere other than prompt sections. */
const SYSTEM = "system";
const TOOLS = "tools";
const MCP = "mcp";
const MEMORY = "memory";
const SKILLS = "skills";
const MESSAGES = "messages";

export async function aggregate(c: Collected, counter: Counter, table: CategoryTable): Promise<Snapshot> {
  const countItems = (items: readonly Item[]) =>
    Promise.all(items.map(async (item) => ({ item, tokens: await counter.count(item.text) })));
  const sum = (counted: readonly { tokens: number }[]) => counted.reduce((n, x) => n + x.tokens, 0);

  const [prompt, tools, files, skills, messageText] = await Promise.all([
    countItems(c.prompt.items),
    countItems(c.tools),
    countItems(c.contextFiles),
    countItems(c.skills),
    counter.count(c.messages.items.map((i) => i.text).join("\n")),
  ]);

  const tokens = new Map(table.categories.map((cat) => [cat.id, 0]));
  const add = (id: string, n: number) => tokens.set(id, (tokens.get(id) ?? 0) + n);

  const sections: Snapshot["sections"] = [];
  if (c.prompt.structured) {
    for (const { item, tokens: n } of prompt) {
      const category = table.sectionCategory(item.key);
      add(category, n);
      sections.push({ label: item.label, tokens: n, category });
    }
  } else {
    // One opaque prompt: carve out what the structured sources say is in it.
    add(MEMORY, sum(files));
    add(SKILLS, sum(skills));
    add(SYSTEM, Math.max(0, sum(prompt) - sum(files) - sum(skills)));
  }

  const mcpNames = new Set(c.mcp.map((t) => t.name));
  for (const { item, tokens: n } of tools) add(mcpNames.has(item.key) ? MCP : TOOLS, n);
  add(MESSAGES, messageText + c.messages.images * IMAGE_TOKENS);

  const estimate = [...tokens.values()].reduce((a, b) => a + b, 0);
  const measured = c.usage.tokens;
  const total = measured === null ? estimate : Math.max(measured, estimate);

  const window = c.usage.contextWindow;
  const buffer = c.usage.compaction.enabled ? Math.min(c.usage.compaction.reserveTokens, window) : null;

  const toolTokens = new Map(tools.map(({ item, tokens: n }) => [item.key, n]));
  const commands: Record<string, string> = {};
  for (const cat of table.categories) {
    if (cat.command && c.commands.has(cat.command)) commands[cat.id] = cat.command;
  }

  const byCost = (a: Detail, b: Detail) => b.tokens - a.tokens;

  return {
    version: 2,
    model: c.usage.model ? { id: c.usage.model.id } : null,
    contextWindow: window,
    total,
    estimated: measured === null,
    categories: table.categories.map((cat) => ({ id: cat.id, label: cat.label, tokens: tokens.get(cat.id) ?? 0 })),
    unattributed: total - estimate,
    free: Math.max(0, window - total - (buffer ?? 0)),
    buffer,
    sections,
    tools: tools
      .filter(({ item }) => !mcpNames.has(item.key))
      .map(({ item, tokens: n }) => ({ label: item.label, tokens: n }))
      .sort(byCost),
    mcp: {
      tools: c.mcp.length,
      onDemand: c.mcp.length > 0 && c.mcp.every((t) => !toolTokens.has(t.name)),
      items: c.mcp.map((t) => ({ label: t.name, tokens: toolTokens.get(t.name) ?? 0 })).sort(byCost),
    },
    memory: files.map(({ item, tokens: n }) => ({ label: item.label, tokens: n })),
    skills: skills.map(({ item, tokens: n }) => ({ label: item.label, tokens: n })),
    commands,
    counter: { name: counter.name, ...(counter.failure ? { failure: counter.failure } : {}) },
  };
}
