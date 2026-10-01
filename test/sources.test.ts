import assert from "node:assert/strict";
import test from "node:test";
import { mcpSource } from "../src/sources/mcp.ts";
import { messagesSource } from "../src/sources/messages.ts";
import { promptSource } from "../src/sources/prompt.ts";
import { toolsSource } from "../src/sources/tools.ts";
import { replaySystemMessages } from "../src/sources/transcript.ts";
import { usageSource } from "../src/sources/usage.ts";

const tool = (name: string) => ({ name, description: `${name} tool`, parameters: { type: "object" } });

test("system messages replay: later messages patch sections and tools", () => {
  const state = replaySystemMessages([
    { role: "system", content: "", sections: { preamble: "p", skills: "s1", cwd: "/x" }, toolsAdded: [tool("read"), tool("bash")] },
    { role: "user", content: "hi" },
    { role: "system", content: "extra", sections: { skills: "s2", cwd: null }, toolsRemoved: [{ name: "bash" }] },
  ]);
  assert.ok(state);
  assert.deepEqual([...state.sections], [["preamble", "p"], ["skills", "s2"]]);
  assert.deepEqual([...state.tools.keys()], ["read"]);
  assert.deepEqual(state.content, ["extra"]);
});

test("no system message yet: replay is null and the prompt is one opaque item", () => {
  const state = replaySystemMessages([{ role: "user", content: "hi" }]);
  assert.equal(state, null);
  const prompt = promptSource(state, "rendered prompt");
  assert.equal(prompt.structured, false);
  assert.deepEqual(prompt.items.map((i) => i.text), ["rendered prompt"]);
});

test("tools come from the transcript once declared, else from the active tools", () => {
  const state = replaySystemMessages([{ role: "system", content: "", toolsAdded: [tool("read")] }]);
  assert.deepEqual(toolsSource(state, [tool("bash")]).map((t) => t.key), ["read"]);
  assert.deepEqual(toolsSource(null, [tool("bash")]).map((t) => t.key), ["bash"]);
});

test("MCP tools are recognised by namespace, hidden ones excluded", () => {
  const tools = mcpSource([
    { name: "read" },
    { name: "mcp__docs__search", exposure: "codemode", namespace: { name: "mcp__docs" } },
    { name: "mcp__docs__secret", exposure: "hidden", namespace: { name: "mcp__docs" } },
    { name: "x", namespace: { name: "other" } },
  ]);
  assert.deepEqual(tools, [{ name: "mcp__docs__search", server: "docs", exposure: "codemode" }]);
});

test("messages skip system messages and count images", () => {
  const { items, images } = messagesSource([
    { role: "system", content: "prompt" },
    { role: "user", content: [{ type: "text", text: "look" }, { type: "image", data: "..." }] },
    { role: "assistant", content: [{ type: "toolCall", name: "read", arguments: { path: "a" } }] },
  ]);
  assert.equal(images, 1);
  assert.deepEqual(items.map((i) => i.text), ["look", 'read {"path":"a"}']);
});

test("pi's total is only trusted once a response measured it", () => {
  const usage = { tokens: 500, contextWindow: 1000 };
  assert.equal(usageSource([{ role: "user", content: "hi" }], usage, undefined, undefined).tokens, null);
  const answered = [{ role: "user", content: "hi" }, { role: "assistant", content: [], usage: { input: 1 } }];
  assert.equal(usageSource(answered, usage, undefined, undefined).tokens, 500);
});
