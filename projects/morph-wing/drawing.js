// Geometry for the morphing pictures — pure functions that return point lists, no DOM.
import { naca4, slice } from "./morph.js";

const FOIL = naca4(0.04, 0.4, 0.15, 60);
const CUT_SLAT = 0.13, CUT_FLAP = 0.74;
const PIECES = {
  slat: slice(FOIL, 0, CUT_SLAT),
  main: slice(FOIL, CUT_SLAT, CUT_FLAP),
  flap: slice(FOIL, CUT_FLAP, 1),
};
const SLAT_PIVOT = [CUT_SLAT, 0.06], FLAP_PIVOT = [CUT_FLAP, 0.027];

const rotate = ([x, y], [px, py], deg) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c];
};

// Section pieces in chord units (y up), moved to where the look puts them.
// Slat: swings nose-down and forward, opening a slot. Flap: rotates about its hinge and,
// with Fowler travel, slides aft (adding chord).
export function sectionPieces(look) {
  const s = look.slat, f = look.flap;
  const slat = PIECES.slat.map((p) => {
    const [x, y] = rotate(p, SLAT_PIVOT, 24 * s);
    return [x - 0.028 * s, y - 0.02 * s];
  });
  const gap = Math.min(1, f / 40);
  const flap = PIECES.flap.map((p) => {
    const [x, y] = rotate(p, FLAP_PIVOT, -f);
    return [x + look.fowler + 0.02 * gap, y - 0.018 * gap];
  });
  return { slat, main: PIECES.main, flap };
}

// Linear blend between two looks, for the phase animation.
export function blendLook(a, b, t) {
  const out = {};
  for (const k of ["slat", "flap", "fowler", "chord", "span"]) out[k] = a[k] + (b[k] - a[k]) * t;
  out.rotors = t < 0.5 ? a.rotors : b.rotors;
  out.spin = (a.rotors === "spinning" ? 1 - t : 0) + (b.rotors === "spinning" ? t : 0);
  return out;
}

// Rotor centres for a lift+cruise layout, as fractions: x across the span (−0.5…0.5), row −1 in
// front of the wing and +1 behind it. Half the rotors each side, spread outboard of the fuselage.
export function rotorLayout(count) {
  const perSide = Math.max(1, Math.round(count / 2));
  const cols = Math.ceil(perSide / 2);
  const out = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < perSide; i++) {
      const col = Math.floor(i / 2);
      const x = 0.1 + (0.4 * (col + 0.5)) / cols;
      out.push({ x: side * x, row: i % 2 === 0 ? -1 : 1 });
    }
  }
  return out;
}
