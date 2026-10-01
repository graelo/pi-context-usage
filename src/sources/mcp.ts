/**
 * Pi namespaces each MCP server's tools as `mcp__<server>` (`mcpNamespace()` in pi's
 * `core/mcp-servers.js`, not exported). This is the one place that knows it.
 */
const MCP_NAMESPACE_PREFIX = "mcp__";

export interface McpTool {
  name: string;
  server: string;
  /** How the model reaches it; only `direct` tools are declared up front. */
  exposure: string;
}

interface ToolInfoLike {
  name: string;
  exposure?: string;
  namespace?: { name: string };
}

/** Every reachable MCP tool, whatever its exposure. */
export function mcpSource(allTools: readonly ToolInfoLike[]): McpTool[] {
  return allTools
    .filter((t) => t.namespace?.name.startsWith(MCP_NAMESPACE_PREFIX) && t.exposure !== "hidden")
    .map((t) => ({
      name: t.name,
      server: t.namespace!.name.slice(MCP_NAMESPACE_PREFIX.length),
      exposure: t.exposure ?? "direct",
    }));
}
