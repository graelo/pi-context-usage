/**
 * The report's categories, and the only place that maps pi's concepts onto them.
 *
 * The built-in table below is the default `categories` config. Users can relabel or recolor
 * any entry, move prompt sections between categories, and add categories of their own.
 * Sections no category claims land in "System prompt", so new pi sections are always counted.
 */

/** A theme token name (`accent`, `dim`, ...), a 256-color index, or a color string (`#d75f87`). */
export type ColorValue = string | number;

/** One entry of the `categories` config. */
export interface CategoryConfig {
  label?: string;
  color?: ColorValue;
  /** Named system prompt sections this category claims. */
  sections?: string[];
  /** Custom categories only: the category to place this one after. Default: before Messages. */
  after?: string;
}

export type SpaceId = "unattributed" | "free" | "buffer";

interface BuiltinDef {
  id: string;
  label: string;
  color: ColorValue;
  sections?: string[];
  /** Slash command to point at in the report, shown only if the session has it. */
  command?: string;
  /** Its tokens come from elsewhere than prompt sections, so it can't claim any. */
  fixed?: boolean;
}

/** In grid order. Tool schemas go to `tools`, or `mcp` for MCP tools; messages to `messages`. */
const BUILTIN: readonly BuiltinDef[] = [
  { id: "system", label: "System prompt", color: "dim", fixed: true },
  { id: "tools", label: "System tools", color: "muted" },
  { id: "mcp", label: "MCP tools", color: "mdLink", sections: ["mcp_servers"], command: "mcp" },
  { id: "memory", label: "Memory files", color: "error", sections: ["project_context"], command: "memory" },
  { id: "skills", label: "Skills", color: "warning", sections: ["skills"], command: "skills" },
  { id: "messages", label: "Messages", color: "accent", fixed: true },
];

/** Not categories of content: the rest of the window. Label and color only. */
const SPACES: readonly { id: SpaceId; label: string; color: ColorValue }[] = [
  { id: "unattributed", label: "Unattributed", color: "success" },
  { id: "free", label: "Free space", color: "dim" },
  { id: "buffer", label: "Autocompact buffer", color: "dim" },
];

export const DEFAULT_CATEGORIES: Readonly<Record<string, CategoryConfig>> = Object.fromEntries(
  [...BUILTIN, ...SPACES].map((d) => [
    d.id,
    { label: d.label, color: d.color, ...("sections" in d && d.sections ? { sections: [...d.sections] } : {}) },
  ]),
);

export interface Category {
  id: string;
  label: string;
  color: ColorValue;
  sections: string[];
  command?: string;
}

export interface CategoryTable {
  /** Content categories, in grid order. */
  categories: Category[];
  spaces: Record<SpaceId, { label: string; color: ColorValue }>;
  /** The category that claims a prompt section; "system" when none does. */
  sectionCategory(section: string): string;
  color(id: string): ColorValue | undefined;
}

/**
 * Resolve the `categories` config (already layered over {@link DEFAULT_CATEGORIES}) into the
 * ordered table the report uses. Throws on an invalid config.
 */
export function resolveCategories(config: Readonly<Record<string, CategoryConfig>>): CategoryTable {
  const spaceIds = new Set<string>(SPACES.map((s) => s.id));
  const builtinIds = new Set(BUILTIN.map((b) => b.id));

  for (const [id, entry] of Object.entries(config)) {
    checkEntry(id, entry);
    const builtin = BUILTIN.find((b) => b.id === id);
    if ((spaceIds.has(id) || builtin?.fixed) && entry.sections?.length) {
      throw new Error(`'categories.${id}' can't claim sections`);
    }
    if ((spaceIds.has(id) || builtin) && entry.after !== undefined) {
      throw new Error(`'categories.${id}.after' is only for custom categories`);
    }
    if (!spaceIds.has(id) && !builtin && (!entry.label || !entry.sections?.length)) {
      throw new Error(`'categories.${id}' is a new category: it needs a 'label' and some 'sections'`);
    }
  }

  const make = (id: string, def?: BuiltinDef): Category => {
    const entry = config[id] ?? {};
    return {
      id,
      label: entry.label ?? def?.label ?? id,
      color: entry.color ?? def?.color ?? "dim",
      sections: [...(entry.sections ?? [])],
      ...(def?.command ? { command: def.command } : {}),
    };
  };

  const categories = BUILTIN.map((def) => make(def.id, def));
  for (const id of Object.keys(config).filter((id) => !builtinIds.has(id) && !spaceIds.has(id))) {
    const after = config[id]!.after;
    const at = after === undefined
      ? categories.findIndex((c) => c.id === "messages")
      : categories.findIndex((c) => c.id === after) + 1;
    if (at <= 0) throw new Error(`'categories.${id}.after': no category '${after}'`);
    categories.splice(at, 0, make(id));
  }

  const owner = new Map<string, string>();
  for (const category of categories) {
    for (const section of category.sections) {
      const other = owner.get(section);
      if (other) throw new Error(`section '${section}' is claimed by both '${other}' and '${category.id}'`);
      owner.set(section, category.id);
    }
  }

  const spaces = Object.fromEntries(
    SPACES.map((s) => [s.id, { label: config[s.id]?.label ?? s.label, color: config[s.id]?.color ?? s.color }]),
  ) as CategoryTable["spaces"];

  return {
    categories,
    spaces,
    sectionCategory: (section) => owner.get(section) ?? "system",
    color: (id) => categories.find((c) => c.id === id)?.color ?? spaces[id as SpaceId]?.color,
  };
}

function checkEntry(id: string, entry: unknown): asserts entry is CategoryConfig {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(`'categories.${id}' must be an object`);
  }
  const e = entry as Record<string, unknown>;
  if (e.label !== undefined && typeof e.label !== "string") throw new Error(`'categories.${id}.label' must be a string`);
  if (e.after !== undefined && typeof e.after !== "string") throw new Error(`'categories.${id}.after' must be a string`);
  if (e.sections !== undefined && !(Array.isArray(e.sections) && e.sections.every((s) => typeof s === "string"))) {
    throw new Error(`'categories.${id}.sections' must be an array of section names`);
  }
  const color = e.color;
  const isIndex = typeof color === "number" && Number.isInteger(color) && color >= 0 && color <= 255;
  if (color !== undefined && !isIndex && typeof color !== "string") {
    throw new Error(`'categories.${id}.color' must be a theme color name, a 0-255 index, or a color string`);
  }
}
