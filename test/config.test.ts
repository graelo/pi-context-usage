import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig, loadConfigForSession } from "../src/config.ts";

const extensionId = "pi-context-usage";

async function writeConfig(path: string, config: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(config));
}

async function createConfigFixture(): Promise<{ root: string; cwd: string; agentDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "pi-context-usage-config-"));
  const cwd = join(root, "nested", "directory");
  const agentDir = join(root, "agent");

  await Promise.all([
    mkdir(join(root, ".git")),
    mkdir(cwd, { recursive: true }),
    writeConfig(join(root, ".pi", "extensions", extensionId, "config.json"), {
      categories: { messages: { color: 141 } },
    }),
    writeConfig(join(agentDir, "extensions", extensionId, "config.json"), {
      tokenizer: "tik",
      categories: { messages: { label: "Conversation" }, memory: { color: "#d75f87" } },
    }),
  ]);

  return { root, cwd, agentDir };
}

test("a trusted project overrides one key of one category and inherits the rest", async () => {
  const fixture = await createConfigFixture();
  try {
    const { config, diagnostics } = loadConfigForSession(
      { cwd: fixture.cwd, isProjectTrusted: () => true },
      { agentDir: fixture.agentDir },
    );
    assert.deepEqual(diagnostics, []);
    assert.equal(config.tokenizer, "tik");
    assert.deepEqual(config.categories.messages, { label: "Conversation", color: 141 });
    assert.deepEqual(config.categories.memory, { label: "Memory files", color: "#d75f87", sections: ["project_context"] });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("an untrusted project session uses only the global configuration", async () => {
  const fixture = await createConfigFixture();
  try {
    const { config } = loadConfigForSession(
      { cwd: fixture.cwd, isProjectTrusted: () => false },
      { agentDir: fixture.agentDir },
    );
    assert.deepEqual(config.categories.messages, { label: "Conversation", color: "accent" });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("config without a trust decision does not consider the project tier", async () => {
  const fixture = await createConfigFixture();
  try {
    const { config } = loadConfig({ cwd: fixture.cwd, agentDir: fixture.agentDir });
    assert.equal(config.categories.messages!.color, "accent");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("an invalid category falls back to defaults with a diagnostic", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-context-usage-config-"));
  try {
    const agentDir = join(root, "agent");
    await writeConfig(join(agentDir, "extensions", extensionId, "config.json"), { categories: { nope: { color: 1 } } });
    const { config, diagnostics } = loadConfig({ cwd: root, agentDir });
    assert.equal(config.categories.nope, undefined);
    assert.match(diagnostics.join("\n"), /categories\.nope/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
