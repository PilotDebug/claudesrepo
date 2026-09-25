import {
  CONCEPTS, DEFAULT_KNOBS, DEFAULT_PLANE, PHASES, configFor, evaluate, isa, powerAvailableHp, powerCurve,
} from "./morph.js";
import { blendLook, rotorLayout, sectionPieces } from "./drawing.js";

const STORE = "morph-wing";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n, d = 0) => (n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));

const PHASE_NAMES = { takeoff: "Takeoff", climb: "Climb", cruise: "Cruise", landing: "Landing" };

const INFO = {
  fixed: {
    name: "Fixed wing + flaps",
    pitch: "The baseline: one wing, sized as a compromise, with ordinary slotted flaps.",
  },
  slats: {
    name: "Slats + flaps (STOL)",
    pitch: "Leading-edge slats pop out with the flaps, so the wing keeps lifting at a higher angle before it stalls.",
    done: "Handley Page's automatic slats (1920s), the Fieseler Storch, Bf 109 auto-slats, the Helio Courier (auto slats + Fowler flaps), Zenith STOL CH 701 (fixed slats), Just SuperSTOL (auto slats), and every airliner's slat/flap system.",
    failed: "Asymmetric deployment: one slat sticking gives a sharp roll at the stall, which is why airliners interconnect and monitor them (American 191, 1979, stalled a wing after its slats retracted). Fixed slots cost cruise speed; moving ones cost weight and rigging. Very low stall speeds can outrun the tail and ailerons: check elevator authority in the flare.",
    angle: "For a Bearhawk: experimental category makes it buildable. Keep both sides mechanically linked, and watch stiffness and flutter margins on the tracks.",
  },
  area: {
    name: "Variable-area wing",
    pitch: "A big wing to take off and land, which retracts to a small one to cruise faster (Fowler-style chord that tucks away).",
    done: "Fowler flaps (1920s, add area aft). Makhonine MAK-10 telescoping wing (flew 1931) and MAK-123 (1947); Bakshaev RK sliding chord (1937). Variable sweep: Bell X-5, F-111, F-14, Tornado, B-1. NASA/FlexSys seamless flaps on a Gulfstream III (ACTE, 2014–15); variable-camber trailing edges on the 787.",
    failed: "The mechanism's weight and the sliding joint's bending loads eat most of the gain, and seals and tracks jam with ice and dirt. None of the telescoping wings reached production. Variable sweep's heavy pivots (the F-111 lost one to a fatigue-cracked fitting in 1969) fell out of fashion once engines and fly-by-wire made fixed wings good enough.",
    angle: "Try it here: shrinking chord helps speed a little; shrinking span makes things worse. Faster wants less wing, higher wants more span, so they pull opposite ways.",
  },
  vtol: {
    name: "VTOL lift + cruise",
    pitch: "Separate lift rotors for vertical takeoff and landing, and a smaller wing, sized for cruise alone, once it's flying.",
    done: "Harrier and F-35B (jet lift), Bell XV-15, V-22 and AW609 tiltrotors. eVTOL: Beta Alia and Wisk (lift + cruise), Joby and Archer (tilting props). Hobby quadplanes on ArduPilot fly this exact layout today.",
    failed: "Hover takes several times cruise power, and you carry the rotors, motors and batteries the whole way. Kitty Hawk (2022) and Airbus Vahana (2019) shut down; Lilium and Volocopter both went insolvent (2024–25). The V-22 lost crews to vortex ring state in testing, and the Harrier had a high accident rate. The transition between hover and wingborne flight is the hard control problem.",
    angle: "Cheapest proving ground is a drone-scale quadplane: it tests the transition logic without betting an airframe.",
  },
};

