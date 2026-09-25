// What we ask the vision model for, and how we read its answer. Pure — the network call
// lives in app.js so this stays testable.

import { ALL_FIELDS, HOUR_FIELDS, COUNT_FIELDS } from "./normalize.js";

export const MODELS = {
  "claude-opus-5": "Claude Opus 5 — most accurate",
  "claude-sonnet-5": "Claude Sonnet 5 — cheaper",
};

export const LOGBOOK_STYLES = {
  jeppesen: "Jeppesen Pilot Logbook (two facing pages per spread; hours and tenths in split columns)",
  asa: "ASA Standard / SP-30 style logbook",
  other: "Other or custom logbook",
};

const str = { type: "string" };
const ROW_PROPS = Object.fromEntries([...ALL_FIELDS].map((f) => [f, str]));
const TOTAL_FIELDS = [...HOUR_FIELDS, ...COUNT_FIELDS];

export const PAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rows", "pageTotals", "yearHint", "notes"],
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [...ALL_FIELDS, "uncertain"],
        properties: { ...ROW_PROPS, uncertain: { type: "array", items: str } },
      },
    },
    pageTotals: {
      type: "object",
      additionalProperties: false,
      required: TOTAL_FIELDS,
      properties: Object.fromEntries(TOTAL_FIELDS.map((f) => [f, str])),
    },
    yearHint: str,
    notes: str,
  },
};

const FIELD_GUIDE = `Row fields (all strings, "" when the cell is empty or the column doesn't exist):
- date: exactly as written (e.g. "6/18", "18", "Jun 18 2022"); ditto marks as "\\"".
- makeModel, tail (aircraft ident / N-number), from, to, via (intermediate stops), remarks, instructor (CFI name if written).
- approaches, landingsDay, landingsNight, landings (use landings only when there is a single landings column).
- total (total duration of flight), pic, sic, dual (dual received), cfi (dual given / as flight instructor), solo,
  xc (cross-country), night, actual (actual instrument), hood (simulated instrument / hood), sim (flight simulator / FTD / ATD),
  asel, amel, ases, ames (aircraft category & class columns).
Hours: write decimals ("1.3"). Where hours and tenths are separate columns, combine them ("1" and "3" → "1.3").
Copy ditto marks as "\\"" rather than guessing the value above.`;

export function buildPrompt({ style = "jeppesen", yearHint = "" } = {}) {
  return `This is a photo of a page (or two-page spread) from a pilot's paper logbook: ${LOGBOOK_STYLES[style] || LOGBOOK_STYLES.other}.
Transcribe every flight entry row, top to bottom, reading across the spread so each row keeps its own values.
${FIELD_GUIDE}
- uncertain: names of any fields in that row you could not read confidently.
Skip the "totals this page", "amount forwarded" and "total to date" lines as rows. Instead put the "totals this page" values in pageTotals (same field names, "" if absent).
yearHint: any year written on the page (header, a date cell), else "".${yearHint ? ` The owner says entries around here are from ${yearHint}.` : ""}
notes: anything the owner should know (smudged rows, entries that span lines, endorsements rather than flights).
Transcribe faithfully — never invent values to make columns add up.`;
}

// Validate the model's JSON into the shape the app uses. Throws on nonsense.
export function parseExtraction(json) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  if (!data || !Array.isArray(data.rows)) throw new Error("Response has no rows");
  const clean = (o, fields) => Object.fromEntries(fields.map((f) => [f, typeof o?.[f] === "string" ? o[f] : o?.[f] == null ? "" : String(o[f])]));
  const rows = data.rows
    .map((r) => ({ ...clean(r, ALL_FIELDS), uncertain: Array.isArray(r?.uncertain) ? r.uncertain.map(String) : [] }))
    .filter((r) => ALL_FIELDS.some((f) => r[f] !== ""));
  return {
    rows,
    pageTotals: clean(data.pageTotals || {}, TOTAL_FIELDS),
    yearHint: String(data.yearHint ?? "").match(/\b(19|20)\d{2}\b/)?.[0] || "",
    notes: String(data.notes ?? ""),
  };
}

// Rough cost of reading one page, in US dollars, for the estimate shown before running.
export const PRICE_PER_MTOK = { "claude-opus-5": [5, 25], "claude-sonnet-5": [2, 10] };
export function estimateCost(pages, model) {
  const [inp, out] = PRICE_PER_MTOK[model] || PRICE_PER_MTOK["claude-opus-5"];
  const perPage = (2500 * inp + 5000 * out) / 1e6; // ~image+prompt in, rows+thinking out
  return Math.round(pages * perPage * 100) / 100;
}
