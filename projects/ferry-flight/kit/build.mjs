#!/usr/bin/env node
// Assemble the Ferry Flight kit — a folder to use with Claude (Cowork) on a local logbook
// folder — into scratch/ferry-flight-kit/ and scratch/ferry-flight-kit.zip.
//
//   node projects/ferry-flight/kit/build.mjs [--font path/to/handwriting.woff2]
//
// Needs Playwright (for the example photos) and `zip`. The font is optional: it makes the
// example photos look handwritten; without it they use the system's cursive face.

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { SAMPLE_PAGES } from "../sample.js";
import { run } from "../ferry.mjs";
import { FLIGHT_COLUMNS } from "../foreflight.js";

const kit = dirname(fileURLToPath(import.meta.url));
const project = dirname(kit);
const repo = dirname(dirname(project));
const out = join(repo, "scratch", "ferry-flight-kit");
const args = process.argv.slice(2);
const fontPath = args.includes("--font") ? args[args.indexOf("--font") + 1] : null;

rmSync(out, { recursive: true, force: true });
for (const d of ["photos", "pages", "output", "tools", "examples/photos", "examples/pages"]) mkdirSync(join(out, d), { recursive: true });

// Kit docs and config.
for (const f of ["README.md", "CLAUDE.md", "ferry.config.json"]) copyFileSync(join(kit, f), join(out, f));
writeFileSync(join(out, "photos", "PUT-PHOTOS-HERE.txt"), "Copy your logbook photos into this folder, in logbook order.\n");
writeFileSync(join(out, "pages", "CLAUDE-WRITES-HERE.txt"), "Claude writes one page-NNN.json transcription per photo into this folder.\n");

// Tools: the CLI plus the pure modules it imports.
const MODULES = ["normalize.js", "checks.js", "foreflight.js", "extract.js", "logbook.js"];
for (const f of ["ferry.mjs", ...MODULES]) copyFileSync(join(project, f), join(out, "tools", f));
writeFileSync(join(out, "tools", "package.json"), JSON.stringify({ private: true, type: "module" }) + "\n");

