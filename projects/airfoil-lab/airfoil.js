// Airfoil maths: NACA 4-digit geometry and thin-airfoil theory.
// Chord-normalised coordinates (x from 0 at the leading edge to 1 at the trailing edge).

const PI = Math.PI;
const deg = (r) => (r * 180) / PI;
const rad = (d) => (d * PI) / 180;

/** "2412" → { m: 0.02, p: 0.4, t: 0.12 }. Returns null for anything that isn't 4 digits. */
export function parseNaca(code) {
  const s = String(code).trim().replace(/^naca\s*/i, "");
  if (!/^\d{4}$/.test(s)) return null;
  const m = +s[0] / 100, p = +s[1] / 10, t = +s.slice(2) / 100;
  if (t <= 0 || (m > 0 && p === 0)) return null;
  return { m, p, t, code: s };
}

/** Code for a section, e.g. { m: .04, p: .4, t: .15 } → "4415". */
export const nacaCode = ({ m, p, t }) =>
  `${Math.round(m * 100)}${Math.round(p * 10)}${String(Math.round(t * 100)).padStart(2, "0")}`;

export function camber(x, { m, p }) {
  if (m === 0) return { yc: 0, dyc: 0 };
  if (x < p) return { yc: (m / (p * p)) * (2 * p * x - x * x), dyc: ((2 * m) / (p * p)) * (p - x) };
  const q = (1 - p) * (1 - p);
  return { yc: (m / q) * (1 - 2 * p + 2 * p * x - x * x), dyc: ((2 * m) / q) * (p - x) };
}

/** Half-thickness with the closed-trailing-edge coefficient (−0.1036). */
export const thickness = (x, t) =>
  5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4);

/** Surface coordinates with cosine spacing (dense at the leading and trailing edges). */
export function naca4(section, n = 80) {
  const upper = [], lower = [], line = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos((PI * i) / n)) / 2;
    const { yc, dyc } = camber(x, section);
    const yt = thickness(x, section.t);
    const th = Math.atan(dyc);
    upper.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lower.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
    line.push([x, yc]);
  }
  return { upper, lower, camberLine: line };
}

/**
 * Thin-airfoil theory (Glauert): zero-lift angle and quarter-chord moment, by
 * integrating the camber slope over θ where x = (1 − cos θ) / 2.
 *   α_L0 = −(1/π) ∫ dyc/dx (cos θ − 1) dθ
 *   A_n  =  (2/π) ∫ dyc/dx cos(nθ) dθ,   Cm_c/4 = (π/4)(A2 − A1)
 */
export function thinAirfoil(section, steps = 2000) {
  let aL0 = 0, A1 = 0, A2 = 0;
  const h = PI / steps;
  for (let i = 0; i < steps; i++) {
    const th = (i + 0.5) * h; // midpoint rule
    const { dyc } = camber((1 - Math.cos(th)) / 2, section);
    aL0 += dyc * (Math.cos(th) - 1) * h;
    A1 += dyc * Math.cos(th) * h;
    A2 += dyc * Math.cos(2 * th) * h;
  }
  const alphaL0 = deg(-aL0 / PI);
  return { alphaL0, cmc4: (PI / 4) * ((2 / PI) * A2 - (2 / PI) * A1), slopePerDeg: (2 * PI * PI) / 180 };
}

/** Lift coefficient from thin-airfoil theory: Cl = 2π (α − α_L0). Linear — no stall. */
export const liftCoefficient = (alphaDeg, alphaL0) => 2 * PI * rad(alphaDeg - alphaL0);

/** Where the section is thickest, and where the camber peaks (fractions of chord). */
export function shapeStats(section, n = 400) {
  let best = { t: 0, x: 0 };
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const tt = 2 * thickness(x, section.t);
    if (tt > best.t) best = { t: tt, x };
  }
  return { maxThickness: best.t, maxThicknessAt: best.x, maxCamber: section.m, maxCamberAt: section.m ? section.p : null };
}

/** Standard sea-level kinematic viscosity of air, m²/s. */
export const NU_SEA_LEVEL = 1.46e-5;

/** Reynolds number from airspeed in knots and chord in inches. */
export function reynolds(knots, chordInches, nu = NU_SEA_LEVEL) {
  return (knots * 0.514444 * chordInches * 0.0254) / nu;
}

/**
 * Inverse design: the camber m that gives targetCl at alphaDeg for a given camber
 * position p. α_L0 is linear in m, so solve directly; clamp to NACA 4-digit's 0–9 %.
 */
export function designFor({ targetCl, alphaDeg, p, t }) {
  const perUnitM = thinAirfoil({ m: 0.01, p, t }).alphaL0 / 0.01; // α_L0 per unit camber (deg)
  const needed = alphaDeg - deg(targetCl / (2 * PI)); // required α_L0
  const exact = needed / perUnitM;
  const m = Math.min(0.09, Math.max(0, Math.round(exact * 100) / 100));
  const section = { m, p: m === 0 ? 0 : p, t };
  const { alphaL0 } = thinAirfoil(section);
  return { section, code: nacaCode(section), exactCamber: exact, clAtAlpha: liftCoefficient(alphaDeg, alphaL0), clamped: exact < 0 || exact > 0.09 };
}
