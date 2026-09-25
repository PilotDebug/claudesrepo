import { FAULTS, MODES, simulate } from "./voter.js";

const STORE = "fc-voter";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const NONE = { type: "none", start: 8, magnitude: 10 };

const PRESETS = {
  bias: { label: "Master's IMU biased", faults: [{ type: "bias", start: 8, magnitude: 10 }, NONE, NONE] },
  drift: { label: "Slow drift on FC3", faults: [NONE, NONE, { type: "drift", start: 6, magnitude: 0.8 }] },
  stuck: { label: "Master freezes", faults: [{ type: "stuck", start: 10, magnitude: 0 }, NONE, NONE] },
  dies: { label: "Master goes silent", faults: [{ type: "dropout", start: 12, magnitude: 0 }, NONE, NONE] },
  double: { label: "Two faults", faults: [{ type: "dropout", start: 10, magnitude: 0 }, { type: "bias", start: 18, magnitude: 8 }, NONE] },
  clean: { label: "Clean flight", faults: [NONE, NONE, NONE] },
};
const MAG_UNITS = { bias: "°", drift: "°/s", noise: "° σ" };

let state = load();
function load() {
  const base = { preset: "bias", mode: "median", threshold: 3, persist: 0.2, faults: structuredClone(PRESETS.bias.faults) };
  try { return { ...base, ...JSON.parse(localStorage.getItem(STORE)) }; } catch { return base; }
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ } }
const config = (mode = state.mode) => ({ mode, faults: state.faults, threshold: state.threshold, persist: state.persist });

// ---------- controls ----------

