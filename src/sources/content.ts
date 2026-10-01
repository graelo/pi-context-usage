/** Plain-text view of a message `content` field: a string, or an array of typed parts. */
export function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part !== "object" || part === null) return "";
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") return p.text;
      if (typeof p.thinking === "string") return p.thinking;
      // Tool calls: the model sees the name and the arguments.
      if (p.type === "toolCall") return `${String(p.name ?? "")} ${JSON.stringify(p.arguments ?? {})}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
