import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

export interface Counter {
  /** What produced the counts, for the report: `chars/4` or the tokenizer command. */
  readonly name: string;
  count(text: string): Promise<number>;
  /** Set once the tokenizer failed; counts after that use chars/4. */
  readonly failure: string | undefined;
}

export function charsOver4(text: string): number {
  return Math.ceil(text.length / 4);
}

export const charsCounter: Counter = {
  name: "chars/4",
  count: async (text) => charsOver4(text),
  failure: undefined,
};

const TIMEOUT_MS = 10_000;
const MAX_CONCURRENT = 8;

/** Counts survive across `/context` runs: most of the context doesn't change between them. */
const cache = new Map<string, number>();

/**
 * A counter that pipes text to `command` (run by the shell) and reads the first integer it
 * prints. On the first failure it stops spawning and falls back to chars/4 for the rest.
 */
export function commandCounter(command: string): Counter {
  let failure: string | undefined;
  let running = 0;
  const queue: (() => void)[] = [];

  const acquire = () =>
    running < MAX_CONCURRENT
      ? (running++, Promise.resolve())
      : new Promise<void>((resolve) => queue.push(() => (running++, resolve())));
  const release = () => {
    running--;
    queue.shift()?.();
  };

  return {
    name: command,
    get failure() {
      return failure;
    },
    async count(text) {
      if (text.length === 0) return 0;
      if (failure) return charsOver4(text);

      const key = `${command}\0${createHash("sha1").update(text).digest("hex")}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;

      await acquire();
      try {
        if (failure) return charsOver4(text);
        const n = await runTokenizer(command, text);
        cache.set(key, n);
        return n;
      } catch (err) {
        failure ??= err instanceof Error ? err.message : String(err);
        return charsOver4(text);
      } finally {
        release();
      }
    },
  };
}

export function createCounter(tokenizer: string): Counter {
  return tokenizer.trim() ? commandCounter(tokenizer.trim()) : charsCounter;
}

function runTokenizer(command: string, text: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, timeout: TIMEOUT_MS, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code !== 0) {
        const why = signal ? `killed by ${signal}` : `exit ${code}`;
        return reject(new Error(`${command}: ${why}${stderr.trim() ? `: ${stderr.trim().split("\n")[0]}` : ""}`));
      }
      const match = /\d+/.exec(stdout);
      if (!match) return reject(new Error(`${command}: no token count in output`));
      resolve(Number(match[0]));
    });
    // A tokenizer that exits without reading stdin is reported through `close`, not here.
    child.stdin.on("error", () => {});
    child.stdin.end(text);
  });
}
