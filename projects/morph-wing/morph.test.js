import test from "node:test";
import assert from "node:assert/strict";
import {
  CONCEPTS, DEFAULT_KNOBS, DEFAULT_PLANE, KT, ceilingFt, climbFpm, configFor, dragLb, evaluate,
  hoverPowerHp, isa, landingRollFt, levelSpeedKt, naca4, powerAvailableHp, powerRequiredHp, stallKt, vtolSizing,
} from "./morph.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} ± ${tol}, got ${a}`);

test("ISA density matches the standard table", () => {
  near(isa(0).rho, 0.0023769, 1e-7);
  near(isa(10000).rho, 0.0017556, 2e-6);   // table: 0.0017556 slug/ft³
  near(isa(5000).sigma, 0.8617, 0.001);
});

test("stall speed: 2500 lb, 180 ft², CLmax 1.9 at sea level is 46.5 kt", () => {
  // Vs = √(2·2500 / (0.0023769·180·1.9)) = 78.43 ft/s = 46.47 kt
  near(stallKt({ weight: 2500, area: 180, clmax: 1.9 }, isa(0).rho), 46.47, 0.02);
});

test("drag = parasite q·f plus induced W²/(q π e b²)", () => {
  // q = ½·0.0023769·100² = 11.8845; 11.8845·5 = 59.42; 2000² / (11.8845·π·0.8·30²) = 148.80
  const cfg = { weight: 2000, flatPlate: 5, oswald: 0.8, span: 30 };
  near(dragLb(cfg, 100, isa(0).rho), 208.22, 0.05);
  near(powerRequiredHp(cfg, 100, isa(0).rho), 20822 / 550, 0.01);
});

test("hover power from momentum theory", () => {
  // P = W^1.5 / √(2ρA) = 31622.8 / 0.68948 = 45 865 ft·lb/s = 83.4 hp at FM 1; FM 0.7 → 119.1 hp
  near(hoverPowerHp(1000, 100, isa(0).rho, 1), 83.39, 0.05);
  near(hoverPowerHp(1000, 100, isa(0).rho, 0.7), 119.13, 0.05);
});

test("top speed is where power required meets power available", () => {
  const cfg = configFor("fixed", "cruise", DEFAULT_PLANE, DEFAULT_KNOBS);
  const v = levelSpeedKt(cfg, DEFAULT_PLANE, 8000);
  const { rho, sigma } = isa(8000);
  near(powerRequiredHp(cfg, v * KT, rho), powerAvailableHp(DEFAULT_PLANE, sigma), 0.01);
  assert.ok(levelSpeedKt(cfg, DEFAULT_PLANE, 8000, 0.75) < v);
});

test("service ceiling is where best climb falls to 100 fpm", () => {
  const cfg = configFor("fixed", "climb", DEFAULT_PLANE, DEFAULT_KNOBS);
  near(climbFpm(cfg, DEFAULT_PLANE, ceilingFt(cfg, DEFAULT_PLANE)), 100, 0.5);
  assert.ok(climbFpm(cfg, DEFAULT_PLANE, 0) > climbFpm(cfg, DEFAULT_PLANE, 8000));
});

test("landing roll from 1.15 Vs with 0.3 braking", () => {
  // v = 1.15·78.43 = 90.19 ft/s; s = 90.19² / (2·32.174·0.3) = 421.4 ft
  near(landingRollFt({ weight: 2500, area: 180, clmax: 1.9 }, 0), 421.4, 0.3);
});

test("slats add CLmax only when out, and landing roll scales with W / CLmax", () => {
  const land = configFor("slats", "landing", DEFAULT_PLANE, DEFAULT_KNOBS);
  const cruise = configFor("slats", "cruise", DEFAULT_PLANE, DEFAULT_KNOBS);
  near(land.clmax, 1.9 + 0.6, 1e-9);
  near(cruise.clmax, 1.4, 1e-9);
  assert.equal(land.look.slat, 1);
  assert.equal(cruise.look.slat, 0);
  const fixed = evaluate("fixed", DEFAULT_PLANE, DEFAULT_KNOBS), slats = evaluate("slats", DEFAULT_PLANE, DEFAULT_KNOBS);
  near(slats.landingFt / fixed.landingFt, (2530 / 2.5) / (2500 / 1.9), 1e-9);
});

test("variable-area wing is full size to land and shrinks to cruise", () => {
  const land = configFor("area", "landing", DEFAULT_PLANE, DEFAULT_KNOBS);
  const cruise = configFor("area", "cruise", DEFAULT_PLANE, DEFAULT_KNOBS);
  assert.equal(land.area, 180);
  near(cruise.area, 117, 1e-9);
  near(cruise.look.chord, 0.65, 1e-9);
  assert.ok(cruise.flatPlate < land.flatPlate);
  // Chord-only shrink: less parasite drag, same span, so it's faster in cruise.
  assert.ok(evaluate("area", DEFAULT_PLANE, DEFAULT_KNOBS).topKt > evaluate("fixed", DEFAULT_PLANE, DEFAULT_KNOBS).topKt);
  // Shrinking the span too costs induced drag, so it's slower than the chord-only shrink.
  const shortSpan = { ...DEFAULT_KNOBS, area: { ...DEFAULT_KNOBS.area, cruiseSpan: 70 } };
  assert.ok(evaluate("area", DEFAULT_PLANE, shortSpan).cruiseKt < evaluate("area", DEFAULT_PLANE, DEFAULT_KNOBS).cruiseKt);
});

test("VTOL battery sizing converges to a self-consistent weight, or reports a runaway", () => {
  const k = DEFAULT_KNOBS.vtol;
  const s = vtolSizing(DEFAULT_PLANE, k, 0);
  assert.ok(s.converged);
  const w = DEFAULT_PLANE.weight + k.liftWeight + s.battery;
  near(s.hoverHp, hoverPowerHp(w, s.disk, isa(0).rho, k.fm), 1e-9);
  const wh = (s.hoverHp * 745.7 * 2 * k.hoverSec) / 3600 / 0.9 / 0.8;
  near(s.battery, (wh / k.whPerKg) * 2.20462, 0.05);
  assert.equal(vtolSizing(DEFAULT_PLANE, { ...k, whPerKg: 1 }, 0).converged, false);
});

test("every concept evaluates to finite headline numbers with defaults", () => {
  for (const c of CONCEPTS) {
    const r = evaluate(c, DEFAULT_PLANE, DEFAULT_KNOBS);
    for (const key of ["stallKt", "takeoffFt", "landingFt", "climbFpm", "ceilingFt", "topKt"]) {
      assert.ok(Number.isFinite(r[key]), `${c}.${key} = ${r[key]}`);
    }
  }
});

test("NACA 4415 section is 15 % thick with a sharp trailing edge", () => {
  const f = naca4(0.04, 0.4, 0.15, 80);
  const thick = Math.max(...f.upper.map(([, y], i) => y - f.lower[i][1]));
  near(thick, 0.15, 0.005);
  near(f.upper[80][1], f.lower[80][1], 0.003);
});
