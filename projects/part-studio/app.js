import { MATERIALS, bracket, checks, metrics, panel, pathData, plate, toDXF, toSVG } from "./parts.js";

const STORE = "part-studio";
const MM_PER_IN = 25.4;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Field schemas per template. `len: true` fields convert when units change.
const TEMPLATES = {
  plate: {
    label: "Plate", blurb: "A flat plate with a grid of holes: mounting plates, doublers, spacers.",
    build: (p, t) => plate(p),
    fields: [
      ["w", "Width", { len: true }], ["h", "Height", { len: true }], ["r", "Corner radius", { len: true }],
      ["holeD", "Hole Ø", { len: true }], ["cols", "Hole columns", { int: true }], ["rows", "Hole rows", { int: true }],
      ["margin", "Hole inset from edge", { len: true }],
    ],
  },
  bracket: {
    label: "Bracket", blurb: "A 90° angle bracket, cut flat and bent. The flat pattern includes the bend allowance.",
    build: (p, t) => bracket({ ...p, t }),
    fields: [
      ["a", "Flange A (outside)", { len: true }], ["b", "Flange B (outside)", { len: true }], ["width", "Width", { len: true }],
      ["bendR", "Inside bend radius", { len: true }], ["k", "K-factor", { step: 0.01 }],
      ["holeD", "Hole Ø", { len: true }], ["holesA", "Holes in A", { int: true }], ["holesB", "Holes in B", { int: true }],
      ["holeMargin", "Hole inset from edge", { len: true }],
    ],
  },
  panel: {
    label: "Panel", blurb: "A panel with round and rectangular cutouts. Drag cutouts on the preview to place them.",
    build: (p) => panel(p),
    fields: [["w", "Width", { len: true }], ["h", "Height", { len: true }], ["r", "Corner radius", { len: true }]],
  },
};

const DEFAULTS = {
  template: "plate", units: "mm", material: "Aluminium 6061", t: 2,
  params: {
    plate: { w: 120, h: 80, r: 6, holeD: 6.5, cols: 3, rows: 2, margin: 12 },
    bracket: { a: 40, b: 60, width: 50, bendR: 3, k: 0.44, holeD: 6.5, holesA: 2, holesB: 2, holeMargin: 12 },
    panel: {
      w: 400, h: 180, r: 8,
      items: [
        { id: 1, label: "Screen", type: "rect", x: 105, y: 95, w: 160, h: 110, r: 4 },
        { id: 2, label: "Gauge 1", type: "round", x: 250, y: 105, d: 80 },
        { id: 3, label: "Gauge 2", type: "round", x: 345, y: 105, d: 80 },
        { id: 4, label: "Switch 1", type: "round", x: 225, y: 30, d: 12.7 },
        { id: 5, label: "Switch 2", type: "round", x: 265, y: 30, d: 12.7 },
        { id: 6, label: "Switch 3", type: "round", x: 305, y: 30, d: 12.7 },
        { id: 7, label: "Switch 4", type: "round", x: 345, y: 30, d: 12.7 },
      ],
    },
  },
};

let state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && saved.params && TEMPLATES[saved.template]) return saved;
  } catch { /* fall through */ }
  return structuredClone(DEFAULTS);
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ }
}

const u = () => state.units;
const dp = () => (u() === "in" ? 3 : 1);
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(dp()) : "—");
const current = () => state.params[state.template];

function build() {
  return TEMPLATES[state.template].build(current(), state.t);
}

// ---------- controls ----------

function numberField(key, label, value, opts = {}) {
  const step = opts.int ? 1 : opts.step ?? (opts.len ? (u() === "in" ? 0.01 : 0.5) : 0.1);
  return `<label><span>${esc(label)}${opts.len ? ` <span class="unit">${u()}</span>` : ""}</span>
    <input type="number" data-key="${key}" value="${value}" step="${step}" min="0"></label>`;
}

function renderControls() {
  const tpl = TEMPLATES[state.template];
  const p = current();
  $("tabs").innerHTML = Object.entries(TEMPLATES).map(([k, v]) =>
    `<button type="button" data-template="${k}" aria-pressed="${k === state.template}">${v.label}</button>`).join("");
  $("blurb").textContent = tpl.blurb;
  $("fields").innerHTML = tpl.fields.map(([k, label, o]) => numberField(k, label, p[k], o)).join("");
  $("t").value = state.t;
  $("t").step = u() === "in" ? 0.001 : 0.1;
  $("t-unit").textContent = u();
  $("units").value = u();
  $("material").innerHTML = Object.entries(MATERIALS)
    .map(([m, d]) => `<option ${m === state.material ? "selected" : ""} value="${esc(m)}">${esc(m)} · ${d} g/cm³</option>`).join("");
  renderItems();
}

