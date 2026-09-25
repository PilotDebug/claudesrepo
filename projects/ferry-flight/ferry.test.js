import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHours, parseCount, parseDateParts, normalizeRows, isDitto } from "./normalize.js";
import { rowIssues, pageTotalsCheck, suspectRows } from "./checks.js";
import { SAMPLE_PAGES } from "./sample.js";
import { buildForeFlightCsv, deriveAircraft, toFlightRow, csvCell, remarkFlags, FLIGHT_COLUMNS, AIRCRAFT_COLUMNS } from "./foreflight.js";
import { parseExtraction, PAGE_SCHEMA, buildPrompt, estimateCost, tileRects } from "./extract.js";

const blank = (over = {}) => ({
  date: "", makeModel: "", tail: "", from: "", to: "", via: "", remarks: "", instructor: "",
  approaches: "", landingsDay: "", landingsNight: "", landings: "", total: "", pic: "", sic: "",
  dual: "", cfi: "", solo: "", xc: "", night: "", actual: "", hood: "", sim: "",
  asel: "", amel: "", ases: "", ames: "", uncertain: [], ...over,
});

test("parseHours reads the ways pilots write time", () => {
  assert.equal(parseHours("1.3"), 1.3);
  assert.equal(parseHours(".8"), 0.8);
  assert.equal(parseHours("1 3"), 1.3); // Jeppesen hours | tenths
  assert.equal(parseHours("12|4"), 12.4);
  assert.equal(parseHours("1:30"), 1.5); // h:mm
  assert.equal(parseHours("1,3"), 1.3);
  assert.equal(parseHours("2."), 2);
  assert.equal(parseHours("O.9"), 0.9); // letter O for zero
  assert.equal(parseHours(""), null);
  assert.equal(parseHours('"'), null);
  assert.equal(parseHours("abc"), null);
});

test("parseCount handles day/night pairs", () => {
  assert.equal(parseCount("3"), 3);
  assert.equal(parseCount("2/1"), 3);
  assert.equal(parseCount(""), null);
});

test("parseDateParts", () => {
  assert.deepEqual(parseDateParts("6/18/22"), { y: 2022, m: 6, d: 18 });
  assert.deepEqual(parseDateParts("6/18/1998"), { y: 1998, m: 6, d: 18 });
  assert.deepEqual(parseDateParts("6-18"), { y: null, m: 6, d: 18 });
  assert.deepEqual(parseDateParts("Jun 18, 2022"), { y: 2022, m: 6, d: 18 });
  assert.deepEqual(parseDateParts("18 June"), { y: null, m: 6, d: 18 });
  assert.deepEqual(parseDateParts("3rd"), { y: null, m: null, d: 3 });
  assert.deepEqual(parseDateParts("2022-06-18"), { y: 2022, m: 6, d: 18 });
  assert.equal(parseDateParts("smudge"), null);
  assert.ok(isDitto('"') && isDitto("do") && isDitto("〃") && !isDitto("N123"));
});

test("normalizeRows carries dates, dittos and years forward", () => {
  const { rows, context } = normalizeRows([
    blank({ date: "12/28/21", makeModel: "C-172", tail: "n12345", from: "kpao", to: "KSQL", total: "1.2" }),
    blank({ date: "30", makeModel: '"', tail: '"', from: '"', to: "KHAF", total: "0.8" }),
    blank({ date: "1/4", makeModel: '"', tail: "N54321", total: "1 5" }), // new year
    blank({ date: "2", tail: '"', total: ".9" }), // day only after the 4th → next month
  ]);
  assert.deepEqual(rows.map((r) => r.iso), ["2021-12-28", "2021-12-30", "2022-01-04", "2022-02-02"]);
  assert.equal(rows[0].tail, "N12345");
  assert.equal(rows[1].tail, "N12345");
  assert.equal(rows[1].from, "KPAO");
  assert.equal(rows[2].makeModel, "C-172");
  assert.equal(rows[2].total, 1.5);
  assert.equal(rows[3].tail, "N54321");
  assert.ok(rows[2]._notes.includes("year rolled over"));
  assert.ok(rows[3]._notes.includes("month rolled over"));
  // Context carries to the next page.
  const next = normalizeRows([blank({ date: "5", tail: '"', total: "1" })], context);
  assert.equal(next.rows[0].iso, "2022-02-05");
  assert.equal(next.rows[0].tail, "N54321");
});

