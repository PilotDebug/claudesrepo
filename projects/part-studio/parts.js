// Part Studio geometry. Pure functions, unit-agnostic: every length is in the part's
// units (mm or in). Y points up, like CAD and DXF; the UI flips it for the screen.
//
// A part is { outline, cutouts, bends, info }:
//   outline  — { kind: "rrect", x, y, w, h, r }  (x, y = lower-left corner)
//   cutouts  — circles { kind: "circle", x, y, d } (x, y = centre) and rrects
//   bends    — lines { x1, y1, x2, y2 } (bend lines / bend-zone edges, not cut)

export const MATERIALS = {
  "Aluminium 6061": 2.70,
  "Mild steel": 7.85,
  "Stainless 304": 8.00,
  "Acrylic": 1.19,
  "Birch plywood": 0.68,
};

const PI = Math.PI;

export function rrect(x, y, w, h, r = 0) {
  return { kind: "rrect", x, y, w, h, r: Math.max(0, Math.min(r, w / 2, h / 2)) };
}
export const circle = (x, y, d) => ({ kind: "circle", x, y, d });

/** Evenly spaced positions from a to b (a single item sits in the middle). */
export function spread(n, a, b) {
  if (n <= 0) return [];
  if (n === 1) return [(a + b) / 2];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

// ---------- templates ----------

/** Rectangular plate with an evenly spaced grid of holes. */
export function plate({ w, h, r = 0, holeD = 0, cols = 0, rows = 0, margin = 0 }) {
  const cutouts = [];
  if (holeD > 0) {
    for (const x of spread(cols, margin, w - margin)) {
      for (const y of spread(rows, margin, h - margin)) cutouts.push(circle(x, y, holeD));
    }
  }
  return { outline: rrect(0, 0, w, h, r), cutouts, bends: [], info: {} };
}

/**
 * 90° angle bracket, as the flat pattern to cut before bending.
 * a, b: outside flange lengths; t: thickness; bendR: inside bend radius; k: K-factor.
 * Bend allowance BA = θ·(R + K·t), with θ = π/2; each flat leg = flange − (R + t).
 */
export function bracket({ a, b, width, t, bendR, k = 0.44, holeD = 0, holesA = 0, holesB = 0, holeMargin = 0 }) {
  const setback = bendR + t;
  const legA = a - setback;
  const legB = b - setback;
  const ba = (PI / 2) * (bendR + k * t);
  const length = legA + ba + legB;
  const cutouts = [];
  if (holeD > 0) {
    for (const y of spread(holesA, holeMargin, width - holeMargin)) cutouts.push(circle(legA / 2, y, holeD));
    for (const y of spread(holesB, holeMargin, width - holeMargin)) cutouts.push(circle(legA + ba + legB / 2, y, holeD));
  }
  return {
    outline: rrect(0, 0, length, width, 0),
    cutouts,
    bends: [
      { x1: legA, y1: 0, x2: legA, y2: width },
      { x1: legA + ba, y1: 0, x2: legA + ba, y2: width },
    ],
    info: { bendAllowance: ba, flatLength: length, legA, legB, bendZone: [legA, legA + ba], t, bendR },
  };
}

/** Panel with free-placed cutouts: round { x, y, d } or rect { x, y, w, h, r } (x, y = centre). */
export function panel({ w, h, r = 0, items = [] }) {
  const cutouts = items.map((it) => it.type === "rect"
    ? { ...rrect(it.x - it.w / 2, it.y - it.h / 2, it.w, it.h, it.r || 0), id: it.id, label: it.label }
    : { ...circle(it.x, it.y, it.d), id: it.id, label: it.label });
  return { outline: rrect(0, 0, w, h, r), cutouts, bends: [], info: {} };
}

// ---------- measurements ----------

export function perimeter(s) {
  return s.kind === "circle" ? PI * s.d : 2 * (s.w + s.h) - 8 * s.r + 2 * PI * s.r;
}
export function area(s) {
  return s.kind === "circle" ? (PI * s.d * s.d) / 4 : s.w * s.h - (4 - PI) * s.r * s.r;
}
export function bounds(s) {
  return s.kind === "circle"
    ? { x0: s.x - s.d / 2, y0: s.y - s.d / 2, x1: s.x + s.d / 2, y1: s.y + s.d / 2 }
    : { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h };
}

const CM3_PER_UNIT3 = { mm: 0.001, in: 16.387064 };

/** Cut length, pierce count, net area, and mass for a given thickness and density (g/cm³). */
export function metrics(part, { t, density, units = "mm" }) {
  const cutLength = perimeter(part.outline) + part.cutouts.reduce((s, c) => s + perimeter(c), 0);
  const netArea = area(part.outline) - part.cutouts.reduce((s, c) => s + area(c), 0);
  const grams = netArea * t * CM3_PER_UNIT3[units] * density;
  return { cutLength, pierces: part.cutouts.length + 1, netArea, grams, width: part.outline.w, height: part.outline.h };
}

// ---------- manufacturability checks (rules of thumb, not guarantees) ----------

/** Gap between two shapes' edges (negative = overlap). Exact for circle pairs, box-based otherwise. */
export function gap(a, b) {
  if (a.kind === "circle" && b.kind === "circle") return Math.hypot(a.x - b.x, a.y - b.y) - (a.d + b.d) / 2;
  const A = bounds(a), B = bounds(b);
  const dx = Math.max(B.x0 - A.x1, A.x0 - B.x1);
  const dy = Math.max(B.y0 - A.y1, A.y0 - B.y1);
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
  return Math.max(dx, dy);
}

const nameOf = (c, i) => c.label || `${c.kind === "circle" ? "Hole" : "Cutout"} ${i + 1}`;

/**
 * Laser/waterjet rules of thumb, scaled by material thickness t:
 * holes at least t in diameter, and at least t of material between any cutout and an edge
 * or another cutout. Near bends, keep holes 2t + R clear of the bend zone to avoid distortion.
 */
export function checks(part, { t, fmt = (n) => n.toFixed(2) }) {
  const out = [];
  const o = bounds(part.outline);
  part.cutouts.forEach((c, i) => {
    const name = nameOf(c, i);
    const b = bounds(c);
    const edge = Math.min(b.x0 - o.x0, b.y0 - o.y0, o.x1 - b.x1, o.y1 - b.y1);
    if (edge < 0) out.push({ level: "error", at: [i], msg: `${name} runs off the edge of the part.` });
    else if (edge < t) out.push({ level: "warn", at: [i], msg: `${name} is ${fmt(edge)} from an edge — leave at least ${fmt(t)} (1× thickness).` });
    if (c.kind === "circle" && c.d < t) {
      out.push({ level: "warn", at: [i], msg: `${name} (Ø${fmt(c.d)}) is smaller than the material thickness — it may not cut cleanly.` });
    }
    for (let j = i + 1; j < part.cutouts.length; j++) {
      const g = gap(c, part.cutouts[j]);
      const other = nameOf(part.cutouts[j], j);
      if (g < 0) out.push({ level: "error", at: [i, j], msg: `${name} overlaps ${other}.` });
      else if (g < t) out.push({ level: "warn", at: [i, j], msg: `Only ${fmt(g)} between ${name} and ${other} — leave at least ${fmt(t)}.` });
    }
    if (part.info.bendZone) {
      const [z0, z1] = part.info.bendZone;
      const clear = 2 * part.info.t + part.info.bendR;
      const d = Math.max(z0 - b.x1, b.x0 - z1);
      if (d < clear) out.push({ level: "warn", at: [i], msg: `${name} is ${fmt(Math.max(0, d))} from the bend — keep ${fmt(clear)} (2t + R) or it may distort.` });
    }
  });
  if (part.info.legA !== undefined && (part.info.legA <= 0 || part.info.legB <= 0)) {
    out.push({ level: "error", at: [], msg: "A flange is shorter than the bend radius plus thickness — it can't be formed." });
  }
  return out;
}

// ---------- exports ----------

const n4 = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(4);

/** Line/arc segments of a rounded rectangle, counter-clockwise from the bottom edge. */
function rrectSegments({ x, y, w, h, r }) {
  const segs = [
    { line: [x + r, y, x + w - r, y] }, { line: [x + w, y + r, x + w, y + h - r] },
    { line: [x + w - r, y + h, x + r, y + h] }, { line: [x, y + h - r, x, y + r] },
  ].filter(({ line: [a, b, c, d] }) => Math.hypot(c - a, d - b) > 1e-9);
  if (r > 0) {
    segs.push(
      { arc: [x + r, y + r, r, 180, 270] }, { arc: [x + w - r, y + r, r, 270, 360] },
      { arc: [x + w - r, y + h - r, r, 0, 90] }, { arc: [x + r, y + h - r, r, 90, 180] },
    );
  }
  return segs;
}

/** ASCII DXF (R12 entities) — CUT layer for contours, BEND layer for bend lines. */
export function toDXF(part, units = "mm") {
  const L = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009",
    "9", "$INSUNITS", "70", units === "in" ? "1" : "4", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES"];
  const line = (layer, x1, y1, x2, y2) => L.push("0", "LINE", "8", layer, "10", n4(x1), "20", n4(y1), "30", "0", "11", n4(x2), "21", n4(y2), "31", "0");
  const shape = (s) => {
    if (s.kind === "circle") { L.push("0", "CIRCLE", "8", "CUT", "10", n4(s.x), "20", n4(s.y), "30", "0", "40", n4(s.d / 2)); return; }
    for (const seg of rrectSegments(s)) {
      if (seg.line) line("CUT", ...seg.line);
      else { const [cx, cy, r, a0, a1] = seg.arc; L.push("0", "ARC", "8", "CUT", "10", n4(cx), "20", n4(cy), "30", "0", "40", n4(r), "50", n4(a0), "51", n4(a1)); }
    }
  };
  shape(part.outline);
  part.cutouts.forEach(shape);
  for (const b of part.bends) line("BEND", b.x1, b.y1, b.x2, b.y2);
  L.push("0", "ENDSEC", "0", "EOF");
  return L.join("\n") + "\n";
}

/** SVG path data for a shape, in part coordinates flipped so +y is up on screen. */
export function pathData(s, H) {
  const Y = (y) => n4(H - y);
  if (s.kind === "circle") {
    const r = s.d / 2;
    return `M${n4(s.x - r)} ${Y(s.y)}a${n4(r)} ${n4(r)} 0 1 0 ${n4(2 * r)} 0a${n4(r)} ${n4(r)} 0 1 0 ${n4(-2 * r)} 0Z`;
  }
  const { x, y, w, h, r } = s;
  const arc = (dx, dy) => (r > 0 ? `a${n4(r)} ${n4(r)} 0 0 0 ${n4(dx)} ${n4(dy)}` : "");
  return `M${n4(x + r)} ${Y(y)}H${n4(x + w - r)}${arc(r, -r)}V${Y(y + h - r)}${arc(-r, -r)}H${n4(x + r)}${arc(-r, r)}V${Y(y + r)}${arc(r, r)}Z`;
}

/** Standalone SVG for laser software: real-world size, cut paths as hairlines. */
export function toSVG(part, units = "mm") {
  const { w, h } = part.outline;
  const paths = [part.outline, ...part.cutouts].map((s) => `<path d="${pathData(s, h)}"/>`).join("");
  const bends = part.bends.map((b) => `<line x1="${n4(b.x1)}" y1="${n4(h - b.y1)}" x2="${n4(b.x2)}" y2="${n4(h - b.y2)}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n4(w)}${units}" height="${n4(h)}${units}" viewBox="0 0 ${n4(w)} ${n4(h)}">` +
    `<g fill="none" stroke="#ff0000" stroke-width="0.01" fill-rule="evenodd">${paths}</g>` +
    (bends ? `<g stroke="#0000ff" stroke-width="0.01" stroke-dasharray="1 1">${bends}</g>` : "") + `</svg>`;
}