function renderItems() {
  const box = $("items");
  if (state.template !== "panel") { box.hidden = true; return; }
  box.hidden = false;
  const items = current().items;
  $("item-list").innerHTML = items.map((it, i) => `
    <div class="item" data-i="${i}">
      <input class="item-label" data-ikey="label" value="${esc(it.label || "")}" aria-label="Label">
      <div class="item-grid">
        <label>x<input type="number" data-ikey="x" value="${it.x}" step="any"></label>
        <label>y<input type="number" data-ikey="y" value="${it.y}" step="any"></label>
        ${it.type === "rect"
          ? `<label>w<input type="number" data-ikey="w" value="${it.w}" step="any" min="0"></label>
             <label>h<input type="number" data-ikey="h" value="${it.h}" step="any" min="0"></label>`
          : `<label>Ø<input type="number" data-ikey="d" value="${it.d}" step="any" min="0"></label>`}
      </div>
      <button type="button" class="icon" data-del="${i}" aria-label="Remove ${esc(it.label || "cutout")}">×</button>
    </div>`).join("") || `<p class="muted">No cutouts yet.</p>`;
}

// ---------- preview ----------

function renderPreview() {
  const part = build();
  const { w, h } = part.outline;
  const issues = checks(part, { t: state.t, fmt: (n) => `${fmt(n)} ${u()}` });
  const flagged = new Map();
  for (const is of issues) for (const i of is.at) if (flagged.get(i) !== "error") flagged.set(i, is.level);

  const pad = Math.max(w, h) * 0.12;
  const svg = $("preview");
  svg.setAttribute("viewBox", `${-pad} ${-pad * 0.6} ${w + pad * 1.6} ${h + pad * 1.9}`);
  const font = Math.max(w, h) * 0.028;
  const bendZone = part.info.bendZone
    ? `<rect class="bendzone" x="${part.info.bendZone[0]}" y="0" width="${part.info.bendZone[1] - part.info.bendZone[0]}" height="${h}"/>`
    : "";
  const sheet = [part.outline, ...part.cutouts].map((s) => pathData(s, h)).join("");
  const cutouts = part.cutouts.map((c, i) => `
    <path class="cutout ${flagged.get(i) || ""} ${state.template === "panel" ? "draggable" : ""}" data-i="${i}" d="${pathData(c, h)}">${c.label ? `<title>${esc(c.label)}</title>` : ""}</path>
    ${c.label && (c.d || c.w) > font * 0.5 * c.label.length ? `<text class="label" x="${c.x + (c.w || 0) / 2}" y="${h - c.y - (c.h || 0) / 2}" font-size="${font * 0.8}">${esc(c.label)}</text>` : ""}`).join("");
  const bends = part.bends.map((b) => `<line class="bend" x1="${b.x1}" y1="${h - b.y1}" x2="${b.x2}" y2="${h - b.y2}"/>`).join("");
  const dimY = h + pad * 0.55;
  const dimX = -pad * 0.45;

  svg.innerHTML = `
    <path class="sheet" d="${sheet}" fill-rule="evenodd"/>
    ${bendZone}${bends}${cutouts}
    <g class="dim">
      <line x1="0" y1="${dimY}" x2="${w}" y2="${dimY}"/><line x1="0" y1="${h + pad * 0.3}" x2="0" y2="${dimY + pad * 0.1}"/>
      <line x1="${w}" y1="${h + pad * 0.3}" x2="${w}" y2="${dimY + pad * 0.1}"/>
      <text x="${w / 2}" y="${dimY - font * 0.4}" font-size="${font}">${fmt(w)} ${u()}</text>
      <line x1="${dimX}" y1="0" x2="${dimX}" y2="${h}"/><line x1="${-pad * 0.3}" y1="0" x2="${dimX - pad * 0.1}" y2="0"/>
      <line x1="${-pad * 0.3}" y1="${h}" x2="${dimX - pad * 0.1}" y2="${h}"/>
      <text x="${dimX - font * 0.4}" y="${h / 2}" font-size="${font}" transform="rotate(-90 ${dimX - font * 0.4} ${h / 2})">${fmt(h)} ${u()}</text>
    </g>`;

  renderMetrics(part);
  renderChecks(issues);
  save();
}

function renderMetrics(part) {
  const m = metrics(part, { t: state.t, density: MATERIALS[state.material], units: u() });
  const mass = u() === "in" ? `${(m.grams / 28.3495).toFixed(2)} oz` : `${m.grams.toFixed(1)} g`;
  const rows = [
    ["Flat size", `${fmt(m.width)} × ${fmt(m.height)} ${u()}`],
    ["Cut length", `${fmt(m.cutLength)} ${u()}`],
    ["Pierces", m.pierces],
    ["Mass", mass],
  ];
  if (part.info.bendAllowance) rows.push(["Bend allowance", `${fmt(part.info.bendAllowance)} ${u()}`]);
  $("metrics").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

function renderChecks(issues) {
  const errors = issues.filter((i) => i.level === "error").length;
  $("check-summary").textContent = issues.length
    ? `${errors ? `${errors} error${errors > 1 ? "s" : ""}` : ""}${errors && issues.length > errors ? ", " : ""}${issues.length > errors ? `${issues.length - errors} warning${issues.length - errors > 1 ? "s" : ""}` : ""}`
    : "All clear";
  $("check-summary").dataset.level = errors ? "error" : issues.length ? "warn" : "ok";
  $("checks").innerHTML = issues.length
    ? issues.map((i) => `<li class="${i.level}"><span aria-hidden="true">${i.level === "error" ? "✕" : "!"}</span>${esc(i.msg)}</li>`).join("")
    : `<li class="ok"><span aria-hidden="true">✓</span>No issues against the rules of thumb for ${fmt(state.t)} ${u()} material.</li>`;
}

function render() { renderControls(); renderPreview(); }

// ---------- interactions ----------

$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-template]");
  if (b) { state.template = b.dataset.template; render(); }
});

