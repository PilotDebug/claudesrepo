import { test } from "node:test";
import assert from "node:assert/strict";
import { greet } from "./hello.js";

test("default greeting", () => {
  assert.equal(greet(), "Hello, world!");
});

test("named greeting", () => {
  assert.equal(greet("Claude"), "Hello, Claude!");
});
