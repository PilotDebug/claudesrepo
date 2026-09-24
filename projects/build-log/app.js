import { ASSEMBLIES, fromCSV, normalize, summarize, toCSV } from "./log.js";

const STORE = "kit-build-log";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hrs = (n) => (Math.round(n * 100) / 100).toLocaleString();
const today = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD

let entries = load();

function load() {
  try { return (JSON.parse(localStorage.getItem(STORE)) || []).map((e) => normalize(e)).filter(Boolean); }
  catch { return []; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(entries)); return true; }
  catch { return false; }
}

// ---------- charts (single series: one hue, no legend, hover tooltips) ----------

const tip = $("tip");
function bindTips(root) {
  for (const el of root.querySelectorAll("[data-tip]")) {
    const show = () => {
      tip.innerHTML = el.dataset.tip;
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      tip.style.left = `${Math.min(innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2))}px`;
      tip.style.top = `${r.top - t.height - 8 + scrollY}px`;
    };
    el.addEventListener("pointerenter", show);
    el.addEventListener("focus", show);
    el.addEventListener("pointerleave", () => (tip.hidden = true));
    el.addEventListener("blur", () => (tip.hidden = true));
  }
}

function renderAssemblies(rows, total) {
  const root = $("by-assembly");
  if (!rows.length) { root.innerHTML = `<p class="empty">No sessions yet.</p>`; return; }
  const max = rows[0].hours;
  root.innerHTML = rows.map((r) => `
    <div class="hbar" tabindex="0" data-tip="<b>${esc(r.assembly)}</b><br>${hrs(r.hours)} h · ${r.sessions} session${r.sessions > 1 ? "s" : ""} · ${Math.round((r.hours / total) * 100)}% of build">
      <span class="label">${esc(r.assembly)}</span>
      <span class="track"><span class="fill" style="width:${(r.hours / max) * 100}%"></span></span>
      <span class="value">${hrs(r.hours)}</span>
    </div>`).join("");
  bindTips(root);
}

function renderWeeks(weeks) {
  const root = $("by-week");
  const max = Math.max(...weeks.map((w) => w.hours), 1);
  const fmt = (d) => new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  root.innerHTML = `
    <div class="plot">${weeks.map((w, i) => `
      <div class="col" tabindex="0" data-tip="Week of <b>${fmt(w.start)}</b><br>${hrs(w.hours)} h">
        <span class="fill" style="height:${(w.hours / max) * 100}%"></span>
        <span class="tick">${i % 3 === weeks.length % 3 - 1 || i === weeks.length - 1 ? fmt(w.start) : ""}</span>
      </div>`).join("")}
    </div>
    <p class="axis-note">Peak ${hrs(max)} h/week</p>`;
  bindTips(root);
}

function renderTable() {
  const root = $("table");
  if (!entries.length) {
    root.innerHTML = `<div class="empty">
      <p>Nothing logged yet. Add your first session above, import a CSV, or</p>
      <button type="button" id="sample">Load sample data</button></div>`;
    $("sample").addEventListener("click", loadSample);
    return;
  }
  const rows = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  root.innerHTML = `<table>
    <thead><tr><th>Date</th><th>Assembly</th><th class="num">Hours</th><th>Notes</th><th></th></tr></thead>
    <tbody>${rows.map((e) => `<tr>
      <td>${e.date}</td><td>${esc(e.assembly)}</td><td class="num">${hrs(e.hours)}</td>
      <td class="note">${esc(e.note)}</td>
      <td><button type="button" class="del" data-id="${esc(e.id)}" aria-label="Delete session">×</button></td>
    </tr>`).join("")}</tbody></table>`;
  for (const b of root.querySelectorAll(".del")) {
    b.addEventListener("click", () => {
      entries = entries.filter((e) => e.id !== b.dataset.id);
      save(); render();
    });
  }
}

function render() {
  const s = summarize(entries, today());
  $("total").textContent = hrs(s.total);
  $("week").textContent = hrs(s.thisWeek);
  $("sessions").textContent = s.sessions;
  $("avg").textContent = s.sessions ? hrs(s.total / s.sessions) : "—";
  renderAssemblies(s.byAssembly, s.total);
  renderWeeks(s.weeks);
  renderTable();
}

// ---------- actions ----------

function loadSample() {
  // In build order, oldest first: sessions drift from planning to tail to wings.
  const notes = {
    "Research & planning": ["Read manual section, planned jigs", "Inventory of kit shipment"],
    "Tail feathers": ["Deburred rudder skins", "Riveted elevator spar", "Primed stabilizer parts"],
    "Flaps & ailerons": ["Assembled flap ribs", "Fit aileron hinge brackets"],
    Wings: ["Fluted ribs", "Match-drilled spar doublers", "Clecoed leading edge skins"],
  };
  const names = Object.keys(notes);
  const now = Date.parse(today() + "T00:00:00Z");
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  entries = Array.from({ length: 34 }, (_, i) => {
    const assembly = names[Math.min(names.length - 1, Math.floor((i / 34) * names.length + rand() * 0.8))];
    const date = new Date(now - Math.floor((34 - i) * 2.4 + rand() * 2) * 86_400_000).toISOString().slice(0, 10);
    const list = notes[assembly];
    return normalize({ date, assembly, hours: 0.5 + Math.round(rand() * 14) / 4, note: `${list[i % list.length]} (sample)` });
  });
  save(); render();
}

$("add").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const entry = normalize(Object.fromEntries(new FormData(form)));
  if (!entry) { $("form-msg").textContent = "Check the date, assembly, and hours (0.25–24)."; return; }
  entries.push(entry);
  $("form-msg").textContent = save() ? `Logged ${hrs(entry.hours)} h on ${entry.assembly}.`
    : "Logged, but this browser won't let the page save — export a CSV before leaving.";
  form.elements.hours.value = ""; form.elements.note.value = "";
  form.elements.hours.focus();
  render();
});

$("export").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([toCSV(entries)], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `build-log-${today()}.csv` });
  a.click();
  URL.revokeObjectURL(url);
});

$("import").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const incoming = fromCSV(await file.text());
  const seen = new Set(entries.map((e) => `${e.date}|${e.assembly}|${e.hours}|${e.note}`));
  const fresh = incoming.filter((e) => !seen.has(`${e.date}|${e.assembly}|${e.hours}|${e.note}`));
  entries.push(...fresh);
  save(); render();
  $("form-msg").textContent = `Imported ${fresh.length} session${fresh.length === 1 ? "" : "s"}` +
    (incoming.length > fresh.length ? ` (${incoming.length - fresh.length} duplicates skipped).` : ".");
  ev.target.value = "";
});

$("assemblies").innerHTML = ASSEMBLIES.map((a) => `<option value="${esc(a)}">`).join("");
$("add").elements.date.value = today();
render();
