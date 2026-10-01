import { DEFAULT_COMPACTION_SETTINGS } from "@earendil-works/pi-coding-agent";

export interface UsageSource {
  /** Pi's context total, measured from a model response; null when there is none to trust. */
  tokens: number | null;
  contextWindow: number;
  model: { name: string; id: string } | null;
  compaction: { enabled: boolean; reserveTokens: number };
}

/**
 * Without a response in context, pi's total is its own estimate over the messages alone (no
 * tools, and no prompt before the first turn), so it only counts once a response reported usage.
 */
function hasMeasuredUsage(messages: readonly unknown[]): boolean {
  return messages.some((m) => {
    const msg = m as { role?: unknown; usage?: unknown } | null;
    return msg?.role === "assistant" && typeof msg.usage === "object" && msg.usage !== null;
  });
}

export function usageSource(
  messages: readonly unknown[],
  usage: { tokens: number | null; contextWindow: number } | undefined,
  model: { name?: string; id: string; contextWindow?: number } | undefined,
  compaction: { enabled?: boolean; reserveTokens?: number } | undefined,
): UsageSource {
  return {
    tokens: hasMeasuredUsage(messages) ? (usage?.tokens ?? null) : null,
    contextWindow: usage?.contextWindow ?? model?.contextWindow ?? 0,
    model: model ? { name: model.name ?? model.id, id: model.id } : null,
    compaction: {
      enabled: compaction?.enabled ?? DEFAULT_COMPACTION_SETTINGS.enabled,
      reserveTokens: compaction?.reserveTokens ?? DEFAULT_COMPACTION_SETTINGS.reserveTokens,
    },
  };
}
