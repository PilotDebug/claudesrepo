// Sandbox site: renders manifest.json (written by site/build.mjs).
// Routes: #/                     all labs
//         #/<lang>/<name>[/tab]  one lab — tab is demo|output|source|readme|tests

const LANGS = {
  web: "Web", python: "Python", node: "Node", go: "Go", rust: "Rust", cpp: "C++",
};
const HLJS_LANG = {
  py: "python", js: "javascript", mjs: "javascript", ts: "typescript", go: "go", rs: "rust",
  cpp: "cpp", cc: "cpp", hpp: "cpp", h: "cpp", c: "c", html: "xml", css: "css", json: "json",
  toml: "ini", mod: "go", md: "markdown", sh: "bash", yml: "yaml", yaml: "yaml",
};
const TABS = { demo: "Demo", output: "Output", source: "Source", readme: "README", tests: "Tests" };

const state = { manifest: null, query: "", lang: null, current: null };
const $ = (id) => document.getElementById(id);

// ---------- helpers ----------

// Tagged template that escapes interpolated values unless they are Raw
// (the result of another h`` or raw()), so nested templates compose safely.
class Raw {
  constructor(html) { this.html = html; }
  toString() { return this.html; }
}
const raw = (html) => new Raw(html);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const part = (v) => Array.isArray(v) ? v.map(part).join("") : v instanceof Raw ? v.html : esc(v ?? "");
const h = (strings, ...values) => raw(strings.reduce((out, s, i) => out + part(values[i - 1]) + s));

