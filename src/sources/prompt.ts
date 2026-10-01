import type { DeclaredState } from "./transcript.ts";
import type { Item } from "./types.ts";

export interface PromptSource {
  items: Item[];
  /**
   * True when the items are pi's named sections. False when only the rendered prompt is known
   * (before the first turn, or a prompt forced by an extension): then the single item holds
   * everything, sections included.
   */
  structured: boolean;
}

/** Unsectioned text gets this key; it never collides with a section name. */
export const UNSECTIONED_KEY = "";

export function promptSource(state: DeclaredState | null, renderedPrompt: string): PromptSource {
  if (!state || state.sections.size === 0) {
    const text = state ? state.content.join("\n\n") || renderedPrompt : renderedPrompt;
    return { items: [{ key: UNSECTIONED_KEY, label: "system prompt", text }], structured: false };
  }

  const items: Item[] = [];
  const content = state.content.join("\n\n");
  if (content) items.push({ key: UNSECTIONED_KEY, label: "instructions", text: content });
  for (const [name, text] of state.sections) items.push({ key: name, label: name, text });
  return { items, structured: true };
}
