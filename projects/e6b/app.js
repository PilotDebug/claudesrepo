import {
  compass, densityAltitude, isaTemp, pressureAltitude, runwayHeading, windComponents, windTriangle,
} from "./e6b.js";

const STORE = "e6b-inputs";
const fmt = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : "—";
const pad3 = (n) => String(compass(n)).padStart(3, "0");
const row = (label, value, note = "") =>
  `<div><dt>${label}</dt><dd>${value}${note ? `<small>${note}</small>` : ""}</dd></div>`;

function values(form) {
  return Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v === "" ? NaN : Number(v)]));
}

// ---------- crosswind ----------

const polar = (bearing, r) => [120 + r * Math.sin((bearing * Math.PI) / 180), 120 - r * Math.cos((bearing * Math.PI) / 180)];

function drawRunway(hdg, windDir, windSpeed) {
  const svg = document.getElementById("xw-diagram");
  const num = (h) => String(Math.round(compass(h) / 10)).padStart(2, "0");
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const [x1, y1] = polar(i * 10, 108), [x2, y2] = polar(i * 10, i % 9 ? 102 : 96);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="tick"/>`;
  }).join("");
  const cardinal = [["N", 0], ["E", 90], ["S", 180], ["W", 270]]
    .map(([t, b]) => { const [x, y] = polar(b, 86); return `<text x="${x}" y="${y}" class="cardinal">${t}</text>`; }).join("");

  // Each runway's number is painted at the threshold you land over, i.e. the
  // opposite end from where it points. Drawn upright so it always reads.
  const ends = [[hdg, hdg + 180], [hdg + 180, hdg]].map(([rwy, at]) => {
    const [x, y] = polar(at, 57);
    return `<text x="${x}" y="${y}" class="rwy-num">${num(rwy)}</text>`;
  }).join("");

  let wind = "";
  if (windSpeed > 0 && Number.isFinite(windDir)) {
    const len = Math.min(70, 25 + windSpeed * 1.5);
    const [x1, y1] = polar(windDir, 30 + len), [x2, y2] = polar(windDir, 30);
    wind = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wind" marker-end="url(#head)"/>`;
  }

  svg.innerHTML = `
    <defs><marker id="head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" class="wind-head"/></marker></defs>
    <circle cx="120" cy="120" r="108" class="ring"/>${ticks}${cardinal}
    <g transform="rotate(${hdg} 120 120)">
      <rect x="106" y="50" width="28" height="140" rx="3" class="runway"/>
      <line x1="120" y1="68" x2="120" y2="172" class="centerline"/>
    </g>${ends}${wind}`;
}

function crosswind(v) {
  const hdg = runwayHeading(document.querySelector('[name="rwy"]').value);
  const out = document.getElementById("xw-out");
  if (hdg == null || !Number.isFinite(v.wdir) || !Number.isFinite(v.wspd)) {
    out.innerHTML = row("Enter a runway (e.g. 27) and wind", "—");
    return;
  }
  const w = windComponents(hdg, v.wdir, v.wspd);
  drawRunway(hdg, v.wdir, v.wspd);
  const gust = Number.isFinite(v.gust) && v.gust > v.wspd ? windComponents(hdg, v.wdir, v.gust) : null;
  out.innerHTML =
    row(w.headwind >= 0 ? "Headwind" : "Tailwind", `${fmt(Math.abs(w.headwind))} kt`,
        gust ? `gusting ${fmt(Math.abs(gust.headwind))}` : "") +
    row("Crosswind", `${fmt(w.crosswind)} kt`,
        (w.side === "none" ? "straight down the runway" : `from the ${w.side}`) +
        (gust ? ` · gusting ${fmt(gust.crosswind)}` : "")) +
    row("Wind angle", `${fmt(Math.abs(w.angle))}°`, `runway heading ${pad3(hdg)}°`);
  out.classList.toggle("warn", w.headwind < 0);
}

// ---------- density altitude ----------

function density(v) {
  const out = document.getElementById("da-out");
  const pa = pressureAltitude(v.elev, v.alt);
  const da = densityAltitude(pa, v.oat);
  const delta = da - v.elev;
  out.innerHTML =
    row("Density altitude", `${fmt(Math.round(da / 10) * 10)} ft`,
        Number.isFinite(delta) ? `${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))} ft vs field` : "") +
    row("Pressure altitude", `${fmt(pa)} ft`) +
    row("ISA temperature", `${fmt(isaTemp(pa), 1)} °C`, `OAT is ${fmt(v.oat - isaTemp(pa), 1)} °C off standard`);
  // Meter: how far DA sits above field elevation, 0 → 5000 ft.
  const pct = Math.max(0, Math.min(100, (delta / 5000) * 100));
  const meter = document.getElementById("da-meter");
  meter.firstElementChild.style.width = `${Number.isFinite(pct) ? pct : 0}%`;
  meter.dataset.level = delta > 3000 ? "high" : delta > 1500 ? "mid" : "low";
}

// ---------- wind triangle ----------

function triangle(v) {
  const out = document.getElementById("wt-out");
  const r = windTriangle(v.tc, v.tas, v.wdir, v.wspd);
  if (!r) { out.innerHTML = row("Wind too strong for this course and airspeed", "—"); return; }
  const minutes = (v.dist / r.groundSpeed) * 60;
  out.innerHTML =
    row("Heading", `${pad3(r.heading)}°`, `${fmt(Math.abs(r.wca), 1)}° ${r.wca < 0 ? "left" : "right"} correction`) +
    row("Groundspeed", `${fmt(r.groundSpeed)} kt`, `${r.groundSpeed >= v.tas ? "+" : "−"}${fmt(Math.abs(r.groundSpeed - v.tas))} kt vs TAS`) +
    (Number.isFinite(minutes) && v.dist > 0
      ? row("Time enroute", `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, "0")}`, `${fmt(v.dist)} nm`)
      : "");
}

// ---------- wiring ----------

const CALCS = { xw: crosswind, da: density, wt: triangle };

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save() {
  const all = {};
  for (const form of document.querySelectorAll("form[data-calc]")) {
    all[form.dataset.calc] = Object.fromEntries(new FormData(form));
  }
  try { localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* private mode */ }
}

const saved = load();
for (const form of document.querySelectorAll("form[data-calc]")) {
  const key = form.dataset.calc;
  for (const [name, value] of Object.entries(saved[key] || {})) {
    if (form.elements[name]) form.elements[name].value = value;
  }
  const update = () => { CALCS[key](values(form)); save(); };
  form.addEventListener("input", update);
  form.addEventListener("submit", (e) => e.preventDefault());
  update();
}