test("normalizeRows uses the year hint and sums split landings", () => {
  const { rows } = normalizeRows([blank({ date: "3/9", landingsDay: "3", landingsNight: "1", total: "1" })], { yearHint: "1998" });
  assert.equal(rows[0].iso, "1998-03-09");
  assert.equal(rows[0].landings, 4);
});

test("rowIssues flags impossible rows and passes clean ones", () => {
  const [clean] = normalizeRows([blank({ date: "1/2/22", tail: "N1", total: "1.3", pic: "1.3", asel: "1.3" })]).rows;
  assert.deepEqual(rowIssues(clean), []);

  const [bad] = normalizeRows([blank({ date: "1/2/22", tail: "N1", total: "1.3", pic: "3.1", night: "2", asel: "1.0", landingsNight: "1", uncertain: ["xc"] })]).rows;
  const fields = rowIssues(bad, "2022-02-01").map((i) => `${i.field}:${i.level}`);
  assert.deepEqual(fields.sort(), ["asel:warn", "date:warn", "night:error", "pic:error", "xc:warn"].sort());

  const [sim] = normalizeRows([blank({ date: "1/2/22", sim: "1.5", hood: "1.5", dual: "1.5" })]).rows;
  assert.deepEqual(rowIssues(sim), []);

  const [unread] = normalizeRows([blank({ date: "??", tail: "N1" })]).rows;
  assert.deepEqual(rowIssues(unread).map((i) => i.field).sort(), ["date", "total"]);
});

test("pageTotalsCheck compares against the written totals line", () => {
  const { rows } = normalizeRows([
    blank({ date: "1/1/22", total: "1.2", pic: "1.2", landings: "2" }),
    blank({ date: "1/2/22", total: "0.9", pic: "0.9", landings: "1" }),
  ]);
  const ok = pageTotalsCheck(rows, { total: "2.1", pic: "2 1", landings: "3", night: "" });
  assert.deepEqual(ok.checked, ["total", "pic", "landings"]);
  assert.deepEqual(ok.mismatches, []);
  const bad = pageTotalsCheck(rows, { total: "2.7", pic: "2.1" });
  assert.deepEqual(bad.mismatches, [{ field: "total", sum: 2.1, written: 2.7 }]);
});

test("deriveAircraft guesses class from the column that held hours", () => {
  const { rows } = normalizeRows([
    blank({ date: "1/1/22", tail: "N1", makeModel: "PA-28", total: "1", asel: "1" }),
    blank({ date: "1/2/22", tail: "N2", makeModel: "BE-58", total: "2", amel: "2" }),
    blank({ date: "1/3/22", tail: "N1", makeModel: "PA-28-181", total: "1", asel: "1" }),
    blank({ date: "1/4/22", tail: "N1", makeModel: "PA-28-181", total: "1", asel: "1" }),
    blank({ date: "1/5/22", makeModel: "Redbird", sim: "1.0" }),
  ]);
  const ac = deriveAircraft(rows, { N2: { TypeCode: "BE58", Make: "Beech" } });
  assert.deepEqual(ac.map((a) => [a.AircraftID, a.Model, a.Class, a.EquipmentType, a.flights]), [
    ["N1", "PA-28-181", "airplane_single_engine_land", "aircraft", 3],
    ["N2", "BE-58", "airplane_multi_engine_land", "aircraft", 1],
    ["SIM", "Redbird", "", "aatd", 1],
  ]);
  assert.equal(ac[1].TypeCode, "BE58"); // owner edits survive
});

test("toFlightRow maps paper columns to ForeFlight's", () => {
  const [r] = normalizeRows([blank({
    date: "6/18/22", tail: "N40LF", from: "KEFD", to: "KEFD", via: "T41", total: "1.3", dual: "1.3",
    landingsDay: "3", landingsNight: "1", night: "0.4", approaches: "2", hood: "0.5",
    instructor: "Cotton Feray", remarks: 'BFR, "steep turns"',
  })]).rows;
  const row = Object.fromEntries(FLIGHT_COLUMNS.map((c, i) => [c, toFlightRow(r)[i]]));
  assert.equal(row.Date, "2022-06-18");
  assert.equal(row.Route, "T41");
  assert.equal(row.TotalTime, "1.3");
  assert.equal(row.DualReceived, "1.3");
  assert.equal(row.PIC, "");
  assert.equal(row.AllLandings, "4");
  assert.equal(row.NightLandingsFullStop, "1");
  assert.equal(row.SimulatedInstrument, "0.5");
  assert.equal(row.Approach1, "2;;;KEFD;;");
  assert.equal(row.FlightReview, "true");
  assert.equal(row.IPC, "false");
  assert.equal(row.InstructorName, "Cotton Feray");
});

