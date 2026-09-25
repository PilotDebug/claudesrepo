import {
  designFor, liftCoefficient, naca4, parseNaca, reynolds, shapeStats, thinAirfoil,
} from "./airfoil.js";

const STORE = "airfoil-lab";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const SLOTS = 3;
const ALPHA = { min: -4, max: 16, stall: 12 };

let state = load();
function load() {
  const base = { codes: ["0012", "2412", "4415"], alpha: 4, knots: 100, chord: 60, design: { cl: 0.8, alpha: 3, p: 4, t: 12 } };
  try { return { ...base, ...JSON.parse(localStorage.getItem(STORE)) }; } catch { return base; }
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ } }

function sections() {
  return state.codes.map((code, i) => {
    const s = parseNaca(code);
    if (!s) return null;
    const theory = thinAirfoil(s);
    return { i, code: s.code, s, theory, stats: shapeStats(s), geo: naca4(s, 90) };
  });
}

// ---------- slots ----------

function renderSlots() {
  $("slots").innerHTML = state.codes.map((c, i) => `
    <label class="slot s${i}">
      <span class="sw" aria-hidden="true"></span>
      <span class="sr">Airfoil ${i + 1}</span>
      <span class="prefix">NACA</span>
      <input data-slot="${i}" value="${esc(c)}" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="Airfoil ${i + 1} NACA code">
    </label>`).join("");
}

// ---------- section plot ----------

function renderShapes(list) {
  const W = 640, H = 130, padX = 20, sx = W - padX * 2, cy = H / 2;
  const pt = ([x, y]) => `${(padX + x * sx).toFixed(2)},${(cy - y * sx).toFixed(2)}`;
  const shapes = list.map((a) => a && `
    <g class="s${a.i}">
      <polygon class="foil" points="${[...a.geo.upper, ...a.geo.lower.slice().reverse()].map(pt).join(" ")}"/>
      <polyline class="camber" points="${a.geo.camberLine.map(pt).join(" ")}"/>
    </g>`).join("");
  $("shapes").innerHTML = `<line class="chord" x1="${padX}" y1="${cy}" x2="${W - padX}" y2="${cy}"/>${shapes}`;
}

// ---------- lift curve ----------

const CHART = { W: 640, H: 340, l: 46, r: 58, t: 14, b: 38 };
const xs = (a) => CHART.l + ((a - ALPHA.min) / (ALPHA.max - ALPHA.min)) * (CHART.W - CHART.l - CHART.r);
let yRange = [-0.5, 2.5];
const ys = (cl) => CHART.t + (1 - (cl - yRange[0]) / (yRange[1] - yRange[0])) * (CHART.H - CHART.t - CHART.b);

