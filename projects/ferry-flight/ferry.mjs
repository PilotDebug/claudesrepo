#!/usr/bin/env node
// Ferry Flight command-line tool, for a logbook folder worked on with Claude (e.g. Cowork).
//
//   node tools/ferry.mjs check  [--dir <logbook folder>]   check pages/*.json, write output/report.md
//   node tools/ferry.mjs export [--dir <logbook folder>]   write output/foreflight-import.csv
//
// The folder holds ferry.config.json, photos/, pages/ (one JSON transcription per photo),
// aircraft.json (created on first export, then edited) and output/. Node stdlib only.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseExtraction } from "./extract.js";
import { analyzeLogbook } from "./logbook.js";
import { LABELS } from "./checks.js";
import { buildForeFlightCsv, deriveAircraft, AIRCRAFT_COLUMNS } from "./foreflight.js";

const fmt = (n) => (Math.round((n || 0) * 10) / 10).toFixed(1);

export function loadLogbook(dir) {
  const configPath = join(dir, "ferry.config.json");
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
  const pagesDir = join(dir, "pages");
  const files = existsSync(pagesDir) ? readdirSync(pagesDir).filter((f) => f.toLowerCase().endsWith(".json")).sort() : [];
  const pages = [];
  const errors = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(readFileSync(join(pagesDir, f), "utf8"));
      pages.push({ name: f, photo: raw.photo || "", extraction: parseExtraction(raw) });
    } catch (e) {
      errors.push(`${f}: ${e.message}`);
    }
  }
  return { config, pages, errors };
}

// Markdown report: one section per page, flagged cells first, so a person (or Claude) knows
// exactly which cells to look at again on which photo.
export function buildReport({ config, pages, errors }) {
  const book = analyzeLogbook(pages, { year: config.firstYear || "" });
  const lines = ["# Ferry Flight check", ""];
  const flaggedRows = book.pages.reduce((n, p) => n + p.issues.filter((l) => l.length).length, 0);
  const badPages = book.pages.filter((p) => p.totals.mismatches.length);
  const t = book.rows.reduce((a, r) => ({ total: a.total + (r.total || 0), pic: a.pic + (r.pic || 0) }), { total: 0, pic: 0 });
  lines.push(`${book.pages.length} pages · ${book.rows.length} flights · ${fmt(t.total)} total hours · ${fmt(t.pic)} PIC`, "");
  lines.push(badPages.length || flaggedRows || errors.length
    ? `**Needs a look:** ${badPages.length} page(s) whose totals don't add up, ${flaggedRows} flagged row(s)${errors.length ? `, ${errors.length} unreadable page file(s)` : ""}.`
    : "**All pages add up and no rows are flagged.**", "");
  for (const e of errors) lines.push(`- ❌ ${e}`);
  if (errors.length) lines.push("");

  book.pages.forEach((cp) => {
    const { page, totals } = cp;
    const status = !totals.checked.length ? "no totals line to check"
      : totals.mismatches.length ? `❌ ${totals.mismatches.length} column(s) don't add up` : `✅ adds up (${totals.checked.length} columns)`;
    lines.push(`## ${page.name}${page.photo ? ` — ${page.photo}` : ""}`, "", `${cp.rows.length} rows · ${status}`, "");
    if (page.extraction.notes) lines.push(`> ${page.extraction.notes}`, "");
    for (const m of totals.mismatches)
      lines.push(`- ❌ **Totals ${LABELS[m.field]}**: rows add to ${fmt(m.sum)}, page says ${fmt(m.written)} (off by ${fmt(Math.abs(m.written - m.sum))})`);
    if (cp.suspects.length === 1) {
      lines.push(`- 🔎 **Row ${cp.suspects[0] + 1}** is the only row with a value in every column that's off — re-read it first.`);
    }
    cp.issues.forEach((list, ri) => {
      for (const i of list) {
        const raw = page.extraction.rows[ri]?.[i.field];
        lines.push(`- ${i.level === "error" ? "❌" : "⚠️"} Row ${ri + 1} · ${LABELS[i.field] || i.field}${raw ? ` (read as "${raw}")` : ""}: ${i.message}`);
      }
    });
    if (!totals.mismatches.length && !cp.issues.some((l) => l.length)) lines.push("- Nothing flagged.");
    lines.push("");
  });
  return { markdown: lines.join("\n"), book };
}

// aircraft.json keeps the owner's edits; new tails are added with guesses to review.
export function mergeAircraft(book, existing = []) {
  const byId = Object.fromEntries(existing.map((a) => [a.AircraftID, a]));
  return deriveAircraft(book.rows, byId).map(({ flights, ...a }) => a);
}

export function run(argv, log = console.log) {
  const [cmd, ...rest] = argv;
  const dirFlag = rest.indexOf("--dir");
  const dir = resolve(dirFlag >= 0 ? rest[dirFlag + 1] : ".");
  if (cmd !== "check" && cmd !== "export") {
    log("Usage: node tools/ferry.mjs <check|export> [--dir <logbook folder>]");
    return 1;
  }
  const loaded = loadLogbook(dir);
  if (!loaded.pages.length) {
    log(`No page files found in ${join(dir, "pages")}. Transcribe photos into pages/page-001.json first.`);
    return 1;
  }
  const out = join(dir, "output");
  mkdirSync(out, { recursive: true });
  const { markdown, book } = buildReport(loaded);
  writeFileSync(join(out, "report.md"), markdown);
  log(markdown.split("\n").slice(2, 5).join("\n").trim());
  log(`Report: ${join(out, "report.md")}`);
  if (cmd === "export") {
    const acPath = join(dir, "aircraft.json");
    const existing = existsSync(acPath) ? JSON.parse(readFileSync(acPath, "utf8")) : [];
    const aircraft = mergeAircraft(book, existing);
    writeFileSync(acPath, JSON.stringify(aircraft, AIRCRAFT_COLUMNS, 2) + "\n");
    writeFileSync(join(out, "foreflight-import.csv"), buildForeFlightCsv(aircraft, book.rows));
    // The same data in the review page's save format (tools/review.html → Load progress).
    const project = {
      app: "ferry-flight",
      settings: { style: loaded.config.logbookStyle || "jeppesen", year: loaded.config.firstYear || "", model: "claude-opus-5" },
      pages: loaded.pages.map((p, i) => ({ id: `p${i + 1}`, name: p.photo || p.name, status: "done", extraction: p.extraction })),
      aircraft: Object.fromEntries(aircraft.map((a) => [a.AircraftID, a])),
    };
    writeFileSync(join(out, "ferry-flight-project.json"), JSON.stringify(project, null, 1));
    log(`Aircraft: ${acPath} (${aircraft.length}) — fill in TypeCode, GearType and EngineType before importing.`);
    log(`ForeFlight CSV: ${join(out, "foreflight-import.csv")}`);
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("ferry.mjs")) {
  process.exitCode = run(process.argv.slice(2));
}
