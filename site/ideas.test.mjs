import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseIdeas, STATUSES } from "./ideas.mjs";

test("parses fields, pitch, and defaults", () => {
  const [a, b] = parseIdeas(`# Ideas
Intro with Status: shaped that must be ignored.

## First idea

Line one of the pitch
and line two.

Status: Shaped
Category: Making
Prior art: Something else
First slice: A small thing
Tags: one, two ,

## Second idea
Just a pitch.
`);
  assert.equal(a.title, "First idea");
  assert.equal(a.pitch, "Line one of the pitch and line two.");
  assert.equal(a.status, "shaped");
  assert.equal(a.category, "Making");
  assert.equal(a.priorArt, "Something else");
  assert.equal(a.firstSlice, "A small thing");
  assert.deepEqual(a.tags, ["one", "two"]);
  assert.equal(b.status, "raw");
  assert.equal(b.category, "Uncategorised");
  assert.deepEqual(b.tags, []);
});

test("unknown status falls back to raw", () => {
  assert.equal(parseIdeas("## X\nStatus: someday\n")[0].status, "raw");
});

test("the real IDEAS.md parses cleanly", () => {
  const ideas = parseIdeas(fs.readFileSync(new URL("../IDEAS.md", import.meta.url), "utf8"));
  assert.ok(ideas.length > 0);
  const categories = new Set(["Making", "Aviation & drones", "Cars & mobility", "Home & robotics",
    "Gaming & esports", "Social & civic", "Money & markets", "Services & work"]);
  for (const i of ideas) {
    assert.ok(i.pitch, `${i.title}: missing pitch`);
    assert.ok(STATUSES.includes(i.status), `${i.title}: bad status`);
    assert.ok(categories.has(i.category), `${i.title}: unknown category "${i.category}"`);
    assert.ok(!/\b(Status|Category|Prior art|Angle|First slice|Project|Tags):/.test(i.pitch), `${i.title}: a field line leaked into the pitch`);
  }
});
