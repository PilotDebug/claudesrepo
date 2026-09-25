// Morph Wing — pure maths, no DOM. Imperial units in and out (lb, ft², ft, hp, kt, fpm);
// internally slugs, ft/s and ft·lb/s. Everything here is a textbook rule of thumb.

export const G = 32.174;          // ft/s²
export const KT = 1.68781;        // ft/s per knot
export const HP = 550;            // ft·lb/s per horsepower
const RHO0 = 0.0023769;           // slug/ft³, ISA sea level

export const PHASES = ["takeoff", "climb", "cruise", "landing"];
export const CONCEPTS = ["fixed", "slats", "area", "vtol"];

// Deliberately round placeholder numbers: a generic ~180 hp four-seat taildragger.
// They are NOT any real aircraft's figures. Replace them with your own.
export const DEFAULT_PLANE = {
  weight: 2500,        // gross weight, lb
  wingArea: 180,       // ft²
  span: 34,            // ft
  power: 180,          // hp at sea level
  propEff: 0.8,        // cruise propeller efficiency
  cd0: 0.03,           // parasite drag coefficient on the reference wing area
  oswald: 0.75,        // span efficiency
  clmaxClean: 1.4,
  clmaxFlaps: 1.9,     // full flaps
  wingDragShare: 0.4,  // share of parasite drag that is the wing itself (scales with wing area)
};

export const DEFAULT_KNOBS = {
  slats: { dCl: 0.6, weight: 30, dragPct: 3 },
  area: { cruiseArea: 65, cruiseSpan: 100, weight: 120 },
  vtol: { wingArea: 60, rotors: 6, rotorDia: 6, fm: 0.7, liftWeight: 250, hoverSec: 90, whPerKg: 200, dragPct: 12 },
};

// ---------- atmosphere ----------

export function isa(altFt) {
  const h = Math.min(Math.max(altFt, 0), 36089);
  const t = 518.67 - 0.00356616 * h;
  const rho = RHO0 * (t / 518.67) ** 4.2559;
  return { rho, sigma: rho / RHO0 };
}

// Normally aspirated piston power lapse (Gagg–Ferrar).
export const powerLapse = (sigma) => Math.max(0, 1.132 * sigma - 0.132);

// ---------- point performance ----------

// cfg: { weight, area, span, flatPlate (ft² of parasite drag), clmax, oswald }

export const stallFps = (cfg, rho) => Math.sqrt((2 * cfg.weight) / (rho * cfg.area * cfg.clmax));
export const stallKt = (cfg, rho) => stallFps(cfg, rho) / KT;

// Parasite (q·f) plus induced drag. Induced drag depends on span, not area: W² / (q π e b²).
export function dragLb(cfg, vFps, rho) {
  const q = 0.5 * rho * vFps * vFps;
  return q * cfg.flatPlate + (cfg.weight * cfg.weight) / (q * Math.PI * cfg.oswald * cfg.span * cfg.span);
}
export const powerRequiredHp = (cfg, vFps, rho) => (dragLb(cfg, vFps, rho) * vFps) / HP;

export const powerAvailableHp = (plane, sigma, frac = 1) => plane.power * powerLapse(sigma) * plane.propEff * frac;

// Minimum power required at or above 1.1 Vs (you can't fly the bottom of the curve if it's below stall).
export function minPower(cfg, rho) {
  const lo = 1.1 * stallFps(cfg, rho);
  let best = { v: lo, p: powerRequiredHp(cfg, lo, rho) };
  for (let i = 1; i <= 400; i++) {
    const v = lo + i * 0.5;
    const p = powerRequiredHp(cfg, v, rho);
    if (p < best.p) best = { v, p };
  }
  return best;
}

// Level-flight top speed for a power setting: where power required meets power available.
export function levelSpeedKt(cfg, plane, altFt, frac = 1) {
  const { rho, sigma } = isa(altFt);
  const pa = powerAvailableHp(plane, sigma, frac);
  const m = minPower(cfg, rho);
  if (m.p > pa) return null;
  let lo = m.v, hi = 450 * KT;
  if (powerRequiredHp(cfg, hi, rho) < pa) return hi / KT;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (powerRequiredHp(cfg, mid, rho) < pa) lo = mid; else hi = mid;
  }
  return lo / KT;
}

export function climbFpm(cfg, plane, altFt) {
  const { rho, sigma } = isa(altFt);
  return ((powerAvailableHp(plane, sigma) - minPower(cfg, rho).p) * HP * 60) / cfg.weight;
}