const OTHER_IDEAS = [
  ["Variable-camber cruise flap", "Trim the trailing edge a few degrees in cruise to match weight and altitude for best L/D. Airliners do it with flaps (787); FlexFoil did it seamlessly."],
  ["Blown wing", "Many small electric props wash the whole span with fast air, so it lifts at walking speed. NASA X-57's high-lift props; Electra.aero's blown-lift STOL demonstrator."],
  ["Wing warping / adaptive twist", "Twist for a gentle stall at low speed, flatten it for cruise. The Wright Flyer warped; NASA's Active Aeroelastic Wing F/A-18 revived it in 2002–03."],
  ["Folding wings", "Fold to trailer or hangar (Kitfox, SeaRey), or fold tips in flight: the XB-70 drooped its tips at Mach 3; Airbus AlbatrossONE lets them flap freely to shed gusts."],
  ["Feathered drone wing", "Overlapping feathers that sweep and spread like a bird. Stanford's PigeonBot (2020) showed it steers the aircraft."],
  ["Oblique wing", "One wing that pivots as a whole: straight to land, skewed to go fast. NASA's AD-1 flew it in 1979–82."],
];

// ---------- state ----------

let state = load();
function load() {
  const base = { plane: { ...DEFAULT_PLANE }, knobs: structuredClone(DEFAULT_KNOBS), phase: "takeoff", cruiseAlt: 8000, fieldElev: 0 };
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (!s) return base;
    return {
      ...base, ...s,
      plane: { ...base.plane, ...s.plane },
      knobs: Object.fromEntries(Object.entries(base.knobs).map(([k, v]) => [k, { ...v, ...(s.knobs?.[k] ?? {}) }])),
    };
  } catch { return base; }
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ } }

const opts = () => ({ cruiseAlt: state.cruiseAlt, fieldElev: state.fieldElev });
let results = {};
function recompute() {
  results = Object.fromEntries(CONCEPTS.map((c) => [c, evaluate(c, state.plane, state.knobs, opts())]));
}

// ---------- inputs ----------

const PLANE_FIELDS = [
  ["weight", "Gross weight (lb)", 50], ["power", "Power (hp)", 5],
  ["wingArea", "Wing area (ft²)", 1], ["span", "Span (ft)", 0.5],
  ["clmaxClean", "CLmax clean", 0.05], ["clmaxFlaps", "CLmax full flaps", 0.05],
  ["cd0", "CD0 (parasite)", 0.001], ["oswald", "Span efficiency e", 0.05],
  ["propEff", "Prop efficiency", 0.01], ["wingDragShare", "Wing share of CD0", 0.05],
];
const MISSION_FIELDS = [["cruiseAlt", "Cruise altitude (ft)", 500], ["fieldElev", "Field elevation (ft)", 500]];
const KNOB_FIELDS = {
  slats: [["dCl", "Slat ΔCLmax", 0.05], ["weight", "Added weight (lb)", 5], ["dragPct", "Cruise drag +%", 1]],
  area: [["cruiseArea", "Cruise area %", 5], ["cruiseSpan", "Cruise span %", 5], ["weight", "Added weight (lb)", 10]],
  vtol: [["wingArea", "Wing area %", 5], ["rotors", "Lift rotors", 2], ["rotorDia", "Rotor dia (ft)", 0.5],
    ["fm", "Figure of merit", 0.05], ["liftWeight", "Motors+rotors (lb)", 10], ["hoverSec", "Hover s each end", 10],
    ["whPerKg", "Battery Wh/kg", 10], ["dragPct", "Cruise drag +%", 1]],
};

const field = (name, label, step, value, data = "") =>
  `<label>${esc(label)} <input type="number" name="${name}" step="${step}" value="${value}" ${data}></label>`;

function renderInputs() {
  $("plane").innerHTML = PLANE_FIELDS.map(([k, l, s]) => field(k, l, s, state.plane[k], 'data-group="plane"')).join("")
    + MISSION_FIELDS.map(([k, l, s]) => field(k, l, s, state[k], 'data-group="mission"')).join("");
  $("knobs").innerHTML = Object.entries(KNOB_FIELDS).map(([c, fields]) => `
    <fieldset class="knob-set">
      <legend><span class="sw c-${c}" aria-hidden="true"></span>${esc(INFO[c].name)}</legend>
      <div class="grid2">${fields.map(([k, l, s]) => field(k, l, s, state.knobs[c][k], `data-group="${c}"`)).join("")}</div>
    </fieldset>`).join("");
}

