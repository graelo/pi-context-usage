import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CATEGORIES, resolveCategories, type CategoryConfig } from "../src/categories.ts";

const resolve = (extra: Record<string, CategoryConfig>) => resolveCategories({ ...DEFAULT_CATEGORIES, ...extra });

test("built-ins: sections map to their category, anything else to system", () => {
  const table = resolve({});
  assert.equal(table.sectionCategory("skills"), "skills");
  assert.equal(table.sectionCategory("project_context"), "memory");
  assert.equal(table.sectionCategory("rules"), "system");
  assert.equal(table.color("messages"), "accent");
  assert.equal(table.spaces.unattributed.label, "Unattributed");
});

test("custom categories default to just before messages", () => {
  const table = resolve({ guidance: { label: "Pi guidance", sections: ["rules"] } });
  assert.deepEqual(table.categories.map((c) => c.id).slice(-2), ["guidance", "messages"]);
});

test("a built-in can give up its section", () => {
  const table = resolve({ mcp: { sections: [] } });
  assert.equal(table.sectionCategory("mcp_servers"), "system");
});

test("invalid configs are rejected with the offending key", () => {
  const cases: [Record<string, CategoryConfig>, RegExp][] = [
    [{ guidance: { label: "G", sections: ["skills"] } }, /'skills' is claimed by both/],
    [{ guidance: { sections: ["rules"] } }, /needs a 'label'/],
    [{ guidance: { label: "G", sections: ["rules"], after: "nope" } }, /no category 'nope'/],
    [{ messages: { sections: ["rules"] } }, /messages' can't claim sections/],
    [{ free: { sections: ["rules"] } }, /free' can't claim sections/],
    [{ skills: { after: "tools" } }, /only for custom categories/],
    [{ skills: { color: 300 } }, /0-255 index/],
  ];
  for (const [config, error] of cases) assert.throws(() => resolve(config), error);
});