function renderLift(list) {
  const valid = list.filter(Boolean);
  const cls = valid.flatMap((a) => [liftCoefficient(ALPHA.min, a.theory.alphaL0), liftCoefficient(ALPHA.max, a.theory.alphaL0)]);
  yRange = [Math.floor(Math.min(-0.5, ...cls) * 2) / 2, Math.ceil(Math.max(1, ...cls) * 2) / 2];

  const grid = [];
  for (let c = yRange[0]; c <= yRange[1] + 1e-9; c += 0.5) {
    grid.push(`<line class="grid" x1="${CHART.l}" x2="${CHART.W - CHART.r}" y1="${ys(c)}" y2="${ys(c)}"/>
      <text class="tick" x="${CHART.l - 8}" y="${ys(c)}" text-anchor="end" dominant-baseline="central">${c.toFixed(1)}</text>`);
  }
  for (let a = ALPHA.min; a <= ALPHA.max; a += 4) {
    grid.push(`<text class="tick" x="${xs(a)}" y="${CHART.H - CHART.b + 16}" text-anchor="middle">${a}°</text>`);
  }
  const zero = `<line class="axis" x1="${CHART.l}" x2="${CHART.W - CHART.r}" y1="${ys(0)}" y2="${ys(0)}"/>`;
  const stall = `<rect class="stall" x="${xs(ALPHA.stall)}" y="${CHART.t}" width="${xs(ALPHA.max) - xs(ALPHA.stall)}" height="${CHART.H - CHART.t - CHART.b}"/>
    <text class="stall-label" x="${(xs(ALPHA.stall) + xs(ALPHA.max)) / 2}" y="${CHART.t + 14}" text-anchor="middle">real sections</text>
    <text class="stall-label" x="${(xs(ALPHA.stall) + xs(ALPHA.max)) / 2}" y="${CHART.t + 28}" text-anchor="middle">stall ≈ here</text>`;
  const ref = `<line class="ref" x1="${xs(state.alpha)}" x2="${xs(state.alpha)}" y1="${CHART.t}" y2="${CHART.H - CHART.b}"/>
    <text class="tick" x="${xs(state.alpha) + 4}" y="${CHART.H - CHART.b - 6}">α ${state.alpha}°</text>`;

  // Direct labels at the right end, nudged apart so they never collide.
  const ends = valid.map((a) => ({ a, y: ys(liftCoefficient(ALPHA.max, a.theory.alphaL0)) })).sort((p, q) => p.y - q.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 14);

  const lines = valid.map((a) => `
    <line class="series s${a.i}" x1="${xs(ALPHA.min)}" y1="${ys(liftCoefficient(ALPHA.min, a.theory.alphaL0))}"
      x2="${xs(ALPHA.max)}" y2="${ys(liftCoefficient(ALPHA.max, a.theory.alphaL0))}"/>
    <circle class="dot s${a.i}" cx="${xs(state.alpha)}" cy="${ys(liftCoefficient(state.alpha, a.theory.alphaL0))}" r="4.5"/>`).join("");
  const labels = ends.map(({ a, y }) => `<text class="end-label" x="${xs(ALPHA.max) + 6}" y="${y}" dominant-baseline="central">${a.code}</text>`).join("");

  $("lift").innerHTML = `${grid.join("")}${stall}${zero}${ref}${lines}${labels}
    <text class="axis-title" x="${CHART.l}" y="${CHART.t - 2}">Cl</text>
    <text class="axis-title" x="${CHART.W - CHART.r}" y="${CHART.H - 4}" text-anchor="end">angle of attack</text>
    <g id="cross" hidden><line class="cross" y1="${CHART.t}" y2="${CHART.H - CHART.b}"/></g>
    <rect id="hit" x="${CHART.l}" y="${CHART.t}" width="${CHART.W - CHART.l - CHART.r}" height="${CHART.H - CHART.t - CHART.b}" fill="transparent"/>`;
  bindHover(valid);
}