function onInput(e) {
  const el = e.target;
  if (!el.matches("input[type=number]")) return;
  const v = Number(el.value);
  if (el.value === "" || !Number.isFinite(v)) return;
  const g = el.dataset.group;
  const bad = v < 0 || (["weight", "power", "wingArea", "span", "clmaxClean", "clmaxFlaps", "oswald", "propEff", "fm", "whPerKg", "rotorDia", "rotors", "cruiseArea", "cruiseSpan"].includes(el.name) && v <= 0);
  el.classList.toggle("bad", bad);
  if (bad) return;
  if (g === "plane") state.plane[el.name] = v;
  else if (g === "mission") state[el.name] = v;
  else state.knobs[g][el.name] = v;
  save();
  recompute();
  renderAll(false);
}

// ---------- concept cards ----------

function renderCardsShell() {
  $("concepts").innerHTML = CONCEPTS.map((c) => {
    const i = INFO[c];
    const history = i.done ? `
      <details class="history">
        <summary>Where it's done, and how it's failed</summary>
        <p><b>Done:</b> ${esc(i.done)}</p>
        <p><b>Failed / hard part:</b> ${esc(i.failed)}</p>
        <p><b>Angle:</b> ${esc(i.angle)}</p>
      </details>` : "";
    return `
      <article class="card concept" id="card-${c}">
        <h3><span class="sw c-${c}" aria-hidden="true"></span>${esc(i.name)}</h3>
        <p class="pitch">${esc(i.pitch)}</p>
        <div class="pics c-${c}">
          <svg class="section" id="sec-${c}" viewBox="0 0 320 96" role="img" aria-label="${esc(i.name)} wing section"></svg>
          <svg class="plan" id="plan-${c}" viewBox="0 0 320 132" role="img" aria-label="${esc(i.name)} top view"></svg>
        </div>
        <p class="state" id="state-${c}"></p>
        <dl class="stats" id="stats-${c}"></dl>
        ${history}
      </article>`;
  }).join("");
}

const PX = 230; // chord length in the section drawing at chord scale 1
function drawSection(c, look) {
  const k = look.chord, x0 = 42, cy = 44;
  const pt = ([x, y]) => `${(x0 + x * PX * k).toFixed(1)},${(cy - y * PX * k).toFixed(1)}`;
  const p = sectionPieces(look);
  const poly = (pts, cls) => `<polygon class="${cls}" points="${pts.map(pt).join(" ")}"/>`;
  $(`sec-${c}`).innerHTML = `<line class="chordline" x1="10" x2="310" y1="${cy}" y2="${cy}"/>
    ${poly(p.slat, look.slat > 0.02 ? "piece moving" : "piece")}${poly(p.main, "piece")}${poly(p.flap, look.flap > 0.5 || look.fowler > 0.005 ? "piece moving" : "piece")}
    <text class="flow" x="10" y="90">airflow →</text>`;
}

