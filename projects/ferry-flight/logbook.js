// Analyse a whole logbook: normalize every page in order (dates, dittos and years carry
// across pages), run the row checks and each page's totals check. Shared by the web page
// and the command-line tool so both flag exactly the same things.

import { normalizeRows, sumFields } from "./normalize.js";
import { rowIssues, pageTotalsCheck, suspectRows } from "./checks.js";

// pages: [{ name, extraction: { rows, pageTotals, yearHint, notes } }] in logbook order.
export function analyzeLogbook(pages, { year = "" } = {}) {
  let ctx = { yearHint: year || null };
  let prevIso = null;
  const out = [];
  const rows = [];
  for (const page of pages) {
    const ex = page.extraction;
    if (!ex) continue;
    if (!ctx.y && ex.yearHint) ctx.yearHint = ex.yearHint;
    const res = normalizeRows(ex.rows || [], ctx);
    ctx = res.context;
    const issues = res.rows.map((r) => {
      const list = rowIssues(r, prevIso);
      if (r.iso) prevIso = r.iso;
      return list;
    });
    const totals = pageTotalsCheck(res.rows, ex.pageTotals || {});
    out.push({ page, rows: res.rows, issues, totals, sums: sumFields(res.rows), suspects: suspectRows(res.rows, totals.mismatches) });
    rows.push(...res.rows);
  }
  return { pages: out, rows };
}