function bindHover(valid) {
  const svg = $("lift"), hit = $("hit"), cross = $("cross"), tip = $("tip");
  const move = (e) => {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const loc = p.matrixTransform(svg.getScreenCTM().inverse());
    const a = Math.round(ALPHA.min + ((loc.x - CHART.l) / (CHART.W - CHART.l - CHART.r)) * (ALPHA.max - ALPHA.min));
    const alpha = Math.max(ALPHA.min, Math.min(ALPHA.max, a));
    cross.hidden = false;
    cross.firstElementChild.setAttribute("x1", xs(alpha)); cross.firstElementChild.setAttribute("x2", xs(alpha));
    tip.innerHTML = `<b>α = ${alpha}°</b>${alpha > ALPHA.stall ? ` <span class="muted">(past typical stall)</span>` : ""}` +
      valid.map((f) => `<div><i class="sw s${f.i}"></i>NACA ${f.code}<b>${liftCoefficient(alpha, f.theory.alphaL0).toFixed(2)}</b></div>`).join("");
    tip.hidden = false;
    const box = svg.getBoundingClientRect(), tb = tip.getBoundingClientRect();
    const px = box.left + (xs(alpha) / CHART.W) * box.width;
    tip.style.left = `${Math.min(box.right - tb.width, Math.max(box.left, px + 12)) - box.left}px`;
    tip.style.top = `${8}px`;
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerleave", () => { cross.hidden = true; tip.hidden = true; });
}

// ---------- table, Reynolds, design ----------

function renderTable(list) {
  $("table").innerHTML = `
    <thead><tr><th>Section</th><th class="num">Max thickness</th><th class="num">Max camber</th>
      <th class="num">Zero-lift α</th><th class="num">Cm<sub>c/4</sub></th><th class="num">Cl at ${state.alpha}°</th></tr></thead>
    <tbody>${list.map((a, i) => a ? `<tr>
      <td><i class="sw s${a.i}"></i>NACA ${a.code}</td>
      <td class="num">${(a.stats.maxThickness * 100).toFixed(1)} % <span class="muted">@ ${(a.stats.maxThicknessAt * 100).toFixed(0)} %</span></td>
      <td class="num">${a.s.m ? `${(a.s.m * 100).toFixed(0)} % <span class="muted">@ ${(a.s.p * 100).toFixed(0)} %</span>` : "symmetric"}</td>
      <td class="num">${a.theory.alphaL0.toFixed(2)}°</td>
      <td class="num">${a.theory.cmc4.toFixed(3)}</td>
      <td class="num"><b>${liftCoefficient(state.alpha, a.theory.alphaL0).toFixed(2)}</b></td>
    </tr>` : `<tr><td colspan="6" class="muted">Slot ${i + 1}: enter a 4-digit NACA code, e.g. 2412</td></tr>`).join("")}</tbody>`;
}

function renderReynolds() {
  const re = reynolds(state.knots, state.chord);
  $("re").textContent = Number.isFinite(re) ? `${(re / 1e6).toFixed(2)} million` : "—";
}

function renderDesign() {
  const d = state.design;
  const r = designFor({ targetCl: d.cl, alphaDeg: d.alpha, p: d.p / 10, t: d.t / 100 });
  $("design-out").innerHTML = `
    <div class="design-code">NACA ${r.code}</div>
    <p>Needs ${(r.exactCamber * 100).toFixed(1)} % camber; nearest code gives Cl ${r.clAtAlpha.toFixed(2)} at ${d.alpha}°.
      ${r.clamped ? `<br><b>Outside what a 4-digit section can do</b> (0–9 % camber), so it's clamped.` : ""}</p>
    <button type="button" id="use-design">Compare it in slot 3</button>`;
  $("use-design").addEventListener("click", () => {
    state.codes[2] = r.code;
    renderSlots(); renderAll();
  });
}

function renderAll() {
  const list = sections();
  renderShapes(list);
  renderLift(list);
  renderTable(list);
  renderReynolds();
  renderDesign();
  $("alpha-val").textContent = `${state.alpha}°`;
  save();
}

// ---------- wiring ----------

$("slots").addEventListener("input", (e) => {
  const i = e.target.dataset.slot;
  if (i === undefined) return;
  state.codes[Number(i)] = e.target.value;
  e.target.closest(".slot").classList.toggle("bad", !parseNaca(e.target.value));
  renderAll();
});
$("alpha").addEventListener("input", (e) => { state.alpha = Number(e.target.value); renderAll(); });
for (const [id, key] of [["knots", "knots"], ["chord", "chord"]]) {
  $(id).addEventListener("input", (e) => { state[key] = Number(e.target.value); renderReynolds(); save(); });
}
$("design").addEventListener("input", (e) => {
  const k = e.target.name;
  if (k) { state.design[k] = Number(e.target.value); renderDesign(); save(); }
});

renderSlots();
$("alpha").value = state.alpha;
$("knots").value = state.knots;
$("chord").value = state.chord;
for (const [k, v] of Object.entries(state.design)) $("design").elements[k].value = v;
renderAll();