// Top view: 260 px for the baseline span, chord to the same scale.
function drawPlan(c, look, t) {
  const pl = state.plane, pxPerFt = 260 / pl.span, cx = 160, le = 52;
  const span = pl.span * look.span * pxPerFt;
  const baseChord = (pl.wingArea / pl.span) * pxPerFt;
  const chord = baseChord * look.chord;
  const half = span / 2;
  const parts = [];
  // Fuselage and tail.
  parts.push(`<rect class="fuse" x="${cx - 7}" y="${le - 34}" width="14" height="116" rx="7"/>`);
  parts.push(`<rect class="fuse" x="${cx - 38}" y="${le + 70}" width="76" height="11" rx="3"/>`);
  // Flaps: inboard 60 % of each semi-span, sliding aft with Fowler travel.
  const flapC = chord * 0.26, flapShift = look.fowler * baseChord * look.chord + (look.flap / 40) * 2;
  const flapOn = look.flap > 0.5 || look.fowler > 0.005;
  for (const s of [-1, 1]) {
    const x = s < 0 ? cx - half * 0.62 : cx + 7;
    parts.push(`<rect class="${flapOn ? "flap moving" : "flap"}" x="${x.toFixed(1)}" y="${(le + chord - flapC + flapShift).toFixed(1)}" width="${(half * 0.62 - 7).toFixed(1)}" height="${flapC.toFixed(1)}"/>`);
  }
  parts.push(`<rect class="wing" x="${(cx - half).toFixed(1)}" y="${le}" width="${span.toFixed(1)}" height="${(chord - flapC).toFixed(1)}" rx="2"/>`);
  // Slats: outboard 70 % of each semi-span, out ahead of the leading edge.
  if (look.slat > 0.02) {
    const d = look.slat * 6;
    for (const s of [-1, 1]) {
      const x = s < 0 ? cx - half : cx + half * 0.3;
      parts.push(`<rect class="piece moving" x="${x.toFixed(1)}" y="${(le - 4 - d).toFixed(1)}" width="${(half * 0.7).toFixed(1)}" height="4" rx="1"/>`);
    }
  }
  // Lift rotors.
  if (look.rotors) {
    const k = state.knobs.vtol, r = Math.min(26, (k.rotorDia / 2) * pxPerFt);
    for (const rot of rotorLayout(k.rotors)) {
      const x = cx + rot.x * pl.span * pxPerFt;
      const y = rot.row < 0 ? le - r - 3 : le + chord + r + 3;
      const a = look.spin > 0.01 ? (t / 6 + rot.x * 90) % 360 : 90;
      const rad = (a * Math.PI) / 180, dx = Math.cos(rad) * r, dy = Math.sin(rad) * r;
      parts.push(`<line class="boom" x1="${x}" x2="${x}" y1="${y}" y2="${le + chord / 2}"/>`);
      if (look.spin > 0.01) parts.push(`<circle class="disk" cx="${x}" cy="${y}" r="${r}" style="opacity:${(0.35 * look.spin).toFixed(2)}"/>`);
      parts.push(`<line class="blade" x1="${(x - dx).toFixed(1)}" y1="${(y - dy).toFixed(1)}" x2="${(x + dx).toFixed(1)}" y2="${(y + dy).toFixed(1)}"/>`);
    }
  }
  $(`plan-${c}`).innerHTML = parts.join("");
}

function stateLine(c, phase, cfg) {
  const l = cfg.look;
  if (c === "vtol") return phase === "takeoff" || phase === "landing" ? "Lift rotors hovering; wing along for the ride." : "Rotors stopped and aligned fore-aft; small wing flying.";
  const bits = [];
  if (l.slat) bits.push("slats out");
  if (l.flap) bits.push(`flaps ${l.flap}°`);
  if (l.fowler) bits.push("Fowler travel adds chord");
  if (c === "area" && phase === "cruise") bits.push(`wing retracted to ${fmt(cfg.area)} ft²`);
  return (bits.length ? bits.join(", ") : "clean") + ` · CLmax ${fmt(cfg.clmax, 2)}`;
}

function stats(c, phase) {
  const r = results[c], v = c === "vtol";
  const s = {
    takeoff: v ? [["Hover power", `${fmt(r.hoverHp)} hp`], ["Battery", `${fmt(r.batteryLb)} lb`], ["Disk loading", `${fmt(r.diskLoading, 1)} lb/ft²`]]
      : [["Ground roll", `${fmt(r.takeoffFt)} ft`], ["Added weight", `${fmt(r.extraWeight)} lb`], ["Liftoff", `${fmt(r.liftoffKt)} kt`]],
    climb: [["Best climb", `${fmt(r.climbFpm)} fpm`], ["Ceiling", `${fmt(Math.round(r.ceilingFt / 100) * 100)} ft`], ["Added weight", `${fmt(r.extraWeight)} lb`]],
    cruise: [["Top speed", `${fmt(r.topKt)} kt`], ["75 % cruise", r.cruiseKt ? `${fmt(r.cruiseKt)} kt` : "n/a"], ["Wing loading", `${fmt(r.cruiseWingLoading, 1)} lb/ft²`]],
    landing: v ? [["Wing stall (clean)", `${fmt(r.stallKt)} kt`], ["Hover power", `${fmt(r.hoverHp)} hp`], ["Ground roll", "vertical"]]
      : [["Stall", `${fmt(r.stallKt)} kt`], ["Ground roll", `${fmt(r.landingFt)} ft`], ["Wing loading", `${fmt(r.landWingLoading, 1)} lb/ft²`]],
  }[phase];
  return s.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join("");
}

