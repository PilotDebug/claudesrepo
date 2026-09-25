import { test } from "node:test";
import assert from "node:assert/strict";
import {
  designFor, liftCoefficient, naca4, nacaCode, parseNaca, reynolds, shapeStats, thickness, thinAirfoil,
} from "./airfoil.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test("parse and format NACA codes", () => {
  assert.deepEqual(parseNaca("2412"), { m: 0.02, p: 0.4, t: 0.12, code: "2412" });
  assert.deepEqual(parseNaca("NACA 0012"), { m: 0, p: 0, t: 0.12, code: "0012" });
  assert.equal(parseNaca("2012"), null, "camber without a position is invalid");
  assert.equal(parseNaca("24120"), null);
  assert.equal(nacaCode({ m: 0.04, p: 0.4, t: 0.15 }), "4415");
  assert.equal(nacaCode({ m: 0, p: 0, t: 0.09 }), "0009");
});

test("thickness distribution: closed trailing edge, 12% max near 30% chord", () => {
  near(thickness(1, 0.12), 0, 1e-12);
  const s = shapeStats(parseNaca("0012"));
  near(s.maxThickness, 0.12, 0.001);
  near(s.maxThicknessAt, 0.30, 0.01);
});

test("geometry: symmetric section mirrors, surfaces meet at both ends", () => {
  const { upper, lower } = naca4(parseNaca("0012"), 60);
  upper.forEach(([x, y], i) => { near(lower[i][0], x, 1e-12); near(lower[i][1], -y, 1e-12); });
  near(upper[0][0], 0, 1e-12); near(upper.at(-1)[0], 1, 1e-9);
  near(upper.at(-1)[1], lower.at(-1)[1], 1e-9);
});

test("thin-airfoil theory matches textbook values", () => {
  const sym = thinAirfoil(parseNaca("0012"));
  near(sym.alphaL0, 0, 1e-9);
  near(sym.cmc4, 0, 1e-9);
  // NACA 2412: α_L0 ≈ −2.08°, Cm_c/4 ≈ −0.053 (Anderson, Fundamentals of Aerodynamics)
  const s = thinAirfoil(parseNaca("2412"));
  near(s.alphaL0, -2.08, 0.02);
  near(s.cmc4, -0.053, 0.002);
  near(liftCoefficient(0, 0), 0, 1e-12);
  near(liftCoefficient(5, 0), 2 * Math.PI * (5 * Math.PI / 180), 1e-12);
});

test("Reynolds number", () => {
  // 100 kt, 60 in chord at sea level ≈ 5.4 million
  near(reynolds(100, 60) / 1e6, 5.37, 0.02);
});

test("inverse design finds the camber for a target Cl", () => {
  // NACA 2412 at 2°: Cl = 2π × (2 + 2.08)° ≈ 0.447
  const d = designFor({ targetCl: 0.45, alphaDeg: 2, p: 0.4, t: 0.12 });
  assert.equal(d.code, "2412");
  near(d.clAtAlpha, 0.45, 0.01);
  // Codes only allow whole-percent camber: 0.5 needs ~2.4 %, which rounds to 2412
  const r = designFor({ targetCl: 0.5, alphaDeg: 2, p: 0.4, t: 0.12 });
  near(r.exactCamber, 0.024, 0.001);
  assert.equal(r.code, "2412");
  assert.equal(d.clamped, false);
  const flat = designFor({ targetCl: 0, alphaDeg: 0, p: 0.4, t: 0.12 });
  assert.equal(flat.code, "0012");
  assert.equal(designFor({ targetCl: 3, alphaDeg: 0, p: 0.4, t: 0.12 }).clamped, true);
});
