import { normalizeRows, sumFields, HOUR_FIELDS, COUNT_FIELDS, ALL_FIELDS } from "./normalize.js";
import { rowIssues, pageTotalsCheck, suspectRows, LABELS } from "./checks.js";
import { buildForeFlightCsv, deriveAircraft, EQUIPMENT_TYPES, CLASSES, GEAR_TYPES, ENGINE_TYPES } from "./foreflight.js";
import { MODELS, PLAN, PAGE_SCHEMA, buildPrompt, parseExtraction, estimateCost, tileRects } from "./extract.js";
import { SAMPLE_PAGES } from "./sample.js";

const STORE = "ferry-flight:v1";
const KEY_STORE = "ferry-flight:key";
const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n) => (Math.round((n || 0) * 10) / 10).toFixed(1);

// Columns always shown in review; the rest appear once any row or totals line uses them.
const CORE = ["date", "tail", "makeModel", "from", "to", "remarks", "total", "pic", "dual"];
const ORDER = ["date", "tail", "makeModel", "from", "via", "to", "remarks", "instructor", "total", "pic", "dual", "solo",
  "xc", "night", "actual", "hood", "sim", "cfi", "sic", "asel", "amel", "ases", "ames", "landingsDay", "landingsNight", "landings", "approaches"];
const NUMERIC = new Set([...HOUR_FIELDS, ...COUNT_FIELDS]);

let state = { settings: { style: "jeppesen", year: "", model: "claude-opus-5" }, pages: [], aircraft: {} };
let apiKey = "";
const images = new Map(); // page id → { url, file } — photos stay in memory only
let computed = { pages: [], rows: [] };
let aircraftKey = "";

// ---------- persistence ----------
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || "null");
    if (s && Array.isArray(s.pages)) state = { ...state, ...s, settings: { ...state.settings, ...s.settings } };
    state.pages = state.pages.filter((p) => p.extraction); // photos don't survive a reload
    apiKey = localStorage.getItem(KEY_STORE) || "";
  } catch { /* ignore */ }
}

// ---------- settings ----------
const form = $("#settings");
form.model.innerHTML = Object.entries(MODELS).map(([v, t]) => `<option value="${v}"${v === PLAN ? " hidden disabled" : ""}>${esc(t)}</option>`).join("");
function initSettings() {
  form.style.value = state.settings.style;
  form.year.value = state.settings.year;
  if (state.settings.model === PLAN && !plan) state.settings.model = "claude-opus-5";
  form.model.value = state.settings.model;
  form.key.value = apiKey;
  form.remember.checked = !!apiKey;
  showReaderFields();
}
function showReaderFields() {
  const usePlan = form.model.value === PLAN;
  for (const el of document.querySelectorAll(".api-only")) el.hidden = usePlan;
  $("#plan-note").hidden = !usePlan;
}

// Inside Claude, the page can read photos on the viewer's own Claude plan (no API key).
let plan = null;
let downloads = null;
if (window.claude?.use) {
  window.claude.use("sample").then(async (s) => {
    const limits = s && (await s.limits().catch(() => null));
    if (!limits?.images) return;
    plan = { sample: s, maxImages: limits.images.maxCount };
    // Inside Claude the page can't reach the API directly, so the plan is the only reader.
    for (const opt of form.model.options) opt.hidden = opt.disabled = opt.value !== PLAN;
    state.settings.model = PLAN;
    save();
    initSettings();
    renderPages();
  });
  window.claude.use("downloads").then((d) => { downloads = d; });
}
form.addEventListener("input", () => {
  state.settings = { style: form.style.value, year: form.year.value.replace(/\D/g, ""), model: form.model.value };
  apiKey = form.key.value.trim();
  try {
    if (form.remember.checked && apiKey) localStorage.setItem(KEY_STORE, apiKey);
    else localStorage.removeItem(KEY_STORE);
  } catch { /* ignore */ }
  save();
  showReaderFields();
  renderPages();
  refresh();
});