// ---------- phase animation ----------

let shown = {};   // concept → look currently drawn
let anim = null;
function targetLooks(phase) {
  return Object.fromEntries(CONCEPTS.map((c) => [c, configFor(c, phase, state.plane, state.knobs, state.fieldElev).look]));
}
function setPhase(phase, animate = true) {
  state.phase = phase;
  save();
  renderPhases();
  renderCardText();
  const to = targetLooks(phase);
  const from = Object.keys(shown).length ? { ...shown } : to;
  const t0 = performance.now(), dur = animate && !matchMedia("(prefers-reduced-motion: reduce)").matches ? 900 : 0;
  cancelAnimationFrame(anim);
  const frame = (now) => {
    const raw = dur ? Math.min(1, (now - t0) / dur) : 1;
    const e = raw < 0.5 ? 2 * raw * raw : 1 - (-2 * raw + 2) ** 2 / 2;
    for (const c of CONCEPTS) {
      const look = blendLook({ spin: 0, ...from[c] }, to[c], e);
      shown[c] = { ...look, rotors: to[c].rotors };
      drawSection(c, look);
      drawPlan(c, look, now);
    }
    // Keep hovering rotors turning.
    if (raw < 1 || CONCEPTS.some((c) => to[c].rotors === "spinning")) anim = requestAnimationFrame(frame);
  };
  anim = requestAnimationFrame(frame);
}

function renderPhases() {
  $("phases").innerHTML = PHASES.map((p, i) => `
    <button type="button" data-phase="${p}" aria-pressed="${p === state.phase}"><span class="num">${i + 1}</span>${PHASE_NAMES[p]}</button>`).join("");
}

function renderCardText() {
  for (const c of CONCEPTS) {
    const cfg = configFor(c, state.phase, state.plane, state.knobs, state.fieldElev);
    $(`state-${c}`).textContent = `${PHASE_NAMES[state.phase]}: ${stateLine(c, state.phase, cfg)}`;
    $(`stats-${c}`).innerHTML = stats(c, state.phase);
  }
}

let playing = null;
function togglePlay() {
  if (playing) { clearInterval(playing); playing = null; }
  else {
    const step = () => setPhase(PHASES[(PHASES.indexOf(state.phase) + 1) % PHASES.length]);
    step();
    playing = setInterval(step, 2600);
  }
  $("play").setAttribute("aria-pressed", String(!!playing));
  $("play").innerHTML = playing ? '❚❚<span class="lbl"> Pause</span>' : '▶<span class="lbl"> Fly the sequence</span>';
}

// ---------- comparison table ----------