function renderControls() {
  $("presets").innerHTML = Object.entries(PRESETS).map(([k, p]) =>
    `<button type="button" class="chip" data-preset="${k}" aria-pressed="${state.preset === k}">${esc(p.label)}</button>`).join("");
  $("modes").innerHTML = Object.entries(MODES).map(([k, label]) =>
    `<button type="button" data-mode="${k}" aria-pressed="${state.mode === k}">${esc(label)}</button>`).join("");
  $("threshold").value = state.threshold;
  $("persist").value = state.persist;
  $("faults").innerHTML = state.faults.map((f, i) => `
    <div class="fault f${i}" data-i="${i}">
      <span class="fc"><i class="sw" aria-hidden="true"></i>FC${i + 1}</span>
      <select data-k="type" aria-label="FC${i + 1} fault">${Object.entries(FAULTS).map(([k, l]) =>
        `<option value="${k}" ${k === f.type ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      <label ${f.type === "none" ? "hidden" : ""}>at <input data-k="start" type="number" min="0" max="29" step="0.5" value="${f.start}"> s</label>
      <label ${MAG_UNITS[f.type] ? "" : "hidden"}>size <input data-k="magnitude" type="number" step="0.1" value="${f.magnitude}"> ${MAG_UNITS[f.type] || ""}</label>
    </div>`).join("");
}

// ---------- charts ----------

const C = { W: 760, H: 300, l: 44, r: 16, t: 26, b: 28 };
const E = { H: 110, t: 10, b: 24 };
const X = (t, dur) => C.l + (t / dur) * (C.W - C.l - C.r);

function polyline(ts, vs, y, dur, cls, keep = () => true) {
  // Break the line wherever a value is missing or filtered out.
  const parts = [];
  let cur = [];
  for (let k = 0; k < ts.length; k++) {
    if (Number.isFinite(vs[k]) && keep(k)) cur.push(`${X(ts[k], dur).toFixed(1)},${y(vs[k]).toFixed(1)}`);
    else if (cur.length) { parts.push(cur); cur = []; }
  }
  if (cur.length) parts.push(cur);
  return parts.map((p) => `<polyline class="${cls}" points="${p.join(" ")}"/>`).join("");
}

function renderChart(run) {
  const { t, truth, fc, out, healthy } = run.series;
  const dur = t.at(-1);
  const all = [...truth, ...out, ...fc.flat()].filter(Number.isFinite);
  const lim = Math.min(60, Math.ceil(Math.max(35, ...all.map(Math.abs)) / 10) * 10);
  const y = (v) => C.t + (1 - (Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim)) * (C.H - C.t - C.b);

  const grid = [];
  for (let v = -lim; v <= lim; v += lim / 2) {
    grid.push(`<line class="grid" x1="${C.l}" x2="${C.W - C.r}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${C.l - 6}" y="${y(v)}" text-anchor="end" dominant-baseline="central">${v}°</text>`);
  }
  for (let s = 0; s <= dur; s += 5) grid.push(`<text class="tick" x="${X(s, dur)}" y="${C.H - 8}" text-anchor="middle">${s}s</text>`);

  const fcs = fc.map((vals, i) =>
    polyline(t, vals, y, dur, `fcline f${i}`, (k) => healthy[i][k]) +
    polyline(t, vals, y, dur, `fcline f${i} dropped`, (k) => !healthy[i][k])).join("");

  const events = run.events.map((e) => `
    <line class="event ${e.kind}" x1="${X(e.t, dur)}" x2="${X(e.t, dur)}" y1="${C.t}" y2="${C.H - C.b}"/>
    <text class="event-label" x="${Math.min(X(e.t, dur) + 4, C.W - C.r - 90)}" y="${C.t - 8}">${e.kind === "warn" ? "⚠ no majority" : e.kind === "switch" ? `→ FC${e.fc + 1}` : `✕ FC${e.fc + 1}`}</text>`).join("");

  $("chart").innerHTML = `${grid.join("")}
    <line class="axis" x1="${C.l}" x2="${C.W - C.r}" y1="${y(0)}" y2="${y(0)}"/>
    ${fcs}
    ${polyline(t, truth, y, dur, "truth")}
    ${polyline(t, out, y, dur, "out")}
    ${events}
    <line id="cross" class="cross" y1="${C.t}" y2="${C.H - C.b}" visibility="hidden"/>
    <rect id="hit" x="${C.l}" y="${C.t}" width="${C.W - C.l - C.r}" height="${C.H - C.t - C.b}" fill="transparent"/>`;

  // Error strip: |output − truth| against the threshold.
  const err = out.map((o, k) => Math.abs(o - truth[k]));
  const emax = Math.max(state.threshold * 2, Math.min(40, Math.max(...err)));
  const ey = (v) => E.t + (1 - Math.min(v, emax) / emax) * (E.H - E.t - E.b);
  const area = `M${X(0, dur)},${ey(0)} ` + err.map((v, k) => `L${X(t[k], dur).toFixed(1)},${ey(v).toFixed(1)}`).join(" ") + ` L${X(dur, dur)},${ey(0)} Z`;
  $("errors").innerHTML = `
    <line class="grid" x1="${C.l}" x2="${C.W - C.r}" y1="${ey(0)}" y2="${ey(0)}"/>
    <path class="err" d="${area}"/>
    <line class="thresh" x1="${C.l}" x2="${C.W - C.r}" y1="${ey(state.threshold)}" y2="${ey(state.threshold)}"/>
    <text class="tick" x="${C.l - 6}" y="${ey(state.threshold)}" text-anchor="end" dominant-baseline="central">${state.threshold}°</text>
    <text class="tick" x="${C.W - C.r}" y="${ey(state.threshold) - 5}" text-anchor="end">tolerance</text>
    ${[0, 10, 20, 30].map((s) => `<text class="tick" x="${X(s, dur)}" y="${E.H - 6}" text-anchor="middle">${s}s</text>`).join("")}`;

  bindHover(run, dur);
}

function bindHover(run, dur) {
  const svg = $("chart"), tip = $("tip"), cross = $("cross");
  const { t, truth, fc, out, healthy } = run.series;
  $("hit").addEventListener("pointermove", (e) => {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const loc = p.matrixTransform(svg.getScreenCTM().inverse());
    const k = Math.max(0, Math.min(t.length - 1, Math.round(((loc.x - C.l) / (C.W - C.l - C.r)) * (t.length - 1))));
    cross.setAttribute("x1", X(t[k], dur)); cross.setAttribute("x2", X(t[k], dur)); cross.setAttribute("visibility", "visible");
    const v = (n) => (Number.isFinite(n) ? `${n.toFixed(1)}°` : "no data");
    tip.innerHTML = `<b>t = ${t[k].toFixed(2)} s</b>
      <div><i class="sw out"></i>Output<b>${v(out[k])}</b></div>
      <div><i class="sw truth"></i>Actual roll<b>${v(truth[k])}</b></div>
      ${fc.map((vals, i) => `<div class="${healthy[i][k] ? "" : "gone"}"><i class="sw f${i}"></i>FC${i + 1}${healthy[i][k] ? "" : " (dropped)"}<b>${v(vals[k])}</b></div>`).join("")}`;
    tip.hidden = false;
    const box = svg.getBoundingClientRect(), tb = tip.getBoundingClientRect();
    const px = ((X(t[k], dur)) / C.W) * box.width;
    tip.style.left = `${px + 14 + tb.width > box.width ? px - tb.width - 14 : px + 14}px`;
  });
  $("hit").addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
}

// ---------- results ----------

const s1 = (n) => `${n.toFixed(1)}`;
function caught(run) {
  const d = run.metrics.detections;
  if (!d.length) return "—";
  return d.map((x) => `FC${x.fc + 1}: ${x.detectedAfter === null ? "missed" : `${x.detectedAfter.toFixed(2)} s`}`).join(", ");
}

function renderResults(run) {
  const m = run.metrics;
  const tone = m.outOfTolerance > 0.5 ? "bad" : m.outOfTolerance > 0 ? "warn" : "ok";
  $("metrics").innerHTML = `
    <div class="${tone}"><dt>Time outside tolerance</dt><dd>${s1(m.outOfTolerance)} s</dd></div>
    <div><dt>Max output error</dt><dd>${s1(m.maxError)}°</dd></div>
    <div><dt>RMS error</dt><dd>${m.rms.toFixed(2)}°</dd></div>
    <div><dt>Faults caught after</dt><dd class="small">${caught(run)}</dd></div>`;

  $("log").innerHTML = run.events.length
    ? run.events.map((e) => `<li class="${e.kind}"><time>${e.t.toFixed(2)} s</time>${esc(e.msg)}</li>`).join("")
    : `<li class="quiet"><time>—</time>${state.mode === "master" ? "No failover: the heartbeat never stopped, so FC1 stayed in charge." : "No events: every FC stayed in the vote."}</li>`;

  const both = Object.keys(MODES).map((mode) => [mode, mode === state.mode ? run : simulate(config(mode))]);
  $("compare").innerHTML = `
    <thead><tr><th>Strategy</th><th class="num">Outside tolerance</th><th class="num">Max error</th><th>Faults caught</th></tr></thead>
    <tbody>${both.map(([mode, r]) => `<tr class="${mode === state.mode ? "current" : ""}">
      <td>${esc(MODES[mode])}</td><td class="num">${s1(r.metrics.outOfTolerance)} s</td>
      <td class="num">${s1(r.metrics.maxError)}°</td><td>${caught(r)}</td></tr>`).join("")}</tbody>`;
}

function run() {
  const r = simulate(config());
  renderChart(r);
  renderResults(r);
  save();
}

// ---------- wiring ----------

$("presets").addEventListener("click", (e) => {
  const b = e.target.closest("[data-preset]");
  if (!b) return;
  state.preset = b.dataset.preset;
  state.faults = structuredClone(PRESETS[state.preset].faults);
  renderControls(); run();
});
$("modes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (b) { state.mode = b.dataset.mode; renderControls(); run(); }
});
$("threshold").addEventListener("input", (e) => { state.threshold = Number(e.target.value); $("threshold-val").textContent = `${state.threshold}°`; run(); });
$("persist").addEventListener("input", (e) => { state.persist = Number(e.target.value); $("persist-val").textContent = `${Math.round(state.persist * 1000)} ms`; run(); });
$("faults").addEventListener("input", (e) => {
  const row = e.target.closest("[data-i]");
  const k = e.target.dataset.k;
  if (!row || !k) return;
  const f = state.faults[Number(row.dataset.i)];
  f[k] = k === "type" ? e.target.value : Number(e.target.value);
  state.preset = null;
  if (k === "type") renderControls();
  else $("presets").querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  run();
});

renderControls();
$("threshold-val").textContent = `${state.threshold}°`;
$("persist-val").textContent = `${Math.round(state.persist * 1000)} ms`;
run();