// ---------- pages ----------
function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const id = uid();
    images.set(id, { url: URL.createObjectURL(file), file });
    state.pages.push({ id, name: file.name, status: "queued" });
  }
  save();
  renderPages();
}
$("#files").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
const drop = $("#drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); });

const pendingPages = () => state.pages.filter((p) => images.has(p.id) && (p.status === "queued" || p.status === "error"));

function renderPages() {
  $("#pages").innerHTML = state.pages.map((p, i) => {
    const img = images.get(p.id);
    const status = { queued: "Waiting", reading: "Reading…", done: `${p.extraction?.rows.length ?? 0} rows`, error: p.error || "Failed" }[p.status] || "";
    return `<li data-id="${p.id}" class="${p.status}">
      ${img ? `<button type="button" class="thumb" data-act="view"><img src="${img.url}" alt=""></button>` : `<span class="thumb none">${i + 1}</span>`}
      <span class="pname">${esc(p.name)}</span><span class="pstatus">${esc(status)}</span>
      <button type="button" class="x" data-act="remove" aria-label="Remove ${esc(p.name)}">×</button></li>`;
  }).join("");
  const n = pendingPages().length;
  const btn = $("#read");
  btn.disabled = !n || reading;
  const cost = state.settings.model === PLAN ? "on your Claude plan" : `≈ $${estimateCost(n, state.settings.model).toFixed(2)}`;
  btn.textContent = n ? `Read ${n} page${n > 1 ? "s" : ""} (${cost})` : "Read pages";
}
$("#pages").addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  const id = e.target.closest("li")?.dataset.id;
  if (act === "view") showPhoto(id);
  if (act === "remove") removePage(id);
});

function removePage(id) {
  state.pages = state.pages.filter((p) => p.id !== id);
  images.delete(id);
  save();
  renderPages();
  renderReview();
}

$("#sample").addEventListener("click", () => {
  for (const s of SAMPLE_PAGES) state.pages.push({ id: uid(), name: s.name, status: "done", extraction: structuredClone(s.extraction) });
  if (!state.settings.year) { state.settings.year = "2019"; form.year.value = "2019"; }
  save();
  renderPages();
  renderReview();
  $("#review-card").scrollIntoView({ behavior: "smooth" });
});

// ---------- reading pages with Claude ----------
let reading = false;
async function toJpegBase64(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  return dataUrl.split(",")[1];
}

// Crop a region of the photo to a JPEG blob (the Claude-plan reader shrinks each image to
// about 1.2 MP, so zoomed halves keep the handwriting legible).
async function cropBlob(bmp, { x, y, w, h }, maxSide = 2000) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d").drawImage(bmp, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.88));
}

async function readPageWithPlan(page, yearHint) {
  const bmp = await createImageBitmap(images.get(page.id).file);
  const whole = { x: 0, y: 0, w: bmp.width, h: bmp.height };
  const { wide, tiles } = tileRects(bmp.width, bmp.height);
  const useTiles = plan.maxImages >= 3;
  const blobs = await Promise.all([whole, ...(useTiles ? tiles : [])].map((r) => cropBlob(bmp, r)));
  const prompt = buildPrompt({ style: state.settings.style, yearHint, tiled: useTiles ? wide : null, json: true });
  try {
    const data = await plan.sample.json(prompt, { images: blobs, modelTier: "complex", cache: false });
    return parseExtraction(data);
  } catch (e) {
    const why = {
      not_granted: "Allow Ferry Flight to use Claude to read pages",
      rate_limited: "Claude usage limit reached — try the rest later",
      invalid_json: "Claude's answer wasn't readable — try again",
      refused: "Claude declined this image",
      image_rejected: "Photo too large or unsupported — use a JPEG",
      session_expired: "Sign in to Claude again",
    }[e?.code];
    const err = new Error(why || e?.message || "Failed");
    err.stop = ["not_granted", "rate_limited", "session_expired", "sampling_disabled"].includes(e?.code);
    throw err;
  }
}

