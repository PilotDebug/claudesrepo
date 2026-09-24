import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compass, densityAltitude, isaTemp, pressureAltitude, runwayHeading, signedAngle,
  windComponents, windTriangle,
} from "./e6b.js";

const near = (actual, expected, tol = 0.1) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} not within ${tol} of ${expected}`);

test("angle helpers", () => {
  assert.equal(signedAngle(350), -10);
  assert.equal(signedAngle(-190), 170);
  assert.equal(compass(0), 360);
  assert.equal(compass(-12), 348);
});

test("runway numbers and headings", () => {
  assert.equal(runwayHeading("27"), 270);
  assert.equal(runwayHeading("09L"), 90);
  assert.equal(runwayHeading("135"), 135);
  assert.equal(runwayHeading("abc"), null);
});

test("crosswind: 300@20 on runway 27", () => {
  const w = windComponents(270, 300, 20);
  near(w.headwind, 17.3);
  near(w.crosswind, 10);
  assert.equal(w.side, "right");
});

test("crosswind: tailwind from the left", () => {
  const w = windComponents(90, 300, 10); // from behind-left of an eastbound runway
  assert.ok(w.headwind < 0);
  assert.equal(w.side, "left");
});

test("pressure and density altitude", () => {
  near(pressureAltitude(1000, 30.12), 800);
  near(isaTemp(0), 15);
  // 5000 ft PA at 30 °C: ISA is ~5 °C, so DA ≈ 5000 + 120 × 25 ≈ 8000 ft.
  near(densityAltitude(5000, 30), 8000, 20);
});

test("wind triangle: north wind on an eastbound course", () => {
  const r = windTriangle(90, 100, 360, 20);
  near(r.wca, -11.5);
  assert.equal(r.heading, 78);
  near(r.groundSpeed, 98);
});

test("wind triangle: impossible when wind exceeds airspeed", () => {
  assert.equal(windTriangle(90, 30, 360, 40), null);
});
