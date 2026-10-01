import { relative } from "node:path";
import type { Item } from "./types.ts";

/** Project context files (AGENTS.md and the like), one item per file. */
export function contextFilesSource(
  files: readonly { path: string; content: string }[],
  cwd: string,
): Item[] {
  return files.map((f) => {
    const rel = relative(cwd, f.path);
    return { key: f.path, label: rel.startsWith("..") ? f.path : rel, text: f.content };
  });
}
