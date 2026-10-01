import assert from "node:assert/strict";
import test from "node:test";
import { charsOver4, commandCounter, createCounter } from "../src/tokens.ts";

/** A tokenizer that reports the stdin byte count, so results are predictable. */
const BYTES = `node -e "let n=0;process.stdin.on('data',d=>n+=d.length).on('end',()=>console.log(n))"`;

test("no tokenizer configured: chars/4", async () => {
  const counter = createCounter("  ");
  assert.equal(counter.name, "chars/4");
  assert.equal(await counter.count("abcdefgh!"), 3);
});

test("the tokenizer command reads stdin and its count is used", async () => {
  const counter = commandCounter(BYTES);
  assert.equal(await counter.count("hello world"), 11);
  assert.equal(await counter.count(""), 0);
  assert.equal(counter.failure, undefined);
});

test("a failing tokenizer falls back to chars/4 and reports why", async () => {
  const counter = commandCounter("exit 3");
  const text = "x".repeat(40);
  assert.equal(await counter.count(text), charsOver4(text));
  assert.match(counter.failure ?? "", /exit 3/);
});

test("output without a number is a failure", async () => {
  const counter = commandCounter("echo nope");
  await counter.count("abc");
  assert.match(counter.failure ?? "", /no token count/);
});