// Service ceiling: where the best climb rate falls to 100 fpm.
export function ceilingFt(cfg, plane) {
  if (climbFpm(cfg, plane, 0) < 100) return 0;
  if (climbFpm(cfg, plane, 36000) >= 100) return 36000;
  let lo = 0, hi = 36000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (climbFpm(cfg, plane, mid) >= 100) lo = mid; else hi = mid;
  }
  return lo;
}

// Ground roll with forces evaluated at 0.7 V_LOF (classic average-acceleration method).
// Takeoff propeller efficiency is taken as 0.5: props are poor at low speed.
export function takeoffRollFt(cfg, plane, elevFt, mu = 0.04) {
  const { rho, sigma } = isa(elevFt);
  const vlof = 1.1 * stallFps(cfg, rho);
  const v = 0.7 * vlof;
  const thrust = (0.5 * plane.power * powerLapse(sigma) * HP) / v;
  const q = 0.5 * rho * v * v, clRoll = 0.4;
  const drag = q * cfg.flatPlate + (q * cfg.area * clRoll * clRoll * cfg.area) / (Math.PI * cfg.oswald * cfg.span * cfg.span);
  const friction = mu * Math.max(0, cfg.weight - q * cfg.area * clRoll);
  const accel = (G * (thrust - drag - friction)) / cfg.weight;
  return accel > 0 ? (vlof * vlof) / (2 * accel) : Infinity;
}

// Braking roll from 1.15 Vs touchdown with an average braking friction of 0.3.
export function landingRollFt(cfg, elevFt, muBrake = 0.3) {
  const v = 1.15 * stallFps(cfg, isa(elevFt).rho);
  return (v * v) / (2 * G * muBrake);
}

// Momentum-theory hover power for the whole lift system, divided by figure of merit.
export function hoverPowerHp(weight, diskAreaFt2, rho, fm) {
  return weight ** 1.5 / Math.sqrt(2 * rho * diskAreaFt2) / fm / HP;
}

// ---------- concepts ----------

const flatPlate = (plane, area, extraPct = 0) =>
  plane.cd0 * plane.wingArea * (1 - plane.wingDragShare + plane.wingDragShare * (area / plane.wingArea)) * (1 + extraPct / 100);

// Lift+cruise VTOL: the battery for the hover segments adds weight, which needs more hover power,
// which needs more battery. Iterate until it settles (or reports that it runs away).
export function vtolSizing(plane, k, elevFt) {
  const rho = isa(elevFt).rho;
  const disk = k.rotors * Math.PI * (k.rotorDia / 2) ** 2;
  let battery = 0, hp = 0;
  for (let i = 0; i < 60; i++) {
    const weight = plane.weight + k.liftWeight + battery;
    hp = hoverPowerHp(weight, disk, rho, k.fm);
    // Two hover segments; 90 % motor efficiency; use 80 % of the pack.
    const wh = (hp * 745.7 * 2 * k.hoverSec) / 3600 / 0.9 / 0.8;
    const next = (wh / k.whPerKg) * 2.20462;
    if (!Number.isFinite(next) || next > 20 * plane.weight) return { converged: false, battery: Infinity, hoverHp: Infinity, disk, kwh: Infinity };
    if (Math.abs(next - battery) < 0.01) { battery = next; break; }
    battery = next;
  }
  const weight = plane.weight + k.liftWeight + battery;
  hp = hoverPowerHp(weight, disk, rho, k.fm);
  return { converged: true, battery, hoverHp: hp, disk, kwh: (hp * 745.7 * 2 * k.hoverSec) / 3.6e6 / 0.9 / 0.8, diskLoading: weight / disk };
}

