import { test } from "node:test";
import assert from "node:assert/strict";
import {
  area, bracket, checks, circle, gap, metrics, panel, perimeter, plate, rrect, spread, toDXF, toSVG,
} from "./parts.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test("spread places items evenly, single item centred", () => {
  assert.deepEqual(spread(3, 10, 30), [10, 20, 30]);
  assert.deepEqual(spread(1, 10, 30), [20]);
  assert.deepEqual(spread(0, 0, 1), []);
});

test("rounded-rect perimeter and area", () => {
  const s = rrect(0, 0, 100, 50, 5);
  near(perimeter(s), 2 * 150 - 40 + 2 * Math.PI * 5);
  near(area(s), 5000 - (4 - Math.PI) * 25);
  assert.equal(rrect(0, 0, 10, 4, 99).r, 2, "radius is clamped to half the short side");
});

test("plate hole grid", () => {
  const p = plate({ w: 100, h: 60, holeD: 5, cols: 3, rows: 2, margin: 10 });
  assert.equal(p.cutouts.length, 6);
  assert.deepEqual(p.cutouts.map((c) => c.x).slice(0, 2), [10, 10]);
  assert.deepEqual([...new Set(p.cutouts.map((c) => c.x))], [10, 50, 90]);
});

test("bracket flat pattern uses bend allowance θ·(R + K·t)", () => {
  // 20 × 30 outside flanges, t = 1, R = 1, K = 0.44 → BA = π/2 × 1.44 ≈ 2.2619
  const b = bracket({ a: 20, b: 30, width: 25, t: 1, bendR: 1, k: 0.44 });
  near(b.info.bendAllowance, (Math.PI / 2) * 1.44);
  near(b.info.flatLength, 18 + 28 + (Math.PI / 2) * 1.44);
  assert.equal(b.bends.length, 2);
  near(b.bends[0].x1, 18);
});

test("metrics: cut length, pierces, mass", () => {
  const p = plate({ w: 100, h: 100, holeD: 10, cols: 1, rows: 1, margin: 0 });
  const m = metrics(p, { t: 2, density: 2.7, units: "mm" });
  near(m.cutLength, 400 + Math.PI * 10);
  assert.equal(m.pierces, 2);
  // (10000 − 78.54) mm² × 2 mm = 19842.9 mm³ = 19.843 cm³ × 2.7 g/cm³ ≈ 53.58 g
  near(m.grams, ((10000 - Math.PI * 25) * 2 / 1000) * 2.7, 1e-6);
  const inch = metrics(plate({ w: 1, h: 1 }), { t: 1, density: 1, units: "in" });
  near(inch.grams, 16.387064);
});

test("gap between shapes", () => {
  near(gap(circle(0, 0, 2), circle(5, 0, 2)), 3);
  near(gap(circle(0, 0, 4), circle(3, 0, 4)), -1);
  near(gap(rrect(0, 0, 10, 10), rrect(12, 0, 5, 5)), 2);
});

test("checks flag edge distance, small holes, overlaps, and off-part cutouts", () => {
  const p = panel({ w: 100, h: 50, items: [
    { id: 1, label: "A", type: "round", x: 3, y: 25, d: 4 },   // 1 from the left edge
    { id: 2, label: "B", type: "round", x: 50, y: 25, d: 1 },  // smaller than t
    { id: 3, label: "C", type: "round", x: 52, y: 25, d: 4 },  // overlaps B
    { id: 4, label: "D", type: "rect", x: 99, y: 25, w: 10, h: 10 }, // off the right edge
  ] });
  const msgs = checks(p, { t: 2 });
  const has = (level, text) => msgs.some((m) => m.level === level && m.msg.includes(text));
  assert.ok(has("warn", "A is 1.00 from an edge"));
  assert.ok(has("warn", "B (Ø1.00) is smaller"));
  assert.ok(has("error", "B overlaps C"));
  assert.ok(has("error", "D runs off the edge"));
  assert.deepEqual(checks(plate({ w: 100, h: 60, holeD: 5, cols: 2, rows: 2, margin: 10 }), { t: 2 }), []);
});

test("checks flag holes too close to a bend and unformable flanges", () => {
  const close = bracket({ a: 10, b: 30, width: 20, t: 2, bendR: 2, holeD: 4, holesA: 1, holesB: 0, holeMargin: 5 });
  assert.ok(checks(close, { t: 2 }).some((m) => m.msg.includes("from the bend")));
  const bad = bracket({ a: 3, b: 30, width: 20, t: 2, bendR: 2 });
  assert.ok(checks(bad, { t: 2 }).some((m) => m.level === "error" && m.msg.includes("can't be formed")));
});

test("DXF has the right structure, entities, and units", () => {
  const p = plate({ w: 100, h: 60, r: 5, holeD: 5, cols: 2, rows: 2, margin: 10 });
  const dxf = toDXF(p, "mm");
  const count = (e) => dxf.split("\n").filter((l, i, a) => l === e && a[i - 1] === "0").length;
  assert.ok(dxf.startsWith("0\nSECTION\n2\nHEADER"));
  assert.ok(dxf.trimEnd().endsWith("0\nEOF"));
  assert.equal(count("CIRCLE"), 4);
  assert.equal(count("ARC"), 4);
  assert.equal(count("LINE"), 4);
  assert.match(dxf, /\$INSUNITS\n70\n4\n/);
  assert.match(toDXF(p, "in"), /\$INSUNITS\n70\n1\n/);
  const bent = toDXF(bracket({ a: 20, b: 30, width: 25, t: 1, bendR: 1 }));
  assert.equal(bent.split("\nBEND\n").length - 1, 2, "two lines on the BEND layer");
});

test("SVG export is real-size with one path per contour", () => {
  const svg = toSVG(plate({ w: 100, h: 60, holeD: 5, cols: 2, rows: 1, margin: 10 }), "mm");
  assert.match(svg, /width="100.0000mm" height="60.0000mm"/);
  assert.equal(svg.match(/<path /g).length, 3);
});
