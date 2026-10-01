import type { DeclaredState, DeclaredTool } from "./transcript.ts";
import type { Item } from "./types.ts";

/** The schema text a tool costs: what providers receive for it. */
export function serializeTool(tool: DeclaredTool): string {
  return JSON.stringify({
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.parameters ?? {},
  });
}

/**
 * Tools declared to the model. The transcript is authoritative once a turn has run; before
 * that, the active tools are what the next turn will declare.
 */
export function toolsSource(state: DeclaredState | null, activeTools: readonly DeclaredTool[]): Item[] {
  const tools = state ? [...state.tools.values()] : activeTools;
  return tools.map((tool) => ({ key: tool.name, label: tool.name, text: serializeTool(tool) }));
}
