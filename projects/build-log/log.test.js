import { test } from "node:test";
import assert from "node:assert/strict";
import { fromCSV, normalize, summarize, toCSV, weekStart } from "./log.js";

const e = (date, assembly, hours, note = "") => normalize({ date, assembly, hours, note }, `${date}-${assembly}`);

test("weekStart is the Monday of the week", () => {
  assert.equal(weekStart("2026-09-24"), "2026-09-21"); // Thursday
  assert.equal(weekStart("2026-09-21"), "2026-09-21"); // Monday
  assert.equal(weekStart("2026-09-27"), "2026-09-21"); // Sunday
});

test("normalize rejects bad entries", () => {
  assert.equal(normalize({ date: "2026-13-40", assembly: "Wings", hours: 2 }), null);
  assert.equal(normalize({ date: "2026-09-24", assembly: " ", hours: 2 }), null);
  assert.equal(normalize({ date: "2026-09-24", assembly: "Wings", hours: 0 }), null);
  assert.equal(normalize({ date: "2026-09-24", assembly: "Wings", hours: 30 }), null);
  assert.equal(normalize({ date: "2026-09-24", assembly: " Wings ", hours: "2.555" }).hours, 2.56);
});

test("summarize totals by assembly and week", () => {
  const entries = [
    e("2026-09-22", "Wings", 3), e("2026-09-24", "Wings", 2),
    e("2026-09-15", "Tail feathers", 4), e("2026-06-01", "Wings", 1),
  ];
  const s = summarize(entries, "2026-09-24", 4);
  assert.equal(s.total, 10);
  assert.equal(s.sessions, 4);
  assert.equal(s.thisWeek, 5);
  assert.deepEqual(s.byAssembly.map((a) => [a.assembly, a.hours]), [["Wings", 6], ["Tail feathers", 4]]);
  assert.deepEqual(s.weeks.map((w) => w.hours), [0, 0, 4, 5]);
  assert.equal(s.weeks.at(-1).start, "2026-09-21");
});

test("CSV round-trips, including commas and quotes in notes", () => {
  const entries = [e("2026-09-24", "Wings", 2.5, 'Riveted "main" spar, left side'), e("2026-09-20", "Controls", 1)];
  const back = fromCSV(toCSV(entries));
  assert.deepEqual(back.map(({ id, ...rest }) => rest), [
    { date: "2026-09-20", assembly: "Controls", hours: 1, note: "" },
    { date: "2026-09-24", assembly: "Wings", hours: 2.5, note: 'Riveted "main" spar, left side' },
  ]);
});

test("fromCSV skips invalid rows and tolerates CRLF", () => {
  const rows = fromCSV("date,assembly,hours,note\r\n2026-09-01,Wings,2,ok\r\nnope,Wings,2,\r\n");
  assert.equal(rows.length, 1);
});
