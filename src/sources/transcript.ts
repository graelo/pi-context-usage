import { contentToText } from "./content.ts";

/** A tool definition as declared to the model in a system message. */
export interface DeclaredTool {
  name: string;
  description?: string;
  parameters?: unknown;
}

/** What the model has been told, replayed from the transcript's system messages. */
export interface DeclaredState {
  /** Unsectioned instruction text: the leading message's base, plus any later additions. */
  content: string[];
  /** Named prompt sections, in declaration order. */
  sections: Map<string, string>;
  /** Tools declared to the model, by name. */
  tools: Map<string, DeclaredTool>;
}

/**
 * Replay pi's system messages (`SystemMessage` in `@earendil-works/pi-ai`): the leading one
 * declares sections and tools, later ones patch sections by name (`null` removes one) and add
 * or remove tools. Returns null when the transcript has no system message yet, which is the
 * case before the first turn.
 */
export function replaySystemMessages(messages: readonly unknown[]): DeclaredState | null {
  let state: DeclaredState | null = null;

  for (const message of messages) {
    if (typeof message !== "object" || message === null) continue;
    const m = message as Record<string, unknown>;
    if (m.role !== "system") continue;

    state ??= { content: [], sections: new Map(), tools: new Map() };

    const text = contentToText(m.content);
    if (text) state.content.push(text);

    const sections = m.sections;
    if (typeof sections === "object" && sections !== null) {
      for (const [name, value] of Object.entries(sections as Record<string, unknown>)) {
        if (value === null) state.sections.delete(name);
        else if (typeof value === "string") state.sections.set(name, value);
      }
    }

    for (const ref of asArray(m.toolsRemoved)) {
      const name = typeof ref === "string" ? ref : (ref as { name?: unknown })?.name;
      if (typeof name === "string") state.tools.delete(name);
    }
    for (const tool of asArray(m.toolsAdded)) {
      const t = tool as DeclaredTool;
      if (typeof t?.name === "string") state.tools.set(t.name, t);
    }
  }

  return state;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