let clientPromise = null;
function getClient() {
  clientPromise ??= import(SDK_URL).then(({ default: Anthropic }) => Anthropic);
  return clientPromise.then((Anthropic) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true }));
}

async function readPage(page, yearHint) {
  const client = await getClient();
  const data = await toJpegBase64(images.get(page.id).file);
  const model = state.settings.model;
  const request = {
    model,
    max_tokens: 16000,
    output_config: { format: { type: "json_schema", schema: PAGE_SCHEMA } },
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
      { type: "text", text: buildPrompt({ style: state.settings.style, yearHint }) },
    ] }],
  };
  // On Opus 5, let the API retry a refused request on a fallback model instead of failing the page.
  const msg = model === "claude-opus-5"
    ? await client.beta.messages.create({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
    : await client.messages.create(request);
  if (msg.stop_reason === "refusal") throw new Error("The model declined this image");
  if (msg.stop_reason === "max_tokens") throw new Error("Page too long — try photographing one side at a time");
  const text = msg.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Empty response");
  return parseExtraction(text);
}

$("#read").addEventListener("click", async () => {
  const usePlan = state.settings.model === PLAN && plan;
  if (!usePlan && !apiKey) { $("#read-status").textContent = "Add your API key in step 1 first."; form.key.focus(); return; }
  const queue = pendingPages();
  reading = true;
  for (const p of queue) { p.status = "queued"; p.error = ""; }
  renderPages();
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const page = queue.shift();
      page.status = "reading";
      renderPages();
      try {
        page.extraction = await (usePlan ? readPageWithPlan : readPage)(page, state.settings.year);
        page.status = "done";
      } catch (err) {
        page.status = "error";
        page.error = err?.status === 401 ? "API key rejected" : err?.message?.slice(0, 120) || "Failed";
        if (err?.stop) { for (const p of queue) { p.status = "error"; p.error = "Not read yet"; } queue.length = 0; $("#read-status").textContent = page.error; }
      }
      done++;
      $("#read-status").textContent = `${done} of ${done + queue.length} read`;
      save();
      renderPages();
      renderReview();
    }
  };
  await Promise.all([worker(), worker()]);
  reading = false;
  renderPages();
});

// ---------- review ----------
function compute() {
  let ctx = { yearHint: state.settings.year || null };
  let prevIso = null;
  const pages = [];
  const rows = [];
  for (const p of state.pages) {
    if (!p.extraction) continue;
    if (!ctx.y && p.extraction.yearHint) ctx.yearHint = p.extraction.yearHint;
    const res = normalizeRows(p.extraction.rows, ctx);
    ctx = res.context;
    const issues = res.rows.map((r) => {
      const list = rowIssues(r, prevIso);
      if (r.iso) prevIso = r.iso;
      return list;
    });
    const totals = pageTotalsCheck(res.rows, p.extraction.pageTotals);
    pages.push({ page: p, rows: res.rows, issues, totals, sums: sumFields(res.rows) });
    rows.push(...res.rows);
  }
  return { pages, rows };
}

function visibleColumns() {
  const used = new Set(CORE);
  for (const p of state.pages) {
    for (const r of p.extraction?.rows || []) for (const f of ALL_FIELDS) if (r[f]) used.add(f);
    for (const [f, v] of Object.entries(p.extraction?.pageTotals || {})) if (v) used.add(f);
  }
  return ORDER.filter((f) => used.has(f));
}

