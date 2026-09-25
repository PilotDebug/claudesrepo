// Sanity checks on transcribed rows, so a human reviews the handful of rows that look wrong
// instead of re-reading every page. The strongest check is the page's own "totals this page"
// line: if the rows don't add up to what the pilot wrote, something was misread.

import { HOUR_FIELDS, COUNT_FIELDS, parseHours, parseCount, sumFields } from "./normalize.js";

const TOL = 0.05; // hours are logged to tenths; allow float noise
export const LABELS = {
  date: "Date", makeModel: "Make/model", tail: "Ident", from: "From", to: "To", via: "Via",
  remarks: "Remarks", instructor: "Instructor", approaches: "Appr", landingsDay: "Day ldg",
  landingsNight: "Night ldg", landings: "Ldg", total: "Total", pic: "PIC", sic: "SIC",
  dual: "Dual rcvd", cfi: "Dual given", solo: "Solo", xc: "XC", night: "Night", actual: "Actual",
  hood: "Sim inst", sim: "Sim/FTD", asel: "ASEL", amel: "AMEL", ases: "ASES", ames: "AMES",
};

// Returns [{ field, level: "error"|"warn", message }] for one normalized row.
export function rowIssues(row, prevIso = null) {
  const out = [];
  const add = (field, level, message) => out.push({ field, level, message });
  const total = row.total || 0;
  const simOnly = !total && (row.sim || 0) > 0;

  if (!row.iso) add("date", "error", row.date ? `Can't read date "${row.date}"` : "Missing date");
  else if (prevIso && row.iso < prevIso) add("date", "warn", `Earlier than the row above (${prevIso})`);
  if (!row.tail && !simOnly) add("tail", "warn", "No aircraft ident");
  if (!total && !simOnly && !(row.hood > 0)) add("total", "error", "No flight time");

  for (const f of ["pic", "sic", "dual", "cfi", "solo", "xc", "night", "actual", "hood"]) {
    if (row[f] != null && row[f] > total + TOL && !(simOnly && (f === "hood" || f === "dual" || f === "cfi")))
      add(f, "error", `${LABELS[f]} ${row[f]} exceeds total ${total}`);
  }
  const cls = ["asel", "amel", "ases", "ames"].filter((f) => row[f] != null);
  if (cls.length && total) {
    const sum = cls.reduce((a, f) => a + row[f], 0);
    if (Math.abs(sum - total) > TOL) add(cls[0], "warn", `Category/class hours ${round(sum)} ≠ total ${total}`);
  }
  if ((row.pic || 0) + (row.dual || 0) + (row.sic || 0) === 0 && total > 0)
    add("pic", "warn", "Neither PIC, SIC nor dual received logged");
  if (row.landingsNight > 0 && !row.night) add("night", "warn", "Night landings but no night time");
  if (total > 24) add("total", "error", "More than 24 hours");
  for (const f of row.uncertain || []) add(f, "warn", `Hard to read — check ${LABELS[f] || f}`);
  return out;
}

// Compare each column's sum against the page's own totals line. `written` holds raw strings.
// Returns [{ field, sum, written }] for mismatches, and the list of fields that were checked.
export function pageTotalsCheck(rows, written = {}) {
  const sums = sumFields(rows);
  const mismatches = [];
  const checked = [];
  for (const f of [...HOUR_FIELDS, ...COUNT_FIELDS]) {
    const w = COUNT_FIELDS.includes(f) ? parseCount(written[f]) : parseHours(written[f]);
    if (w == null) continue;
    checked.push(f);
    if (Math.abs(w - sums[f]) > TOL) mismatches.push({ field: f, sum: sums[f], written: w });
  }
  return { checked, mismatches };
}

// When every mismatched column is off by the same amount, the misread is usually one cell
// value repeated across a row (a 1.8 read as 1.3 in Total, Dual, XC and ASEL). Return the
// indexes of rows that carry a value in every mismatched column; one hit is a strong hint.
export function suspectRows(rows, mismatches) {
  if (!mismatches.length) return [];
  const delta = round(mismatches[0].written - mismatches[0].sum);
  if (mismatches.some((m) => Math.abs(m.written - m.sum - delta) > TOL)) return [];
  return rows.flatMap((r, i) => (mismatches.every((m) => r[m.field] > 0) ? [i] : []));
}

function round(n) {
  return Math.round(n * 100) / 100;
}