const ROWS = [
  ["Added weight", "extraWeight", "lb", 0, -1],
  ["Landing stall", "stallKt", "kt", 0, -1],
  ["Takeoff roll", "takeoffFt", "ft", 0, -1],
  ["Landing roll", "landingFt", "ft", 0, -1],
  ["Best climb (field)", "climbFpm", "fpm", 0, 1],
  ["Service ceiling", "ceilingFt", "ft", -2, 1],
  ["Top speed (cruise alt)", "topKt", "kt", 0, 1],
  ["75 % power cruise", "cruiseKt", "kt", 0, 1],
];
function renderTable() {
  const head = `<tr><th scope="col">At ${fmt(state.cruiseAlt)} ft cruise, ${fmt(state.fieldElev)} ft field</th>${CONCEPTS.map((c) =>
    `<th scope="col" class="num"><span class="sw c-${c}" aria-hidden="true"></span>${esc(INFO[c].name)}</th>`).join("")}</tr>`;
  const body = ROWS.map(([label, key, unit, round, better]) => {
    const base = results.fixed[key];
    return `<tr><th scope="row">${label}</th>${CONCEPTS.map((c) => {
      let v = results[c][key];
      if (c === "vtol" && (key === "takeoffFt" || key === "landingFt")) return `<td class="num">vertical<small class="d good">▼ no runway</small></td>`;
      if (v == null) return `<td class="num">can't hold level</td>`;
      if (round < 0) v = Math.round(v / 10 ** -round) * 10 ** -round;
      let delta = "";
      if (c !== "fixed" && base) {
        const pct = ((results[c][key] - base) / base) * 100;
        if (Math.abs(pct) >= 0.5) {
          const good = Math.sign(pct) === better;
          delta = `<small class="d ${good ? "good" : "bad"}">${pct > 0 ? "▲" : "▼"} ${fmt(Math.abs(pct))} %</small>`;
        }
      } else if (c !== "fixed" && key === "extraWeight" && v > 0) delta = `<small class="d bad">▲ ${fmt(v)} lb</small>`;
      return `<td class="num">${fmt(v)} <span class="unit">${unit}</span>${delta}</td>`;
    }).join("")}</tr>`;
  }).join("");
  $("table").innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
}

// ---------- power chart ----------

const CH = { W: 640, H: 330, l: 48, r: 96, t: 14, b: 38, x0: 40, x1: 200 };
const xs = (kt) => CH.l + ((kt - CH.x0) / (CH.x1 - CH.x0)) * (CH.W - CH.l - CH.r);
let yMax = 300;
const ys = (hp) => CH.t + (1 - hp / yMax) * (CH.H - CH.t - CH.b);
let curves = {};

function renderChart() {
  // Narrow screens get a narrower drawing so the labels stay readable.
  CH.W = $("chart").parentElement.clientWidth < 560 ? 420 : 640;
  CH.r = CH.W < 640 ? 74 : 96;
  $("chart").setAttribute("viewBox", `0 0 ${CH.W} ${CH.H}`);
  const alt = state.cruiseAlt, { sigma } = isa(alt);
  const pa = powerAvailableHp(state.plane, sigma);
  $("chart-alt").textContent = `at ${fmt(alt)} ft, full throttle ${fmt(pa)} hp to the air`;
  yMax = Math.ceil((pa * 1.6) / 50) * 50;
  curves = Object.fromEntries(CONCEPTS.map((c) => [c, powerCurve(configFor(c, "cruise", state.plane, state.knobs, state.fieldElev), alt, CH.x0, CH.x1, 1)]));
  const parts = [];
  for (let h = 0; h <= yMax; h += yMax > 400 ? 100 : 50) {
    parts.push(`<line class="grid" x1="${CH.l}" x2="${CH.W - CH.r}" y1="${ys(h)}" y2="${ys(h)}"/><text class="tick" x="${CH.l - 8}" y="${ys(h)}" text-anchor="end" dominant-baseline="central">${h}</text>`);
  }
  for (let k = CH.x0; k <= CH.x1; k += CH.W < 640 ? 40 : 20) parts.push(`<text class="tick" x="${xs(k)}" y="${CH.H - CH.b + 16}" text-anchor="middle">${k}</text>`);
  parts.push(`<text class="axis-title" x="${(CH.l + CH.W - CH.r) / 2}" y="${CH.H - 4}" text-anchor="middle">True airspeed (kt)</text>`);
  parts.push(`<text class="axis-title" x="12" y="${CH.t + 4}" transform="rotate(-90 12 ${CH.t + 4})" text-anchor="end">Power (hp)</text>`);
  parts.push(`<line class="avail" x1="${CH.l}" x2="${CH.W - CH.r}" y1="${ys(pa)}" y2="${ys(pa)}"/><text class="avail-label" x="${CH.W - CH.r + 6}" y="${ys(pa)}" dominant-baseline="central">Full power</text>`);
  parts.push(`<line class="avail dash" x1="${CH.l}" x2="${CH.W - CH.r}" y1="${ys(pa * 0.75)}" y2="${ys(pa * 0.75)}"/><text class="avail-label" x="${CH.W - CH.r + 6}" y="${ys(pa * 0.75)}" dominant-baseline="central">75 %</text>`);
  for (const c of CONCEPTS) {
    const pts = curves[c].filter((p) => p.hp <= yMax * 1.02);
    if (!pts.length) continue;
    parts.push(`<polyline class="series c-${c}" points="${pts.map((p) => `${xs(p.kt).toFixed(1)},${ys(Math.min(p.hp, yMax)).toFixed(1)}`).join(" ")}"/>`);
    const top = results[c].topKt;
    if (top && top <= CH.x1) parts.push(`<circle class="dot c-${c}" cx="${xs(top)}" cy="${ys(pa)}" r="5"/>`);
  }
  parts.push(`<line id="cross" class="cross" y1="${CH.t}" y2="${CH.H - CH.b}" x1="-10" x2="-10"/>`);
  parts.push(`<rect id="hit" x="${CH.l}" y="${CH.t}" width="${CH.W - CH.l - CH.r}" height="${CH.H - CH.t - CH.b}" fill="transparent"/>`);
  $("chart").innerHTML = parts.join("");
}

function onChartMove(e) {
  const svg = $("chart"), box = svg.getBoundingClientRect();
  const x = ((e.clientX - box.left) / box.width) * CH.W;
  if (x < CH.l || x > CH.W - CH.r) return hideTip();
  const kt = Math.round(CH.x0 + ((x - CH.l) / (CH.W - CH.l - CH.r)) * (CH.x1 - CH.x0));
  $("cross").setAttribute("x1", xs(kt)); $("cross").setAttribute("x2", xs(kt));
  const rows = CONCEPTS.map((c) => {
    const p = curves[c].find((q) => q.kt === kt);
    return `<div><span class="sw c-${c}"></span>${esc(INFO[c].name)}<b>${p ? `${fmt(p.hp)} hp` : "stalled"}</b></div>`;
  }).join("");
  const tip = $("tip");
  tip.innerHTML = `<strong>${kt} kt</strong>${rows}`;
  tip.hidden = false;
  const left = ((xs(kt) / CH.W) * box.width);
  tip.style.left = `${Math.min(left + 12, box.width - tip.offsetWidth - 4)}px`;
  tip.style.top = "8px";
}
function hideTip() { $("tip").hidden = true; $("cross")?.setAttribute("x1", -10); $("cross")?.setAttribute("x2", -10); }

// ---------- wiring ----------

function renderAll(inputs = true) {
  if (inputs) renderInputs();
  renderCardText();
  renderTable();
  renderChart();
  setPhase(state.phase, false);
}

$("ideas").innerHTML = OTHER_IDEAS.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join("");
renderCardsShell();
recompute();
renderAll();

$("phases").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-phase]");
  if (!b) return;
  if (playing) togglePlay();
  setPhase(b.dataset.phase);
});
$("play").addEventListener("click", togglePlay);
$("plane").addEventListener("input", onInput);
$("knobs").addEventListener("input", onInput);
$("reset").addEventListener("click", () => {
  state = { ...state, plane: { ...DEFAULT_PLANE }, knobs: structuredClone(DEFAULT_KNOBS), cruiseAlt: 8000, fieldElev: 0 };
  save(); recompute(); renderAll();
});
$("chart").addEventListener("pointermove", onChartMove);
$("chart").addEventListener("pointerleave", hideTip);
let lastWide = null;
addEventListener("resize", () => {
  const wide = $("chart").parentElement.clientWidth >= 560;
  if (wide !== lastWide) { lastWide = wide; renderChart(); }
});