function renderReview() {
  computed = compute();
  const has = computed.pages.length > 0;
  for (const id of ["#review-card", "#aircraft-card", "#export-card"]) $(id).hidden = !has;
  if (!has) return;
  const cols = visibleColumns();
  const only = $("#only-issues").checked;
  $("#review").innerHTML = computed.pages.map((cp, pi) => {
    const ex = cp.page.extraction;
    const head = cols.map((f) => `<th class="${NUMERIC.has(f) ? "num" : ""} c-${f}">${esc(LABELS[f])}</th>`).join("");
    const body = cp.rows.map((r, ri) => {
      if (only && !cp.issues[ri].length) return "";
      return `<tr><th class="rn">${ri + 1}</th>${cols.map((f) =>
        `<td class="c-${f}"><input data-p="${pi}" data-r="${ri}" data-f="${f}" value="${esc(ex.rows[ri][f])}" aria-label="Row ${ri + 1} ${esc(LABELS[f])}"${NUMERIC.has(f) ? ' inputmode="decimal"' : ""}></td>`).join("")}
        <td><button type="button" class="x" data-act="del-row" data-p="${pi}" data-r="${ri}" aria-label="Delete row ${ri + 1}">×</button></td></tr>`;
    }).join("");
    const foot = `<tr class="sum"><th class="rn" title="What the rows add up to">Σ</th>${cols.map((f) =>
      `<td class="c-${f}" data-sum="${pi}:${f}"></td>`).join("")}<td></td></tr>
      <tr class="written"><th class="rn" title="The page's own &quot;totals this page&quot; line">Page</th>${cols.map((f) =>
      NUMERIC.has(f) ? `<td class="c-${f}"><input data-p="${pi}" data-t="${f}" value="${esc(ex.pageTotals?.[f])}" aria-label="Page total ${esc(LABELS[f])}" inputmode="decimal"></td>` : `<td class="c-${f}"></td>`).join("")}<td></td></tr>`;
    const img = images.get(cp.page.id);
    return `<article class="page" data-p="${pi}">
      <header><h3>Page ${pi + 1} <small>${esc(cp.page.name)}</small></h3><span class="badge" data-badge="${pi}"></span>
        <span class="tools">${img ? `<button type="button" data-act="view" data-id="${cp.page.id}">Photo</button>` : ""}
        <button type="button" data-act="add-row" data-p="${pi}">Add row</button>
        <button type="button" data-act="del-page" data-id="${cp.page.id}">Remove page</button></span></header>
      ${ex.notes ? `<p class="hint">${esc(ex.notes)}</p>` : ""}
      <div class="scroll"><table class="grid"><thead><tr><th class="rn">#</th>${head}<th></th></tr></thead>
        <tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>
      <ul class="issues" data-issues="${pi}"></ul></article>`;
  }).join("");
  refresh(false);
}