$("fields").addEventListener("input", (e) => {
  const key = e.target.dataset.key;
  const v = parseFloat(e.target.value);
  if (key && Number.isFinite(v)) { current()[key] = v; renderPreview(); }
});

$("t").addEventListener("input", (e) => {
  const v = parseFloat(e.target.value);
  if (v > 0) { state.t = v; renderPreview(); }
});
$("material").addEventListener("change", (e) => { state.material = e.target.value; renderPreview(); });

/** Scale one template's length params (and panel cutouts) by f, rounding for the target units. */
function scaleTemplate(name, p, f, units) {
  const places = units === "in" ? 1000 : 10;
  const round = (v) => Math.round(v * f * places) / places;
  for (const [k, , o] of TEMPLATES[name].fields) if (o.len) p[k] = round(p[k]);
  for (const it of p.items || []) for (const k of ["x", "y", "w", "h", "d", "r"]) if (it[k] !== undefined) it[k] = round(it[k]);
  return p;
}

$("units").addEventListener("change", (e) => {
  const to = e.target.value;
  if (to === u()) return;
  const f = to === "in" ? 1 / MM_PER_IN : MM_PER_IN;
  for (const name of Object.keys(TEMPLATES)) scaleTemplate(name, state.params[name], f, to);
  state.t = Math.round(state.t * f * (to === "in" ? 1000 : 10)) / (to === "in" ? 1000 : 10);
  state.units = to;
  render();
});

$("item-list").addEventListener("input", (e) => {
  const row = e.target.closest("[data-i]");
  const key = e.target.dataset.ikey;
  if (!row || !key) return;
  const it = current().items[Number(row.dataset.i)];
  if (key === "label") it.label = e.target.value;
  else { const v = parseFloat(e.target.value); if (Number.isFinite(v)) it[key] = v; }
  renderPreview();
});
$("item-list").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  if (!del) return;
  current().items.splice(Number(del.dataset.del), 1);
  render();
});
function addItem(type) {
  const p = current();
  const id = Math.max(0, ...p.items.map((i) => i.id)) + 1;
  const s = u() === "in" ? 1 / MM_PER_IN : 1;
  const base = { id, x: p.w / 2, y: p.h / 2 };
  p.items.push(type === "rect"
    ? { ...base, label: `Cutout ${id}`, type, w: +(60 * s).toFixed(3), h: +(40 * s).toFixed(3), r: +(3 * s).toFixed(3) }
    : { ...base, label: `Hole ${id}`, type: "round", d: +(20 * s).toFixed(3) });
  render();
}
$("add-round").addEventListener("click", () => addItem("round"));
$("add-rect").addEventListener("click", () => addItem("rect"));

// Drag panel cutouts. Pointer capture stays on the persistent <svg>; only its contents re-render.
const svg = $("preview");
let drag = null;
function toPart(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: p.x, y: current().h - p.y };
}
svg.addEventListener("pointerdown", (e) => {
  const el = e.target.closest(".draggable");
  if (!el || state.template !== "panel") return;
  const it = current().items[Number(el.dataset.i)];
  const p = toPart(e);
  drag = { it, dx: it.x - p.x, dy: it.y - p.y };
  svg.setPointerCapture(e.pointerId);
  svg.classList.add("dragging");
  e.preventDefault();
});
svg.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const snap = u() === "in" ? 0.05 : 1;
  const p = toPart(e);
  drag.it.x = Math.round((p.x + drag.dx) / snap) * snap;
  drag.it.y = Math.round((p.y + drag.dy) / snap) * snap;
  drag.it.x = +drag.it.x.toFixed(3); drag.it.y = +drag.it.y.toFixed(3);
  renderPreview();
});
const endDrag = () => { if (drag) { drag = null; svg.classList.remove("dragging"); renderItems(); } };
svg.addEventListener("pointerup", endDrag);
svg.addEventListener("pointercancel", endDrag);

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("dxf").addEventListener("click", () => download(`part-${state.template}.dxf`, toDXF(build(), u()), "application/dxf"));
$("svg").addEventListener("click", () => download(`part-${state.template}.svg`, toSVG(build(), u()), "image/svg+xml"));
$("reset").addEventListener("click", () => {
  const fresh = structuredClone(DEFAULTS.params[state.template]);
  state.params[state.template] = u() === "in" ? scaleTemplate(state.template, fresh, 1 / MM_PER_IN, "in") : fresh;
  render();
});

render();
