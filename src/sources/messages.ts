import { contentToText } from "./content.ts";
import type { Item } from "./types.ts";

/** Pi's own estimate for an image: 4800 chars, i.e. 1200 tokens at chars/4. */
export const IMAGE_TOKENS = 1200;

export interface MessagesSource {
  items: Item[];
  images: number;
}

/**
 * Conversation messages, excluding system messages (those are the prompt). Only used to
 * estimate the conversation when pi does not know the context total.
 */
export function messagesSource(messages: readonly unknown[]): MessagesSource {
  const items: Item[] = [];
  let images = 0;

  messages.forEach((message, i) => {
    if (typeof message !== "object" || message === null) return;
    const m = message as Record<string, unknown>;
    if (m.role === "system") return;

    if (Array.isArray(m.content)) {
      images += m.content.filter((p) => (p as { type?: unknown })?.type === "image").length;
    }
    // Compaction and branch summaries carry their text in `summary`.
    const text = [contentToText(m.content), typeof m.summary === "string" ? m.summary : ""]
      .filter(Boolean)
      .join("\n");
    if (text) items.push({ key: String(i), label: String(m.role ?? "message"), text });
  });

  return { items, images };
}
