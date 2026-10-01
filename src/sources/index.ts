import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { contextFilesSource } from "./context-files.ts";
import { mcpSource, type McpTool } from "./mcp.ts";
import { messagesSource, type MessagesSource } from "./messages.ts";
import { promptSource, type PromptSource } from "./prompt.ts";
import { skillsSource } from "./skills.ts";
import { toolsSource } from "./tools.ts";
import { replaySystemMessages } from "./transcript.ts";
import type { Item } from "./types.ts";
import { usageSource, type UsageSource } from "./usage.ts";

/** Everything the report needs, as plain data. The only module that talks to pi. */
export interface Collected {
  prompt: PromptSource;
  tools: Item[];
  mcp: McpTool[];
  contextFiles: Item[];
  skills: Item[];
  messages: MessagesSource;
  usage: UsageSource;
  /** Names of the slash commands available in this session. */
  commands: Set<string>;
}

export function collect(pi: ExtensionAPI, ctx: ExtensionCommandContext): Collected {
  const messages = ctx.sessionManager.buildSessionProjection().messages;
  const declared = replaySystemMessages(messages);
  const options = ctx.getSystemPromptOptions();
  const allTools = pi.getAllTools();
  const active = new Set(pi.getActiveTools());

  return {
    prompt: promptSource(declared, ctx.getSystemPrompt()),
    tools: toolsSource(declared, allTools.filter((t) => active.has(t.name))),
    mcp: mcpSource(allTools),
    contextFiles: contextFilesSource(options.contextFiles ?? [], ctx.cwd),
    skills: skillsSource(options.skills ?? []),
    messages: messagesSource(messages),
    usage: usageSource(messages, ctx.getContextUsage(), ctx.model, pi.getSettings().compaction),
    commands: new Set(pi.getCommands().map((c) => c.name)),
  };
}
