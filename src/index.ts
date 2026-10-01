import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { aggregate, type Snapshot } from "./aggregate.ts";
import { resolveCategories, type CategoryTable } from "./categories.ts";
import { DEFAULT_CONFIG, loadConfigForSession } from "./config.ts";
import { layout } from "./report/layout.ts";
import { themePaint } from "./report/paint.ts";
import { collect } from "./sources/index.ts";
import { createCounter } from "./tokens.ts";

const ENTRY_TYPE = "context-usage";

interface ReportEntry {
  snapshot: Snapshot;
  expanded: boolean;
}

/** Lays the report out at render time, so it follows the terminal width and theme. */
class ReportView implements Component {
  constructor(
    private readonly entry: ReportEntry,
    private readonly theme: Theme,
    private readonly table: () => CategoryTable,
  ) {}

  render(width: number): string[] {
    const table = this.table();
    const paint = themePaint(this.theme, table.color);
    return layout(this.entry.snapshot, paint, table.spaces, width, this.entry.expanded);
  }

  invalidate(): void {}
}

export default function (pi: ExtensionAPI) {
  // Defaults until session_start, when project trust is known and project config may apply.
  let config = DEFAULT_CONFIG;
  let table = resolveCategories(config.categories);

  pi.on("session_start", (_event, ctx) => {
    const loaded = loadConfigForSession(ctx);
    config = loaded.config;
    table = resolveCategories(config.categories);
    for (const problem of loaded.diagnostics) console.warn(problem);
  });

  // A custom entry, not a message: it is shown in the transcript but never sent to the model.
  pi.registerEntryRenderer<ReportEntry>(ENTRY_TYPE, (entry, _options, theme) =>
    entry.data?.snapshot?.version === 2 ? new ReportView(entry.data, theme, () => table) : undefined,
  );

  pi.registerCommand("context", {
    description: "Show context window usage by category (`all` to list every item)",
    getArgumentCompletions: (prefix) =>
      "all".startsWith(prefix.trim()) ? [{ value: "all", label: "all", description: "List every item" }] : null,
    handler: async (args, ctx) => {
      const snapshot = await aggregate(collect(pi, ctx), createCounter(config.tokenizer), table);
      pi.appendEntry<ReportEntry>(ENTRY_TYPE, { snapshot, expanded: args.trim() === "all" });
    },
  });
}