test("remarkFlags", () => {
  assert.deepEqual(remarkFlags("IPC w/ J. Smith"), { FlightReview: false, Checkride: false, IPC: true });
  assert.deepEqual(remarkFlags("PPL checkride - passed!"), { FlightReview: false, Checkride: true, IPC: false });
  assert.deepEqual(remarkFlags("pattern work"), { FlightReview: false, Checkride: false, IPC: false });
});

test("buildForeFlightCsv produces ForeFlight's two-table layout", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  const { rows } = normalizeRows([
    blank({ date: "1/2/22", tail: "N1", makeModel: "C172", total: "1", pic: "1", remarks: "x, y" }),
    blank({ date: "1/1/22", tail: "N1", total: "2", pic: "2" }),
  ]);
  const csv = buildForeFlightCsv(deriveAircraft(rows), rows);
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines[0], "ForeFlight Logbook Import" + ",".repeat(AIRCRAFT_COLUMNS.length - 1));
  assert.equal(lines[2].split(",")[0], "Aircraft Table");
  assert.equal(lines[3], AIRCRAFT_COLUMNS.join(","));
  assert.equal(lines[4], "N1,aircraft,,,,C172,airplane,airplane_single_engine_land,,Piston,false,false,false,false");
  assert.equal(lines[6].split(",")[0], "Flights Table");
  assert.equal(lines[6].split(",").length, FLIGHT_COLUMNS.length);
  assert.equal(lines[7], FLIGHT_COLUMNS.join(","));
  assert.ok(lines[8].startsWith("2022-01-01,N1,")); // sorted by date
  assert.ok(lines[9].endsWith(',"x, y"'));
});

test("parseExtraction cleans the model's JSON", () => {
  const page = parseExtraction(JSON.stringify({
    rows: [blank({ date: "1/2", total: 1.3 }), blank()],
    pageTotals: { total: "1.3" },
    yearHint: "Year 1999",
    notes: "",
  }));
  assert.equal(page.rows.length, 1); // empty row dropped
  assert.equal(page.rows[0].total, "1.3");
  assert.equal(page.pageTotals.pic, "");
  assert.equal(page.yearHint, "1999");
  assert.throws(() => parseExtraction("{}"), /no rows/);
});

test("schema and prompt are consistent", () => {
  const rowProps = PAGE_SCHEMA.properties.rows.items;
  assert.deepEqual(Object.keys(rowProps.properties).sort(), [...rowProps.required].sort());
  assert.match(buildPrompt({ yearHint: "2004" }), /2004/);
  assert.equal(estimateCost(100, "claude-opus-5"), 13.75);
});

test("suspectRows finds the one misread row in the sample page", () => {
  const ex = SAMPLE_PAGES[1].extraction;
  const { rows } = normalizeRows(ex.rows, { yearHint: "2019" });
  const { mismatches } = pageTotalsCheck(rows, ex.pageTotals);
  assert.deepEqual(mismatches.map((m) => m.field).sort(), ["asel", "dual", "total", "xc"]);
  assert.deepEqual(suspectRows(rows, mismatches), [0]);
  // Different deltas → no single-cell explanation.
  assert.deepEqual(suspectRows(rows, [{ field: "total", sum: 1, written: 2 }, { field: "pic", sum: 1, written: 1.5 }]), []);
});

test("tileRects splits along the long side with overlap", () => {
  const spread = tileRects(4000, 3000);
  assert.equal(spread.wide, true);
  assert.deepEqual(spread.tiles, [{ x: 0, y: 0, w: 2120, h: 3000 }, { x: 1880, y: 0, w: 2120, h: 3000 }]);
  const page = tileRects(3000, 4000);
  assert.equal(page.wide, false);
  assert.deepEqual(page.tiles[1], { x: 0, y: 1880, w: 3000, h: 2120 });
});

test("plan prompt spells out the JSON shape and the tiles", () => {
  const p = buildPrompt({ tiled: true, json: true });
  assert.match(p, /left and right/);
  assert.match(p, /"landingsNight": ""/);
  assert.match(p, /"pageTotals"/);
  assert.doesNotMatch(buildPrompt(), /Reply with only one JSON/);
});
