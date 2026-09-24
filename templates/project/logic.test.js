import { test } from "node:test";
import assert from "node:assert/strict";
import { greet } from "./logic.js";

test("greet", () => {
  assert.equal(greet(), "Hello, world!");
  assert.equal(greet(" Pilot "), "Hello, Pilot!");
});
