import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./ferry.mjs";
import { SAMPLE_PAGES } from "./sample.js";
import { analyzeLogbook } from "./logbook.js";

function logbookDir() {
  const dir = mkdtempSync(join(tmpdir(), "ferry-"));
  mkdirSync(join(dir, "pages"));
  writeFileSync(join(dir, "ferry.config.json"), JSON.stringify({ logbookStyle: "jeppesen", firstYear: "2019" }));
  SAMPLE_PAGES.forEach((p, i) => writeFileSync(join(dir, "pages", `page-00${i + 1}.json`), JSON.stringify({ photo: `photos/page-00${i + 1}.jpg`, ...p.extraction })));
  return dir;
}

test("analyzeLogbook carries dates across pages", () => {
  const book = analyzeLogbook(SAMPLE_PAGES, { year: "2019" });
  assert.equal(book.rows.length, 13);
  assert.equal(book.rows[7].iso, "2019-05-04");
  assert.deepEqual(book.pages[1].suspects, [0]);
});

test("check writes a report that points at the misread row", () => {
  const dir = logbookDir();
  const logs = [];
  assert.equal(run(["check", "--dir", dir], (l) => logs.push(l)), 0);
  const report = readFileSync(join(dir, "output", "report.md"), "utf8");
  assert.match(report, /## page-001\.json — photos\/page-001\.jpg\n\n7 rows · ✅ adds up \(7 columns\)/);
  assert.match(report, /❌ \*\*Totals Total\*\*: rows add to 7\.9, page says 8\.4 \(off by 0\.5\)/);
  assert.match(report, /🔎 \*\*Row 1\*\* is the only row/);
  assert.match(report, /⚠️ Row 1 · Total \(read as "1\.3"\): Hard to read/);
  assert.match(logs.join("\n"), /2 pages · 13 flights/);
});

test("export keeps aircraft edits and writes the CSV and review project", () => {
  const dir = logbookDir();
  run(["export", "--dir", dir], () => {});
  const aircraft = JSON.parse(readFileSync(join(dir, "aircraft.json"), "utf8"));
  assert.deepEqual(aircraft.map((a) => a.AircraftID), ["N123AB", "N456CD", "SIM"]);
  aircraft[0].TypeCode = "C172";
  writeFileSync(join(dir, "aircraft.json"), JSON.stringify(aircraft));
  run(["export", "--dir", dir], () => {});
  const csv = readFileSync(join(dir, "output", "foreflight-import.csv"), "utf8");
  assert.match(csv, /^N123AB,aircraft,C172,/m);
  assert.equal(csv.trimEnd().split("\r\n").length, 10 + 13);
  const project = JSON.parse(readFileSync(join(dir, "output", "ferry-flight-project.json"), "utf8"));
  assert.equal(project.pages.length, 2);
  assert.equal(project.settings.year, "2019");
});

test("check reports bad page files and missing pages", () => {
  const dir = logbookDir();
  writeFileSync(join(dir, "pages", "page-003.json"), "{ not json");
  run(["check", "--dir", dir], () => {});
  assert.match(readFileSync(join(dir, "output", "report.md"), "utf8"), /❌ page-003\.json:/);
  const empty = mkdtempSync(join(tmpdir(), "ferry-"));
  const logs = [];
  assert.equal(run(["check", "--dir", empty], (l) => logs.push(l)), 1);
  assert.match(logs[0], /No page files/);
});