// Just enough inline markdown for one-line descriptions: `code`.
const inline = (text) => raw(esc(text).replace(/`([^`]+)`/g, "<code>$1</code>"));

const langName = (l) => LANGS[l] || l;
const langStyle = (l) => `--lang: var(--lang-${l}, var(--muted))`;

function ago(iso) {
  if (!iso) return "not committed";
  const s = (Date.now() - new Date(iso)) / 1000;
  for (const [unit, n] of [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (s >= n) { const v = Math.floor(s / n); return `${v} ${unit}${v > 1 ? "s" : ""} ago`; }
  }
  return "just now";
}

const STATUS_LABEL = {
  passed: "tests pass", failed: "tests fail", timeout: "timed out", skipped: "not run",
  ok: "ran ok", error: "exited with error",
};
const badge = (status, label = STATUS_LABEL[status] || status) =>
  h`<span class="badge ${status}">${label}</span>`;

function markdown(md) {
  if (window.marked) return raw(window.marked.parse(md));
  return raw(h`<pre>${md}</pre>`);
}

function highlight(code, file) {
  const ext = file.split(".").pop().toLowerCase();
  const lang = HLJS_LANG[ext] || (file === "Makefile" ? "makefile" : null);
  if (window.hljs && lang && hljs.getLanguage(lang)) {
    return raw(hljs.highlight(code, { language: lang, ignoreIllegals: true }).value);
  }
  return code;
}

function matches(lab) {
  if (state.lang && lab.lang !== state.lang) return false;
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  return [lab.title, lab.name, lab.lang, lab.description].some((s) => s?.toLowerCase().includes(q));
}

// ---------- sidebar ----------

function renderSidebar(currentId = state.current) {
  const byLang = {};
  for (const lab of state.manifest.labs.filter(matches)) (byLang[lab.lang] ??= []).push(lab);
  const order = Object.keys(LANGS).concat(Object.keys(byLang).filter((l) => !LANGS[l]));
  $("sidebar").innerHTML = order.filter((l) => byLang[l]).map((l) => h`
    <div class="group" style="${langStyle(l)}">
      <h3><span class="swatch"></span>${langName(l)}</h3>
      ${byLang[l].sort((a, b) => a.name.localeCompare(b.name)).map((lab) => h`
        <a href="#/${lab.id}" ${raw(lab.id === currentId ? 'aria-current="page"' : "")}>
          ${lab.title}<span class="dot ${lab.test.status}" title="${STATUS_LABEL[lab.test.status]}"></span>
        </a>`)}
    </div>`).join("") || h`<p class="muted pad">No matches.</p>`;
}

// ---------- home ----------

function renderHome() {
  const { labs } = state.manifest;
  const counts = {};
  for (const lab of labs) counts[lab.lang] = (counts[lab.lang] || 0) + 1;
  const shown = labs.filter(matches)
    .sort((a, b) => (b.updated || "9").localeCompare(a.updated || "9") || a.id.localeCompare(b.id));
  const passing = labs.filter((l) => l.test.status === "passed").length;
  const demos = labs.filter((l) => l.demo).length;

  $("view").innerHTML = h`
    <section class="home">
      <h1>Sandbox</h1>
      <p>Every experiment in <code>labs/</code>, with its live demo, program output, tests, and source.</p>
      <div class="stats">
        <div class="stat"><b>${labs.length}</b><span>labs</span></div>
        <div class="stat"><b>${Object.keys(counts).length}</b><span>languages</span></div>
        <div class="stat"><b>${passing}/${labs.length}</b><span>passing tests</span></div>
        <div class="stat"><b>${demos}</b><span>live demos</span></div>
      </div>
      <div class="filters" role="group" aria-label="Filter by language">
        <button class="chip" data-lang="" aria-pressed="${!state.lang}">All <span class="count">${labs.length}</span></button>
        ${Object.keys(counts).sort().map((l) => h`
          <button class="chip" data-lang="${l}" aria-pressed="${state.lang === l}" style="${langStyle(l)}">
            <span class="swatch"></span>${langName(l)} <span class="count">${counts[l]}</span>
          </button>`)}
      </div>
      ${shown.length ? h`<div class="grid">${shown.map(card)}</div>`
                     : h`<div class="empty">No labs match. Try another search or filter.</div>`}
    </section>`;

  for (const chip of document.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => { state.lang = chip.dataset.lang || null; render(); });
  }
}

const card = (lab) => h`
  <a class="card" href="#/${lab.id}" style="${langStyle(lab.lang)}">
    <div class="row"><span class="badge lang">${langName(lab.lang)}</span>
      ${lab.demo ? badge("demo", "live demo") : ""}</div>
    <h2>${lab.title}</h2>
    <p>${lab.description ? inline(lab.description) : `${lab.files.length} files`}</p>
    <div class="row">${badge(lab.test.status)}<span class="when">${ago(lab.updated)}</span></div>
  </a>`;

// ---------- lab page ----------

function tabsFor(lab) {
  const tabs = [];
  if (lab.demo) tabs.push("demo");
  if (lab.run.status !== "skipped" || !lab.demo) tabs.push("output");
  tabs.push("source");
  if (lab.readme) tabs.push("readme");
  tabs.push("tests");
  return tabs;
}

function renderLab(lab, tab) {
  const tabs = tabsFor(lab);
  if (!tabs.includes(tab)) tab = tabs[0];

  $("view").innerHTML = h`
    <article class="lab" style="${langStyle(lab.lang)}">
      <header class="lab-head">
        <a class="crumb" href="#/">← All labs</a>
        <h1>${lab.title}</h1>
        ${lab.description ? h`<p>${inline(lab.description)}</p>` : ""}
        <div class="row">
          <span class="badge lang">${langName(lab.lang)}</span>
          ${badge(lab.test.status)}
          <code>${lab.path}</code>
          <span class="muted" style="font-size:13px">· updated ${ago(lab.updated)}</span>
        </div>
      </header>
      <nav class="tabs">${tabs.map((t) => h`
        <a href="#/${lab.id}/${t}" ${raw(t === tab ? 'aria-current="page"' : "")}>${TABS[t]}</a>`)}
      </nav>
      <section class="panel" id="panel"></section>
    </article>`;

  const panel = $("panel");
  if (tab === "demo") {
    panel.innerHTML = h`
      <div class="demo-bar"><a href="${lab.demo}" target="_blank" rel="noopener">Open in new tab ↗</a></div>
      <iframe class="demo-frame" src="${lab.demo}" title="${lab.title} demo"></iframe>`;
  } else if (tab === "output" || tab === "tests") {
    const r = tab === "output" ? lab.run : lab.test;
    const cmd = `scripts/lab.sh ${tab === "output" ? "run" : "test"} ${lab.path}`;
    panel.innerHTML = h`
      <div class="console-head">${badge(r.status)}<code>$ ${cmd}</code>
        ${r.ms != null ? h`<span>· ${(r.ms / 1000).toFixed(2)}s at build time</span>` : ""}</div>
      <pre class="console">${r.output || "(no output)"}</pre>`;
  } else if (tab === "readme") {
    panel.innerHTML = h`<div class="readme">${markdown(lab.readme)}</div>`;
  } else {
    renderSource(panel, lab);
  }
}

function renderSource(panel, lab, index = 0) {
  if (!lab.files.length) { panel.innerHTML = h`<p class="muted">No source files.</p>`; return; }
  const file = lab.files[index];
  panel.innerHTML = h`
    <div class="source">
      <div class="files">${lab.files.map((f, i) => h`
        <button data-i="${i}" aria-pressed="${i === index}" title="${f.path}">${f.path}</button>`)}
      </div>
      <div class="code">
        <div class="code-head"><span>${file.path} · ${file.size.toLocaleString()} bytes</span>
          ${file.content != null ? h`<button id="copy">Copy</button>` : ""}</div>
        ${file.binary ? h`<pre class="muted">Binary file not shown.</pre>`
                      : h`<pre><code class="hljs">${highlight(file.content, file.path)}</code></pre>`}
      </div>
    </div>`;
  for (const b of panel.querySelectorAll(".files button")) {
    b.addEventListener("click", () => renderSource(panel, lab, Number(b.dataset.i)));
  }
  $("copy")?.addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(file.content); e.target.textContent = "Copied"; }
    catch { e.target.textContent = "Copy failed"; }
  });
}

// ---------- routing ----------

function render() {
  const [lang, name, tab] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const lab = lang && name && state.manifest.labs.find((l) => l.lang === lang && l.name === name);
  state.current = lab?.id ?? null;
  renderSidebar();
  if (lab) {
    document.title = `${lab.title} · Sandbox`;
    renderLab(lab, tab);
  } else {
    document.title = "Sandbox";
    renderHome();
  }
}

async function start() {
  try {
    const res = await fetch("manifest.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.manifest = await res.json();
  } catch (err) {
    $("view").innerHTML = h`<p class="pad">Couldn't load <code>manifest.json</code> (${err.message}).
      Run <code>make site</code> to build it.</p>`;
    return;
  }
  const { commit, generatedAt, repo } = state.manifest;
  $("meta").innerHTML = h`built ${ago(generatedAt)}${commit
    ? h` from <a href="${repo}/commit/${commit}" target="_blank" rel="noopener"><code>${commit}</code></a>` : ""}`;

  let pending;
  $("search").addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    clearTimeout(pending);
    pending = setTimeout(() => {
      if (state.current) renderSidebar(); else render();
    }, 80);
  });
  addEventListener("hashchange", () => { render(); scrollTo(0, 0); });
  render();
}

start();