// The wing's state for one concept in one phase: aerodynamics plus what the drawing needs.
// look: slat 0–1 (deployed), flap degrees, fowler (chord fractions of aft travel),
//       chord and span relative to the baseline wing, rotors (null, "stowed" or "spinning").
export function configFor(concept, phase, plane, knobs, elevFt = 0) {
  const base = { weight: plane.weight, area: plane.wingArea, span: plane.span, oswald: plane.oswald };
  const clmaxTO = (plane.clmaxClean + plane.clmaxFlaps) / 2;
  const flapClmax = { takeoff: clmaxTO, climb: plane.clmaxClean, cruise: plane.clmaxClean, landing: plane.clmaxFlaps };
  const flapDeg = { takeoff: 15, climb: 0, cruise: 0, landing: 40 };
  const look = { slat: 0, flap: flapDeg[phase], fowler: 0, chord: 1, span: 1, rotors: null };

  if (concept === "fixed") {
    return { ...base, flatPlate: flatPlate(plane, base.area), clmax: flapClmax[phase], extraWeight: 0, look };
  }
  if (concept === "slats") {
    const k = knobs.slats, out = phase === "takeoff" || phase === "landing";
    const weight = plane.weight + k.weight;
    return {
      ...base, weight, extraWeight: k.weight,
      flatPlate: flatPlate(plane, base.area, k.dragPct),
      clmax: flapClmax[phase] + (out ? k.dCl : 0),
      look: { ...look, slat: out ? 1 : 0 },
    };
  }
  if (concept === "area") {
    // Full wing (baseline size) for takeoff, climb and landing; shrinks for cruise.
    const k = knobs.area, small = phase === "cruise";
    const area = small ? (plane.wingArea * k.cruiseArea) / 100 : plane.wingArea;
    const span = small ? (plane.span * k.cruiseSpan) / 100 : plane.span;
    return {
      ...base, weight: plane.weight + k.weight, extraWeight: k.weight, area, span,
      flatPlate: flatPlate(plane, area), clmax: flapClmax[phase],
      look: { ...look, chord: (area / span) / (plane.wingArea / plane.span), span: span / plane.span, fowler: phase === "landing" ? 0.12 : 0 },
    };
  }
  if (concept === "vtol") {
    // A smaller, clean wing (no runway to size it for) plus a lift-rotor system carried everywhere.
    const k = knobs.vtol, sz = vtolSizing(plane, k, elevFt);
    const ratio = k.wingArea / 100, area = plane.wingArea * ratio, span = plane.span * Math.sqrt(ratio);
    const extraWeight = k.liftWeight + sz.battery;
    const hover = phase === "takeoff" || phase === "landing";
    return {
      ...base, weight: plane.weight + extraWeight, extraWeight, area, span,
      flatPlate: flatPlate(plane, area, k.dragPct), clmax: plane.clmaxClean, sizing: sz,
      look: { ...look, flap: 0, chord: Math.sqrt(ratio), span: Math.sqrt(ratio), rotors: hover ? "spinning" : "stowed" },
    };
  }
  throw new Error(`Unknown concept ${concept}`);
}

// Headline numbers for one concept.
export function evaluate(concept, plane, knobs, { cruiseAlt = 8000, fieldElev = 0 } = {}) {
  const c = (phase) => configFor(concept, phase, plane, knobs, fieldElev);
  const to = c("takeoff"), climb = c("climb"), cruise = c("cruise"), land = c("landing");
  const rhoField = isa(fieldElev).rho;
  const vtol = concept === "vtol";
  return {
    concept,
    extraWeight: cruise.extraWeight,
    stallKt: stallKt(land, rhoField),
    liftoffKt: vtol ? 0 : 1.1 * stallKt(to, rhoField),
    takeoffFt: vtol ? 0 : takeoffRollFt(to, plane, fieldElev),
    landingFt: vtol ? 0 : landingRollFt(land, fieldElev),
    climbFpm: climbFpm(climb, plane, fieldElev),
    // In flight you'd pick whichever shape climbs better, so the ceiling is the best of the two.
    ceilingFt: Math.max(ceilingFt(climb, plane), ceilingFt(cruise, plane)),
    topKt: levelSpeedKt(cruise, plane, cruiseAlt, 1),
    cruiseKt: levelSpeedKt(cruise, plane, cruiseAlt, 0.75),
    hoverHp: vtol ? cruise.sizing.hoverHp : null,
    batteryLb: vtol ? cruise.sizing.battery : null,
    diskLoading: vtol ? cruise.sizing.diskLoading : null,
    cruiseWingLoading: cruise.weight / cruise.area,
    landWingLoading: land.weight / land.area,
  };
}

// Power-required curve for plotting: [{ kt, hp }].
export function powerCurve(cfg, altFt, fromKt = 40, toKt = 240, step = 2) {
  const { rho } = isa(altFt);
  const out = [];
  const vs = stallKt(cfg, rho);
  for (let kt = Math.max(fromKt, Math.ceil(vs)); kt <= toKt; kt += step) {
    out.push({ kt, hp: powerRequiredHp(cfg, kt * KT, rho) });
  }
  return out;
}

// ---------- section drawing ----------

// NACA 4-digit coordinates in chord units (y up): upper and lower surfaces from LE to TE.
export function naca4(m, p, t, n = 60) {
  const upper = [], lower = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos((Math.PI * i) / n)) / 2;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
    const dy = x < p ? ((2 * m) / (p * p)) * (p - x) : ((2 * m) / (1 - p) ** 2) * (p - x);
    const th = Math.atan(dy);
    upper.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lower.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }
  return { upper, lower };
}

// Cut a section into a closed polygon for chord range [x0, x1].
export function slice(foil, x0, x1) {
  const inRange = ([x]) => x >= x0 && x <= x1;
  const up = foil.upper.filter(inRange), low = foil.lower.filter(inRange);
  return [...up, ...low.reverse()];
}
