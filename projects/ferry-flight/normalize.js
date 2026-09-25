// Turns what was written on a paper logbook page into clean values: hours as numbers,
// dates as ISO strings, ditto marks resolved. Pure functions — no DOM.

// Every time/count field a paper logbook row can carry. Hours are decimal; counts are integers.
export const HOUR_FIELDS = [
  "total", "pic", "sic", "dual", "cfi", "solo", "xc", "night", "actual", "hood", "sim",
  "asel", "amel", "ases", "ames",
];
export const COUNT_FIELDS = ["approaches", "landingsDay", "landingsNight", "landings"];
export const TEXT_FIELDS = ["date", "makeModel", "tail", "from", "to", "via", "remarks", "instructor"];
export const ALL_FIELDS = [...TEXT_FIELDS, ...COUNT_FIELDS, ...HOUR_FIELDS];

// Columns pilots commonly fill with a ditto mark instead of repeating themselves.
const DITTO_FIELDS = ["makeModel", "tail", "from", "to"];
const DITTO = /^(?:"|''|〃|”|“|do\.?|ditto|same|-+|—|–|\^)$/i;

export function isDitto(value) {
  return typeof value === "string" && DITTO.test(value.trim());
}

// "1.3", ".8", "1 3" (Jeppesen hours|tenths columns), "1:18" (h:mm), "1,3" → number or null.
export function parseHours(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? round2(value) : null;
  let s = String(value).trim().replace(/[oO]/g, "0");
  if (!s || isDitto(s)) return null;
  let m;
  if ((m = s.match(/^(\d{1,3}):([0-5]\d)$/))) return round2(+m[1] + +m[2] / 60);
  if ((m = s.match(/^(\d{0,4})\s*[|\s]\s*(\d{1,2})$/))) {
    const frac = m[2].length === 1 ? +m[2] / 10 : +m[2] / 100;
    return round2(+(m[1] || 0) + frac);
  }
  s = s.replace(",", ".");
  if (/^\d*\.?\d+$|^\d+\.$/.test(s)) return round2(parseFloat(s));
  return null;
}

// "3", "2/1" (day/night written together) → integer or null.
export function parseCount(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null;
  const s = String(value).trim();
  if (!s || isDitto(s)) return null;
  const m = s.match(/^(\d+)(?:\s*\/\s*(\d+))?$/);
  if (!m) return null;
  return m[2] != null ? +m[1] + +m[2] : +m[1];
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Parse a handwritten date into {y, m, d}; any part may be missing (null) and is filled in
// from the rows above it. Assumes US month-first order for numeric dates.
export function parseDateParts(value) {
  const s = String(value ?? "").trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1");
  if (!s || isDitto(s)) return null;
  let m;
  const year = (y) => (y == null ? null : y.length === 2 ? 2000 + +y - (+y > 50 ? 100 : 0) : +y);
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return { y: +m[1], m: +m[2], d: +m[3] };
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/))) return { y: year(m[3]), m: +m[1], d: +m[2] };
  const mon = (t) => MONTHS.indexOf(t.slice(0, 3)) + 1;
  if ((m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2}),?(?:\s+(\d{2}|\d{4}))?$/)) && mon(m[1]))
    return { y: year(m[3]), m: mon(m[1]), d: +m[2] };
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3,9})\.?,?(?:\s+(\d{2}|\d{4}))?$/)) && mon(m[2]))
    return { y: year(m[3]), m: mon(m[2]), d: +m[1] };
  if ((m = s.match(/^(\d{1,2})$/))) return { y: null, m: null, d: +m[1] };
  return null;
}

const pad = (n) => String(n).padStart(2, "0");
export const isoDate = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;

function validDate({ y, m, d }) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Normalize the raw rows of one or more pages, in logbook order. `context` carries the last
// known date/aircraft across pages. Returns { rows, context }; each row gets `iso` (or null)
// plus numeric fields, and `_notes` explaining anything that was inferred.
export function normalizeRows(rawRows, context = {}) {
  let { y = null, m = null, d = null, yearHint = null } = context;
  let prev = context.prev || {};
  if (y == null && yearHint) y = +yearHint;
  const rows = rawRows.map((raw) => {
    const row = { _notes: [] };
    for (const f of TEXT_FIELDS) row[f] = String(raw[f] ?? "").trim();
    for (const f of DITTO_FIELDS) {
      if (isDitto(row[f]) && prev[f]) { row[f] = prev[f]; row._notes.push(`${f} from ditto`); }
    }
    row.tail = row.tail.toUpperCase().replace(/\s+/g, "");
    row.from = row.from.toUpperCase();
    row.to = row.to.toUpperCase();
    for (const f of HOUR_FIELDS) row[f] = parseHours(raw[f]);
    for (const f of COUNT_FIELDS) row[f] = parseCount(raw[f]);
    row.uncertain = Array.isArray(raw.uncertain) ? raw.uncertain.filter((f) => ALL_FIELDS.includes(f)) : [];

    const parts = isDitto(row.date) ? { y: null, m: null, d: null } : parseDateParts(row.date);
    row.iso = null;
    if (parts) {
      let ny = parts.y ?? y, nm = parts.m ?? m, nd = parts.d ?? d;
      // Day-only entry that goes backwards means the month rolled over.
      if (parts.m == null && parts.d != null && d != null && parts.d < d && nm != null) {
        nm += 1; if (nm > 12) { nm = 1; if (ny != null) ny += 1; }
        row._notes.push("month rolled over");
      }
      // Month going backwards without a written year means the year rolled over.
      if (parts.y == null && parts.m != null && m != null && parts.m < m && ny != null) {
        ny += 1; row._notes.push("year rolled over");
      }
      if (ny != null && nm != null && nd != null && validDate({ y: ny, m: nm, d: nd })) {
        row.iso = isoDate({ y: ny, m: nm, d: nd });
        if (parts.y == null) row._notes.push("year inferred");
        y = ny; m = nm; d = nd;
      }
    }
    // Landings: prefer split day/night columns; fall back to a single total column.
    if (row.landings == null && (row.landingsDay != null || row.landingsNight != null))
      row.landings = (row.landingsDay || 0) + (row.landingsNight || 0);
    prev = { makeModel: row.makeModel, tail: row.tail, from: row.from, to: row.to };
    return row;
  });
  return { rows, context: { y, m, d, yearHint, prev } };
}

// Sum hour/count fields across rows (null treated as 0), rounded to 0.1-safe precision.
export function sumFields(rows, fields = [...HOUR_FIELDS, ...COUNT_FIELDS]) {
  const out = {};
  for (const f of fields) out[f] = round2(rows.reduce((a, r) => a + (r[f] || 0), 0));
  return out;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
