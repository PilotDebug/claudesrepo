// Build-log logic. Pure functions over plain entry objects:
//   { id, date: "YYYY-MM-DD", assembly, hours, note }
// Dates are handled as UTC calendar days so time zones never shift a session.

export const ASSEMBLIES = [
  "Tail feathers", "Wings", "Flaps & ailerons", "Fuselage", "Landing gear",
  "Fuel system", "Controls", "Firewall forward", "Cowling", "Panel & avionics",
  "Electrical", "Interior", "Covering & paint", "Research & planning",
];

const DAY = 86_400_000;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
const toDay = (s) => Date.parse(s + "T00:00:00Z");
const fromDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Monday of the week containing `date`. */
export function weekStart(date) {
  const ms = toDay(date);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  return fromDay(ms - dow * DAY);
}

/** Validates and cleans a raw entry; returns null if it can't be logged. */
export function normalize(raw, id = raw.id) {
  const hours = Math.round(Number(raw.hours) * 100) / 100;
  const assembly = String(raw.assembly ?? "").trim();
  const date = String(raw.date ?? "").trim();
  if (!isDate(date) || !assembly || !(hours > 0 && hours <= 24)) return null;
  return { id: id || `${date}-${Math.random().toString(36).slice(2, 8)}`, date, assembly, hours, note: String(raw.note ?? "").trim() };
}

/** Totals, per-assembly hours, and the last `weeks` weeks of hours ending at `today`. */
export function summarize(entries, today, weeks = 12) {
  const byAssembly = new Map();
  const byWeek = new Map();
  let total = 0;
  for (const e of entries) {
    total += e.hours;
    const a = byAssembly.get(e.assembly) || { assembly: e.assembly, hours: 0, sessions: 0 };
    a.hours += e.hours; a.sessions += 1;
    byAssembly.set(e.assembly, a);
    const w = weekStart(e.date);
    byWeek.set(w, (byWeek.get(w) || 0) + e.hours);
  }
  const thisWeek = weekStart(today);
  const series = Array.from({ length: weeks }, (_, i) => {
    const start = fromDay(toDay(thisWeek) - (weeks - 1 - i) * 7 * DAY);
    return { start, hours: byWeek.get(start) || 0 };
  });
  return {
    total,
    sessions: entries.length,
    thisWeek: byWeek.get(thisWeek) || 0,
    byAssembly: [...byAssembly.values()].sort((a, b) => b.hours - a.hours || a.assembly.localeCompare(b.assembly)),
    weeks: series,
  };
}

const CSV_COLUMNS = ["date", "assembly", "hours", "note"];
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function toCSV(entries) {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => CSV_COLUMNS.map((c) => csvCell(e[c])).join(","));
  return [CSV_COLUMNS.join(","), ...rows].join("\n") + "\n";
}

/** Parses CSV written by toCSV (or a spreadsheet export with the same headers). */
export function fromCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!header) return [];
  const idx = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]));
  return body
    .map((r) => normalize(Object.fromEntries(CSV_COLUMNS.map((c) => [c, r[idx[c]] ?? ""]))))
    .filter(Boolean);
}