// review.html: the web page as one file that works when double-clicked (file:// can't load
// ES modules from other files), in review mode.
const bundle = [...MODULES, "sample.js", "app.js"].map((f) => {
  const src = readFileSync(join(project, f), "utf8")
    .replace(/^import .*?;\n/gm, "")
    .replace(/^export /gm, "");
  return `// ---- ${f} ----\n${src}`;
}).join("\n");
if (bundle.includes("</script")) throw new Error("bundle contains </script");
let html = readFileSync(join(project, "index.html"), "utf8")
  .replace('<html lang="en">', '<html lang="en" data-mode="review">')
  .replace("<title>Ferry Flight</title>", "<title>Ferry Flight Review</title>")
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${readFileSync(join(project, "style.css"), "utf8")}</style>`)
  .replace('<script type="module" src="app.js"></script>', () => `<script type="module">\n${bundle}</script>`);
writeFileSync(join(out, "tools", "review.html"), html);

// Example: the sample pages as a pilot's folder. The second photo shows 1.8 where the
// transcription says 1.3, so the checker has a real misread to catch.
const PHOTOS = ["PXL_20260925_101500123.jpg", "PXL_20260925_101530456.jpg"];
const ex = join(out, "examples");
writeFileSync(join(ex, "ferry.config.json"), JSON.stringify({ logbookStyle: "jeppesen", firstYear: "2019" }, null, 2) + "\n");
SAMPLE_PAGES.forEach((p, i) => {
  const { rows, ...rest } = p.extraction;
  const compact = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => (Array.isArray(v) ? v.length : v !== ""))));
  const pageTotals = Object.fromEntries(Object.entries(rest.pageTotals).filter(([, v]) => v !== ""));
  const page = { photo: `photos/${PHOTOS[i]}`, yearHint: rest.yearHint, notes: "Example page — made-up data.", rows: compact, pageTotals };
  writeFileSync(join(ex, "pages", `page-00${i + 1}.json`), JSON.stringify(page, null, 2) + "\n");
});

await drawPhotos();
run(["export", "--dir", ex], () => {});

execFileSync("zip", ["-qr", "../ferry-flight-kit.zip", "."], { cwd: out });
console.log(`Kit: ${out}\nZip: ${join(repo, "scratch", "ferry-flight-kit.zip")}`);

// ---------- example photos ----------
async function drawPhotos() {
  const require = createRequire(import.meta.url);
  let chromium;
  try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
  const font = fontPath && existsSync(fontPath)
    ? `@font-face { font-family: Hand; src: url(data:font/woff2;base64,${readFileSync(fontPath).toString("base64")}); }` : "";
  const truth = structuredClone(SAMPLE_PAGES.map((p) => p.extraction));
  for (const f of ["total", "dual", "xc", "asel"]) truth[1].rows[0][f] = "1.8"; // what the pilot actually wrote
  let forwarded = {};
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2400, height: 1560 } });
  for (let i = 0; i < truth.length; i++) {
    const { html, toDate } = spreadHtml(truth[i], forwarded, font, i === 0 ? "2019" : "");
    forwarded = toDate;
    await page.setContent(html);
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(ex, "photos", PHOTOS[i]), type: "jpeg", quality: 82 });
  }
  await browser.close();
}

function spreadHtml(extraction, forwarded, fontFace, year) {
  const LEFT = [["date", "DATE", 7], ["makeModel", "AIRCRAFT MAKE & MODEL", 11], ["tail", "AIRCRAFT IDENT", 9], ["from", "FROM", 7], ["to", "TO", 7],
    ["remarks", "REMARKS, PROCEDURES, MANEUVERS", 35], ["approaches", "NR INST APP", 6], ["landingsDay", "NR DAY LDG", 6], ["landingsNight", "NR NIGHT LDG", 6]];
  const RIGHT = [["asel", "SINGLE-ENGINE LAND"], ["xc", "CROSS COUNTRY"], ["night", "NIGHT"], ["actual", "ACTUAL INSTRUMENT"], ["hood", "SIMULATED INSTRUMENT"],
    ["sim", "FLIGHT SIMULATOR"], ["dual", "DUAL RECEIVED"], ["solo", "SOLO"], ["pic", "PILOT IN COMMAND"], ["total", "TOTAL DURATION OF FLIGHT"]];
  const ROWS = 13;
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const sums = {}, toDate = {};
  for (const [f] of [...LEFT, ...RIGHT]) {
    sums[f] = extraction.rows.reduce((a, r) => a + num(r[f]), 0);
    toDate[f] = sums[f] + (forwarded[f] || 0);
  }
  let seed = 7;
  const jitter = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; };
  const ink = (text) => text ? `<span class="ink" style="transform:translate(${(jitter() * 6).toFixed(1)}px,${(jitter() * 4).toFixed(1)}px) rotate(${(jitter() * 3).toFixed(1)}deg)">${text.replace(/"/g, "〃")}</span>` : "";
  const hrs = (v) => {
    if (v === "" || v == null) return "<td></td><td class='t'></td>";
    const [h, t = "0"] = String(v).split(".");
    return `<td class="h">${ink(h === "0" ? "" : h)}</td><td class="t">${ink(t)}</td>`;
  };
  const fmt = (n) => (n ? (Math.round(n * 10) / 10).toFixed(1) : "");
  const leftRow = (r) => `<tr>${LEFT.map(([f]) => {
    let v = r?.[f] ?? "";
    if (f === "remarks" && r?.via) v = `via ${r.via}. ${v}`;
    if (f === "remarks" && r?.instructor) v = `${v} — ${r.instructor}`;
    return `<td class="c-${f}">${ink(v)}</td>`;
  }).join("")}</tr>`;
  const rightRow = (r) => `<tr>${RIGHT.map(([f]) => hrs(r?.[f] ?? "")).join("")}</tr>`;
  const footL = (label, vals) => `<tr class="foot"><td colspan="6" class="lab">${label}</td>${["approaches", "landingsDay", "landingsNight"].map((f) => `<td>${ink(vals[f] ? String(Math.round(vals[f])) : "")}</td>`).join("")}</tr>`;
  const footR = (vals) => `<tr class="foot">${RIGHT.map(([f]) => hrs(fmt(vals[f]))).join("")}</tr>`;
  const rows = Array.from({ length: ROWS }, (_, i) => extraction.rows[i]);
  const html = `<!doctype html><html><head><style>
    ${fontFace}
    body { margin: 0; background: #3a3530; display: grid; place-items: center; height: 100vh; overflow: hidden; }
    .spread { display: flex; transform: rotate(-0.6deg); box-shadow: 0 20px 60px rgb(0 0 0 / .55); }
    .page { background: #f6f1e1; padding: 38px 30px 34px; width: 1150px; position: relative; }
    .page.left { background: linear-gradient(90deg, #f6f1e1 88%, #e2dac4); }
    .page.right { background: linear-gradient(270deg, #f6f1e1 88%, #e2dac4); }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th { font: 600 11px/1.15 "DejaVu Sans Condensed", "DejaVu Sans", sans-serif; color: #2f5d47; border: 1px solid #7fa38e; height: 64px; padding: 2px 3px; text-align: center; }
    td { border: 1px solid #9fbcaa; height: 62px; padding: 0 4px; white-space: nowrap; overflow: hidden; }
    td.h { border-right: 1px dashed #b8cdbf; text-align: right; }
    td.t { width: 22px; text-align: left; }
    .ink { display: inline-block; font: 34px/1 ${fontFace ? "Hand," : ""} cursive; color: #1d3a8f; }
    .c-remarks .ink { font-size: 28px; }
    .foot td { background: #ece5cf; border-top: 2px solid #7fa38e; }
    .lab { font: 700 12px "DejaVu Sans", sans-serif; color: #2f5d47; text-align: right; letter-spacing: .06em; }
    .yr { position: absolute; left: 44px; top: 8px; }
    .pagenum { position: absolute; bottom: 10px; font: 12px "DejaVu Sans", sans-serif; color: #2f5d47; }
  </style></head><body><div class="spread">
    <div class="page left">${year ? `<span class="yr">${ink("Year " + year)}</span>` : ""}
      <table><colgroup>${LEFT.map(([, , w]) => `<col style="width:${w}%">`).join("")}</colgroup>
      <tr>${LEFT.map(([, l]) => `<th>${l}</th>`).join("")}</tr>
      ${rows.map(leftRow).join("")}
      ${footL("TOTALS THIS PAGE", sums)}${footL("AMT. FORWARDED", forwarded)}${footL("TOTAL TO DATE", toDate)}</table>
      <span class="pagenum" style="left:30px">Made-up example page</span></div>
    <div class="page right"><table>
      <tr>${RIGHT.map(([, l]) => `<th colspan="2">${l}</th>`).join("")}</tr>
      ${rows.map(rightRow).join("")}
      ${footR(sums)}${footR(forwarded)}${footR(toDate)}</table>
      <span class="pagenum" style="right:30px">Ferry Flight kit</span></div>
  </div></body></html>`;
  return { html, toDate };
}

// Keep this import used: the ForeFlight columns are what the example CSV is checked against.
if (FLIGHT_COLUMNS.length !== 56) throw new Error("ForeFlight column list changed; re-check the kit docs");