// Update flags, badges and stats in place so typing never loses focus.
function refresh(recompute = true) {
  if (recompute) computed = compute();
  if (!computed.pages.length) return;
  let flagged = 0;
  computed.pages.forEach((cp, pi) => {
    const mism = new Set(cp.totals.mismatches.map((m) => m.field));
    document.querySelectorAll(`#review input[data-p="${pi}"][data-r]`).forEach((el) => {
      const ri = +el.dataset.r, f = el.dataset.f;
      const found = cp.issues[ri]?.filter((i) => i.field === f) || [];
      el.classList.toggle("error", found.some((i) => i.level === "error"));
      el.classList.toggle("warn", found.length > 0 && !found.some((i) => i.level === "error"));
      const r = cp.rows[ri];
      el.title = [f === "date" && r?.iso ? `Reads as ${r.iso}` : "", ...found.map((i) => i.message)].filter(Boolean).join(" · ");
      if (f === "date") el.closest("td").dataset.iso = r?.iso ? r.iso.slice(2) : "";
    });
    for (const f of Object.keys(cp.sums)) {
      const td = document.querySelector(`[data-sum="${pi}:${f}"]`);
      if (!td) continue;
      td.textContent = COUNT_FIELDS.includes(f) ? String(cp.sums[f]) : fmt(cp.sums[f]);
      td.classList.toggle("bad", mism.has(f));
      td.classList.toggle("good", cp.totals.checked.includes(f) && !mism.has(f));
    }
    const badge = document.querySelector(`[data-badge="${pi}"]`);
    if (!cp.totals.checked.length) { badge.textContent = "No page totals to check"; badge.className = "badge"; }
    else if (!mism.size) { badge.textContent = `✓ Adds up (${cp.totals.checked.length} columns)`; badge.className = "badge ok"; }
    else { badge.textContent = `${mism.size} column${mism.size > 1 ? "s" : ""} don't add up`; badge.className = "badge bad"; }
    const suspects = suspectRows(cp.rows, cp.totals.mismatches);
    const m0 = cp.totals.mismatches[0];
    const items = [
      ...(suspects.length === 1 ? [`<li class="error"><button type="button" data-go="${pi}:${suspects[0]}:${m0.field}">Row ${suspects[0] + 1}</button> is the only row with a value in every column that's off by ${fmt(Math.abs(m0.written - m0.sum))} — it's probably the misread one.</li>`] : []),
      ...cp.totals.mismatches.map((m) => `<li class="error"><b>Totals</b> ${esc(LABELS[m.field])}: rows add to ${fmt(m.sum)}, page says ${fmt(m.written)} — one of this column's cells is probably misread.</li>`),
      ...cp.issues.flatMap((list, ri) => list.map((i) => `<li class="${i.level}"><button type="button" data-go="${pi}:${ri}:${i.field}">Row ${ri + 1}</button> ${esc(i.message)}</li>`)),
    ];
    flagged += cp.issues.filter((l) => l.length).length;
    document.querySelector(`[data-issues="${pi}"]`).innerHTML = items.join("");
  });
  const rows = computed.rows;
  const t = sumFields(rows);
  $("#stats").innerHTML = [
    ["Flights", rows.length], ["Total time", fmt(t.total)], ["PIC", fmt(t.pic)], ["Dual rcvd", fmt(t.dual)],
    ["Landings", t.landings], ["Rows to check", flagged],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  renderAircraft();
}

$("#review").addEventListener("input", (e) => {
  const el = e.target;
  if (!el.matches("input[data-p]")) return;
  const ex = computed.pages[+el.dataset.p].page.extraction;
  if (el.dataset.t) { ex.pageTotals ||= {}; ex.pageTotals[el.dataset.t] = el.value; }
  else {
    const row = ex.rows[+el.dataset.r];
    row[el.dataset.f] = el.value;
    row.uncertain = (row.uncertain || []).filter((f) => f !== el.dataset.f); // edited → checked by a human
  }
  save();
  refresh();
});
$("#review").addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.go) {
    const [p, r, f] = t.dataset.go.split(":");
    const el = document.querySelector(`#review input[data-p="${p}"][data-r="${r}"][data-f="${f}"]`)
      || document.querySelector(`#review input[data-p="${p}"][data-r="${r}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "center" });
    return;
  }
  const act = t.dataset.act;
  if (act === "view") showPhoto(t.dataset.id);
  if (act === "del-page" && armed(t, "Tap again to remove")) removePage(t.dataset.id);
  if (act === "add-row" || act === "del-row") {
    const ex = computed.pages[+t.dataset.p].page.extraction;
    if (act === "add-row") ex.rows.push(Object.fromEntries([...ALL_FIELDS.map((f) => [f, ""]), ["uncertain", []]]));
    else ex.rows.splice(+t.dataset.r, 1);
    save();
    renderReview();
  }
});
$("#only-issues").addEventListener("change", renderReview);

// ---------- aircraft ----------
const AC_FIELDS = [
  ["AircraftID", "Ident"], ["Model", "Model"], ["TypeCode", "Type code"], ["Make", "Make"], ["Year", "Year"],
  ["EquipmentType", "Equipment", EQUIPMENT_TYPES], ["Class", "Class", Object.keys(CLASSES)], ["GearType", "Gear", GEAR_TYPES],
  ["EngineType", "Engine", ENGINE_TYPES], ["Complex", "Complex"], ["HighPerformance", "High perf"], ["TAA", "TAA"], ["Pressurized", "Press."],
];
function renderAircraft() {
  const list = deriveAircraft(computed.rows, state.aircraft);
  const key = list.map((a) => a.AircraftID).join("|");
  if (key === aircraftKey) return; // unchanged set of tails: leave inputs alone
  aircraftKey = key;
  $("#aircraft").innerHTML = `<thead><tr>${AC_FIELDS.map(([, l]) => `<th>${l}</th>`).join("")}<th class="num">Flights</th></tr></thead><tbody>${list.map((a) =>
    `<tr data-id="${esc(a.AircraftID)}">${AC_FIELDS.map(([f, label, opts]) => {
      const v = a[f];
      if (f === "AircraftID") return `<th>${esc(v)}</th>`;
      if (typeof v === "boolean") return `<td class="cb"><input type="checkbox" data-f="${f}" aria-label="${label}"${v ? " checked" : ""}></td>`;
      if (opts) return `<td><select data-f="${f}" aria-label="${label}"><option value=""></option>${opts.map((o) =>
        `<option value="${o}"${o === v ? " selected" : ""}>${esc(CLASSES[o] || o)}</option>`).join("")}</select></td>`;
      return `<td><input data-f="${f}" value="${esc(v)}" aria-label="${label}" placeholder="${f === "TypeCode" ? "C172" : ""}"></td>`;
    }).join("")}<td class="num">${a.flights}</td></tr>`).join("")}</tbody>`;
}
$("#aircraft").addEventListener("input", (e) => {
  const el = e.target, id = el.closest("tr")?.dataset.id;
  if (!id || !el.dataset.f) return;
  const current = deriveAircraft(computed.rows, state.aircraft).find((a) => a.AircraftID === id);
  const { flights, ...fields } = current;
  state.aircraft[id] = { ...fields, [el.dataset.f]: el.type === "checkbox" ? el.checked : el.value };
  save();
});

// ---------- export / import ----------
// Two-tap confirmation built into the button (the Claude viewer blocks confirm()).
function armed(btn, label) {
  if (btn.dataset.armed) return true;
  const original = btn.textContent;
  btn.dataset.armed = "1";
  btn.textContent = label;
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = original; }, 4000);
  return false;
}
async function download(name, text, type) {
  if (downloads) {
    try { await downloads.save({ filename: name, data: new Blob([text], { type }) }); } catch { /* declined */ }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const today = () => new Date().toISOString().slice(0, 10);
$("#export").addEventListener("click", () => {
  const errors = computed.pages.reduce((n, cp) => n + cp.issues.filter((l) => l.some((i) => i.level === "error")).length, 0);
  if (errors && !armed($("#export"), `${errors} row${errors > 1 ? "s" : ""} with errors — tap again to export anyway`)) return;
  const aircraft = deriveAircraft(computed.rows, state.aircraft);
  download(`foreflight-import-${today()}.csv`, buildForeFlightCsv(aircraft, computed.rows), "text/csv");
});
$("#save").addEventListener("click", () => download(`ferry-flight-${today()}.json`, JSON.stringify({ app: "ferry-flight", ...state }, null, 1), "application/json"));
$("#load").addEventListener("change", async (e) => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(data.pages)) throw new Error();
    state = { settings: { ...state.settings, ...data.settings }, pages: data.pages, aircraft: data.aircraft || {} };
    aircraftKey = "";
    save(); initSettings(); renderPages(); renderReview();
  } catch { $("#export-status").textContent = "That file isn't a Ferry Flight save."; }
  e.target.value = "";
});
$("#clear").addEventListener("click", () => {
  if (!armed($("#clear"), "Tap again to clear everything")) return;
  state = { settings: state.settings, pages: [], aircraft: {} };
  images.clear();
  aircraftKey = "";
  save(); renderPages(); renderReview();
});

// ---------- photo viewer ----------
const viewer = $("#viewer");
function showPhoto(id) {
  const img = images.get(id);
  if (!img) return;
  viewer.querySelector("img").src = img.url;
  viewer.showModal();
}
viewer.addEventListener("click", (e) => { if (e.target === viewer || e.target.tagName === "BUTTON") viewer.close(); });

load();
initSettings();
renderPages();
renderReview();
