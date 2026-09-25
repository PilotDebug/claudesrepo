// Pilot Debug's Hangar: renders manifest.json (written by site/build.mjs).
// Routes:
//   #/                          projects
//   #/p/<slug>[/tab]            one project — preview|notes|source|history|tests
//   #/runway                    idea backlog
//   #/new                       new-prototype prompt builder
//   #/labs                      language labs
//   #/labs/<lang>/<name>[/tab]  one lab — demo|output|source|readme|tests

const CLAUDE_URL = "https://claude.ai/code";
const LANGS = { web: "Web", python: "Python", node: "Node", go: "Go", rust: "Rust", cpp: "C++" };
const STAGES = {
  idea: "Idea", prototype: "Prototype", active: "Active", graduated: "Graduated", shelved: "Shelved",
};
const HLJS_LANG = {
  py: "python", js: "javascript", mjs: "javascript", ts: "typescript", go: "go", rs: "rust",
  cpp: "cpp", cc: "cpp", hpp: "cpp", h: "cpp", c: "c", html: "xml", css: "css", json: "json",
  toml: "ini", mod: "go", md: "markdown", sh: "bash", yml: "yaml", yaml: "yaml", svg: "xml",
};
const VIEWPORTS = { desktop: ["Desktop", null], tablet: ["Tablet", 820], phone: ["Phone", 390] };

const state = { manifest: null, query: "", viewport: "desktop", runway: { status: null, category: null } };
const $ = (id) => document.getElementById(id);

// ---------- templating ----------

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
const attr = (cond, name) => raw(cond ? name : "");

// Just enough inline markdown for one-line descriptions: `code`.
const inline = (text) => raw(esc(text).replace(/`([^`]+)`/g, "<code>$1</code>"));

function markdown(md) {
  return window.marked ? raw(window.marked.parse(md)) : h`<pre>${md}</pre>`;
}

function highlight(code, file) {
  const ext = file.split(".").pop().toLowerCase();
  const lang = HLJS_LANG[ext] || (file.endsWith("Makefile") ? "makefile" : null);
  if (window.hljs && lang && hljs.getLanguage(lang)) {
    return raw(hljs.highlight(code, { language: lang, ignoreIllegals: true }).value);
  }
  return code;
}

// ---------- small helpers ----------

function ago(iso) {
  if (!iso) return "not committed yet";
  const s = (Date.now() - new Date(iso)) / 1000;
  for (const [unit, n] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (s >= n) { const v = Math.floor(s / n); return `${v} ${unit}${v > 1 ? "s" : ""} ago`; }
  }
  return "just now";
}

const STATUS_LABEL = {
  passed: "tests pass", failed: "tests fail", timeout: "timed out", skipped: "no tests run",
  ok: "ran ok", error: "exited with error",
};
const badge = (cls, label) => h`<span class="badge ${cls}">${label}</span>`;
const statusBadge = (s) => badge(s, STATUS_LABEL[s] || s);
const stageBadge = (s) => badge(`stage-${s}`, STAGES[s] || s);
const langName = (l) => LANGS[l] || l;
const langStyle = (l) => `--lang: var(--lang-${l}, var(--muted))`;
const commitUrl = (hash) => `${state.manifest.repo}/commit/${hash}`;

function matches(...fields) {
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  return fields.flat().some((f) => f && String(f).toLowerCase().includes(q));
}

async function copy(text, button) {
  const label = button.textContent;
  try { await navigator.clipboard.writeText(text); button.textContent = "Copied ✓"; }
  catch { button.textContent = "Select & copy manually"; }
  setTimeout(() => { button.textContent = label; }, 1800);
}

// ---------- prompts for Claude ----------

const prompts = {
  tweak: (p, change) => `/tweak ${p.slug} ${change.trim() || "<describe the change>"}`,
  build: (idea) => `/prototype ${idea.title} — first slice: ${idea.firstSlice || idea.pitch}`,
  shape: (idea) => `/shape ${idea.title}`,
  fresh: ({ name, pitch, audience, musts }) => [
    `/prototype ${name.trim() || "<name>"} — ${pitch.trim() || "<what it does>"}`,
    audience.trim() && `Who it's for: ${audience.trim()}`,
    musts.trim() && `Must have:\n${musts.trim().split("\n").filter(Boolean).map((l) => `- ${l.replace(/^[-*]\s*/, "")}`).join("\n")}`,
  ].filter(Boolean).join("\n\n"),
};

function promptBox(id, text) {
  return h`
    <div class="prompt">
      <pre id="${id}">${text}</pre>
      <div class="prompt-actions">
        <button class="btn primary" data-copy="${id}">Copy prompt</button>
        <a class="btn" href="${CLAUDE_URL}" target="_blank" rel="noopener">Open Claude Code ↗</a>
      </div>
    </div>`;
}

function bindCopy(root = document) {
  for (const b of root.querySelectorAll("[data-copy]")) {
    b.addEventListener("click", () => copy($(b.dataset.copy).textContent, b));
  }
}

// ---------- home: projects ----------

function thumb(p) {
  return p.url
    ? h`<div class="thumb" aria-hidden="true"><iframe src="${p.url}" loading="lazy" tabindex="-1" title=""></iframe></div>`
    : h`<div class="thumb empty-thumb" aria-hidden="true">No preview</div>`;
}

const projectCard = (p) => h`
  <a class="pcard" href="#/p/${p.slug}">
    ${thumb(p)}
    <div class="pcard-body">
      <div class="row">${stageBadge(p.stage)}${p.test.status === "failed" ? statusBadge("failed") : ""}</div>
      <h3>${p.title}</h3>
      <p>${inline(p.tagline || "")}</p>
      <div class="row tags">${p.tags.map((t) => h`<span class="tag">#${t}</span>`)}
        <span class="when">${ago(p.updated)}</span></div>
    </div>
  </a>`;

function renderHome() {
  const { projects, ideas, labs } = state.manifest;
  const count = (s) => projects.filter((p) => p.stage === s).length;
  const shown = projects
    .filter((p) => matches(p.title, p.tagline, p.tags, p.slug, p.stage))
    .sort((a, b) => (a.stage === "shelved") - (b.stage === "shelved") || (b.updated || "9").localeCompare(a.updated || "9"));
  const ready = ideas.map((idea, i) => [idea, i]).filter(([x]) => x.status === "shaped" && x.firstSlice).slice(0, 3);
  const pipeline = [
    ["Ideas", ideas.filter((x) => x.status !== "building").length, "#/runway"], ["Prototyping", count("prototype"), null],
    ["Active", count("active"), null], ["Graduated", count("graduated"), null],
  ];

  $("view").innerHTML = h`
    <section class="page">
      <div class="hero">
        <div>
          <p class="eyebrow">Pilot Debug's</p>
          <h1>Hangar</h1>
          <p>Where million-dollar ideas rest, get shaped, and come to life — built in conversation with
             Claude, previewed live, and graduated when they're ready to fly on their own.</p>
        </div>
        <ol class="pipeline" aria-label="Project pipeline">
          ${pipeline.map(([label, n, href]) => h`<li>${href ? raw(`<a href="${href}">`) : ""}
            <b>${n}</b><span>${label}</span>${href ? raw("</a>") : ""}</li>`)}
        </ol>
      </div>
      <div class="section-head"><h2>Projects</h2><a class="btn" href="#/new">+ New prototype</a></div>
      ${shown.length ? h`<div class="pgrid">${shown.map(projectCard)}</div>`
        : h`<div class="empty">${projects.length ? "No projects match your search." : "No projects yet — start one from the Runway or + New."}</div>`}

      ${ready.length ? h`
        <div class="section-head"><div><h2>Cleared for takeoff</h2>
          <p class="muted small">Shaped ideas with a first slice ready to build.</p></div>
          <a href="#/runway">All ${ideas.length} ideas →</a></div>
        <div class="igrid">${ready.map(([idea, i]) => ideaCard(idea, i))}</div>` : ""}

      <div class="section-head"><h2>Labs</h2><a href="#/labs">All ${labs.length} labs →</a></div>
      <p class="muted small">Small language experiments — ${Object.keys(LANGS).filter((l) => labs.some((x) => x.lang === l)).map(langName).join(", ")}.</p>
    </section>`;
  bindCopy();
  bindIdeas(ideas);
}

// ---------- project page ----------

const PROJECT_TABS = { preview: "Preview", notes: "Notes", source: "Source", history: "History", tests: "Tests" };

function renderProject(p, tab) {
  if (!PROJECT_TABS[tab]) tab = p.url ? "preview" : "notes";
  const { live, repo } = p.links;

  $("view").innerHTML = h`
    <article class="project">
      <header class="phead">
        <a class="crumb" href="#/">← Projects</a>
        <div class="phead-row">
          <div>
            <h1>${p.title}</h1>
            <p>${inline(p.tagline || "")}</p>
            <div class="row">
              ${stageBadge(p.stage)} ${statusBadge(p.test.status)}
              ${p.tags.map((t) => h`<span class="tag">#${t}</span>`)}
              <span class="muted small">updated ${ago(p.updated)} · ${p.history.length} commit${p.history.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div class="phead-actions">
            ${live ? h`<a class="btn" href="${live}" target="_blank" rel="noopener">Live site ↗</a>` : ""}
            ${repo ? h`<a class="btn" href="${repo}" target="_blank" rel="noopener">Repo ↗</a>` : ""}
            ${p.url ? h`<a class="btn" href="${p.url}" target="_blank" rel="noopener">Open full screen ↗</a>` : ""}
          </div>
        </div>
      </header>
      <nav class="tabs">${Object.entries(PROJECT_TABS).map(([t, label]) =>
        h`<a href="#/p/${p.slug}/${t}" ${attr(t === tab, 'aria-current="page"')}>${label}${
          t === "history" ? h` <span class="count">${p.history.length}</span>` : ""}</a>`)}
      </nav>
      <section class="panel" id="panel"></section>
    </article>`;

  const panel = $("panel");
  if (tab === "preview") renderPreview(panel, p);
  else if (tab === "notes") renderNotes(panel, p);
  else if (tab === "source") renderSource(panel, p.files);
  else if (tab === "history") renderHistory(panel, p);
  else renderConsole(panel, p.test, `scripts/lab.sh test ${p.path}`);
}

function renderPreview(panel, p) {
  if (!p.url) { panel.innerHTML = h`<p class="muted">This project has no index.html to preview.</p>`; return; }
  const width = VIEWPORTS[state.viewport][1];
  panel.innerHTML = h`
    <div class="workbench">
      <div class="stage-col">
        <div class="toolbar">
          <div class="seg" role="group" aria-label="Viewport">${Object.entries(VIEWPORTS).map(([k, [label]]) =>
            h`<button data-vp="${k}" aria-pressed="${k === state.viewport}">${label}</button>`)}</div>
          <span class="muted small url">/${p.url.replace(/index\.html$/, "")}</span>
          <button class="btn" id="reload" title="Reload preview">↻ Reload</button>
        </div>
        <div class="device ${state.viewport}">
          <iframe id="frame" src="${p.url}" title="${p.title} preview" style="${width ? `width:${width}px` : ""}"></iframe>
        </div>
      </div>
      <aside class="tweak" aria-labelledby="tweak-title">
        <h2 id="tweak-title">Tweak with Claude</h2>
        <p class="muted small">Describe a change, copy the prompt, and paste it into a Claude Code session on this repo.
          Claude makes the change on a branch and opens a PR — Netlify posts a preview link to it.</p>
        <textarea id="change" rows="4" placeholder="e.g. Add a fuel-planning card that uses the time enroute"></textarea>
        <div class="chips">${[
          "Make it work well on a phone", "Polish the visual design", "Add tests for edge cases", "Fix: ",
        ].map((c) => h`<button class="chip" data-chip="${c}">${c}</button>`)}</div>
        ${p.next.length ? h`<h3>Planned next steps</h3>
          <ul class="next">${p.next.map((n) => h`<li><button class="linkish" data-chip="${n}">${n}</button></li>`)}</ul>` : ""}
        ${promptBox("tweak-prompt", prompts.tweak(p, ""))}
      </aside>
    </div>`;

  const change = $("change");
  const update = () => { $("tweak-prompt").textContent = prompts.tweak(p, change.value); };
  change.addEventListener("input", update);
  for (const c of panel.querySelectorAll("[data-chip]")) {
    c.addEventListener("click", () => {
      change.value = c.dataset.chip;
      change.focus(); update();
    });
  }
  for (const b of panel.querySelectorAll("[data-vp]")) {
    b.addEventListener("click", () => { state.viewport = b.dataset.vp; renderPreview(panel, p); });
  }
  $("reload").addEventListener("click", () => { $("frame").src = p.url; });
  bindCopy(panel);
}

function renderNotes(panel, p) {
  panel.innerHTML = h`
    <div class="notes">
      <div class="readme">${p.readme ? markdown(p.readme) : h`<p class="muted">No README yet.</p>`}</div>
      <aside class="facts">
        <dl>
          <dt>Stage</dt><dd>${stageBadge(p.stage)}</dd>
          <dt>Created</dt><dd>${p.created || "—"}</dd>
          <dt>Path</dt><dd><code>${p.path}</code></dd>
          <dt>Files</dt><dd>${p.files.length}</dd>
        </dl>
        ${p.next.length ? h`<h3>Next steps</h3><ul>${p.next.map((n) => h`<li>${n}</li>`)}</ul>` : ""}
        ${p.stage !== "graduated" ? h`<h3>Ready to fly solo?</h3>
          <p class="small muted">Graduating exports the project as its own repo and Netlify site.</p>
          ${promptBox("grad-prompt", `/graduate ${p.slug}`)}` : ""}
      </aside>
    </div>`;
  bindCopy(panel);
}

function renderHistory(panel, p) {
  if (!p.history.length) { panel.innerHTML = h`<p class="muted">No commits yet — this project hasn't been committed.</p>`; return; }
  panel.innerHTML = h`
    <ol class="timeline">${p.history.map((c) => h`
      <li>
        <a class="hash" href="${commitUrl(c.hash)}" target="_blank" rel="noopener"><code>${c.hash}</code></a>
        <span class="subject">${c.subject}</span>
        <time datetime="${c.date}" title="${new Date(c.date).toLocaleString()}">${ago(c.date)}</time>
      </li>`)}
    </ol>`;
}

function renderConsole(panel, r, cmd) {
  panel.innerHTML = h`
    <div class="console-head">${statusBadge(r.status)}<code>$ ${cmd}</code>
      ${r.ms != null ? h`<span>· ${(r.ms / 1000).toFixed(2)}s at build time</span>` : ""}</div>
    <pre class="console">${r.output || "(no output)"}</pre>`;
}

function renderSource(panel, files, index = 0) {
  if (!files.length) { panel.innerHTML = h`<p class="muted">No source files.</p>`; return; }
  const file = files[index];
  panel.innerHTML = h`
    <div class="source">
      <div class="files">${files.map((f, i) => h`
        <button data-i="${i}" aria-pressed="${i === index}" title="${f.path}">${f.path}</button>`)}
      </div>
      <div class="code">
        <div class="code-head"><span>${file.path} · ${file.size.toLocaleString()} bytes</span>
          ${file.content != null ? h`<button id="copy-src">Copy</button>` : ""}</div>
        ${file.binary ? h`<pre class="muted">Binary file not shown.</pre>`
                      : h`<pre><code class="hljs">${highlight(file.content, file.path)}</code></pre>`}
      </div>
    </div>`;
  for (const b of panel.querySelectorAll(".files button")) {
    b.addEventListener("click", () => renderSource(panel, files, Number(b.dataset.i)));
  }
  $("copy-src")?.addEventListener("click", (e) => copy(file.content, e.target));
}

// ---------- runway (ideas) ----------

const IDEA_STATUS = {
  building: ["Building", "Now a project in the Hangar"],
  shaped: ["Shaped", "Clear enough to build a first slice"],
  raw: ["Raw", "Needs shaping before it can be built"],
  exists: ["Out there", "Something like it exists; the value is in the angle"],
};
const STATUS_ORDER = Object.keys(IDEA_STATUS);
const ideaBadge = (s) => h`<span class="badge idea-${s}" title="${IDEA_STATUS[s][1]}">${IDEA_STATUS[s][0]}</span>`;

function ideaCard(idea, i) {
  const project = idea.project && state.manifest.projects.find((p) => p.slug === idea.project);
  const canBuild = idea.firstSlice && idea.status !== "building";
  return h`
    <article class="icard status-${idea.status}">
      <div class="row">${ideaBadge(idea.status)}<span class="cat">${idea.category}</span></div>
      <h3>${idea.title}</h3>
      <p class="pitch">${idea.pitch}</p>
      ${idea.firstSlice ? h`<p class="slice"><b>First slice</b> ${idea.firstSlice}</p>` : ""}
      ${idea.priorArt || idea.angle ? h`
        <details class="prior">
          <summary>${idea.status === "exists" ? "What's out there" : "Prior art"}${idea.angle ? " & the angle" : ""}</summary>
          ${idea.priorArt ? h`<p>${idea.priorArt}</p>` : ""}
          ${idea.angle ? h`<p><b>Angle:</b> ${idea.angle}</p>` : ""}
        </details>` : ""}
      <div class="icard-actions">
        ${project ? h`<a class="btn primary" href="#/p/${project.slug}">Open project →</a>` : ""}
        ${canBuild ? h`<button class="btn ${idea.status === "shaped" ? "primary" : ""}" data-build="${i}">Build first slice</button>` : ""}
        ${idea.status !== "building" ? h`<button class="btn ${idea.status === "raw" ? "primary" : ""}" data-shape="${i}">Shape it</button>` : ""}
      </div>
    </article>`;
}

function bindIdeas(ideas) {
  for (const b of document.querySelectorAll("[data-build]")) {
    b.addEventListener("click", () => copy(prompts.build(ideas[Number(b.dataset.build)]), b));
  }
  for (const b of document.querySelectorAll("[data-shape]")) {
    b.addEventListener("click", () => copy(prompts.shape(ideas[Number(b.dataset.shape)]), b));
  }
}

function renderRunway() {
  const { ideas } = state.manifest;
  const f = state.runway;
  const byStatus = (s) => ideas.filter((x) => x.status === s).length;
  const categories = [...new Set(ideas.map((x) => x.category))].sort();
  const shown = ideas.map((idea, i) => [idea, i])
    .filter(([x]) => (!f.status || x.status === f.status) && (!f.category || x.category === f.category))
    .filter(([x]) => matches(x.title, x.pitch, x.tags, x.category, x.priorArt, x.firstSlice))
    .sort(([a, ai], [b, bi]) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || ai - bi);

  $("view").innerHTML = h`
    <section class="page">
      <div class="section-head"><div><h1>Runway</h1>
        <p class="muted">${ideas.length} ideas parked in <code>IDEAS.md</code>, waiting to come to life. <b>Shape it</b> copies a
          prompt to talk a raw idea through with Claude; <b>Build first slice</b> copies a <code>/prototype</code> prompt.</p></div>
        <a class="btn" href="#/new">+ New idea</a></div>
      <div class="filters" role="group" aria-label="Filter by status">
        <button class="chip" data-status="" aria-pressed="${!f.status}">All <span class="count">${ideas.length}</span></button>
        ${STATUS_ORDER.filter(byStatus).map((s) => h`
          <button class="chip" data-status="${s}" aria-pressed="${f.status === s}">${IDEA_STATUS[s][0]} <span class="count">${byStatus(s)}</span></button>`)}
      </div>
      <div class="filters" role="group" aria-label="Filter by category">
        <button class="chip small-chip" data-category="" aria-pressed="${!f.category}">Every category</button>
        ${categories.map((c) => h`
          <button class="chip small-chip" data-category="${c}" aria-pressed="${f.category === c}">${c} <span class="count">${ideas.filter((x) => x.category === c).length}</span></button>`)}
      </div>
      ${shown.length ? h`<div class="igrid">${shown.map(([idea, i]) => ideaCard(idea, i))}</div>`
        : h`<div class="empty">${ideas.length ? "No ideas match these filters." : "The runway is clear. Add ideas to IDEAS.md or use /idea in Claude Code."}</div>`}
    </section>`;

  for (const c of document.querySelectorAll("[data-status]")) {
    c.addEventListener("click", () => { f.status = c.dataset.status || null; renderRunway(); });
  }
  for (const c of document.querySelectorAll("[data-category]")) {
    c.addEventListener("click", () => { f.category = c.dataset.category || null; renderRunway(); });
  }
  bindIdeas(ideas);
}

// ---------- new prototype ----------

function renderNew() {
  $("view").innerHTML = h`
    <section class="page narrow">
      <h1>New prototype</h1>
      <p class="muted">Sketch the idea; this builds a prompt for Claude Code. Claude scaffolds <code>projects/&lt;slug&gt;/</code>,
        builds a first working version with tests, checks it in a browser, and opens a PR to <code>develop</code>.</p>
      <form id="new-form" class="form">
        <label>Name <input name="name" placeholder="METAR decoder" autocomplete="off"></label>
        <label>What should it do? <textarea name="pitch" rows="3" placeholder="Paste a raw METAR and get a plain-English breakdown with flight category colours."></textarea></label>
        <label>Who's it for? <input name="audience" placeholder="Me, during preflight on my phone"></label>
        <label><span>Must-haves <span class="hint muted small">(one per line)</span></span>
          <textarea name="musts" rows="4" placeholder="Works offline&#10;Big readable text&#10;Highlights gusts over 15 kt"></textarea></label>
      </form>
      ${promptBox("new-prompt", prompts.fresh({ name: "", pitch: "", audience: "", musts: "" }))}
      <p class="muted small">Not ready to build? Use <code>/idea</code> instead of <code>/prototype</code> to park it on the Runway.</p>
    </section>`;
  const form = $("new-form");
  form.addEventListener("input", () => {
    $("new-prompt").textContent = prompts.fresh(Object.fromEntries(new FormData(form)));
  });
  bindCopy();
}

// ---------- labs ----------

const labCard = (lab) => h`
  <a class="card" href="#/labs/${lab.id}" style="${langStyle(lab.lang)}">
    <div class="row"><span class="badge lang">${langName(lab.lang)}</span>${lab.demo ? badge("demo", "live demo") : ""}</div>
    <h3>${lab.title}</h3>
    <p>${lab.description ? inline(lab.description) : `${lab.files.length} files`}</p>
    <div class="row">${statusBadge(lab.test.status)}<span class="when">${ago(lab.updated)}</span></div>
  </a>`;

function renderLabs() {
  const { labs } = state.manifest;
  const shown = labs.filter((l) => matches(l.title, l.name, l.lang, langName(l.lang), l.description))
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  $("view").innerHTML = h`
    <section class="page">
      <h1>Labs</h1>
      <p class="muted">Language experiments in <code>labs/</code>. Each one's program and tests run at build time.
        Start one with <code>make new LANG=go NAME=idea</code>.</p>
      ${shown.length ? h`<div class="grid">${shown.map(labCard)}</div>` : h`<div class="empty">No labs match.</div>`}
    </section>`;
}

const LAB_TABS = { demo: "Demo", output: "Output", source: "Source", readme: "README", tests: "Tests" };

function renderLab(lab, tab) {
  const tabs = [];
  if (lab.demo) tabs.push("demo");
  if (lab.run.status !== "skipped" || !lab.demo) tabs.push("output");
  tabs.push("source");
  if (lab.readme) tabs.push("readme");
  tabs.push("tests");
  if (!tabs.includes(tab)) tab = tabs[0];

  $("view").innerHTML = h`
    <article class="project" style="${langStyle(lab.lang)}">
      <header class="phead">
        <a class="crumb" href="#/labs">← Labs</a>
        <h1>${lab.title}</h1>
        ${lab.description ? h`<p>${inline(lab.description)}</p>` : ""}
        <div class="row">
          <span class="badge lang">${langName(lab.lang)}</span> ${statusBadge(lab.test.status)}
          <code class="small muted">${lab.path}</code>
          <span class="muted small">· updated ${ago(lab.updated)}</span>
        </div>
      </header>
      <nav class="tabs">${tabs.map((t) => h`
        <a href="#/labs/${lab.id}/${t}" ${attr(t === tab, 'aria-current="page"')}>${LAB_TABS[t]}</a>`)}
      </nav>
      <section class="panel" id="panel"></section>
    </article>`;

  const panel = $("panel");
  if (tab === "demo") {
    panel.innerHTML = h`
      <div class="toolbar"><span></span><a class="btn" href="${lab.demo}" target="_blank" rel="noopener">Open in new tab ↗</a></div>
      <div class="device desktop"><iframe src="${lab.demo}" title="${lab.title} demo"></iframe></div>`;
  } else if (tab === "output") renderConsole(panel, lab.run, `scripts/lab.sh run ${lab.path}`);
  else if (tab === "tests") renderConsole(panel, lab.test, `scripts/lab.sh test ${lab.path}`);
  else if (tab === "readme") panel.innerHTML = h`<div class="readme">${markdown(lab.readme)}</div>`;
  else renderSource(panel, lab.files);
}

// ---------- routing ----------

function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const { projects, labs } = state.manifest;
  if (parts[0] === "p") {
    const p = projects.find((x) => x.slug === parts[1]);
    if (p) return { section: "projects", title: p.title, render: () => renderProject(p, parts[2]) };
  }
  if (parts[0] === "runway") return { section: "runway", title: "Runway", render: renderRunway };
  if (parts[0] === "new") return { section: "new", title: "New prototype", render: renderNew };
  if (parts[0] === "labs") {
    const lab = parts[2] && labs.find((l) => l.lang === parts[1] && l.name === parts[2]);
    if (lab) return { section: "labs", title: lab.title, render: () => renderLab(lab, parts[3]) };
    return { section: "labs", title: "Labs", render: renderLabs };
  }
  return { section: "projects", title: null, render: renderHome };
}

function render() {
  const r = route();
  document.title = r.title ? `${r.title} · Hangar` : "Pilot Debug's Hangar";
  for (const a of document.querySelectorAll("[data-nav]")) {
    a.toggleAttribute("aria-current", a.dataset.nav === r.section);
  }
  r.render();
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
  state.manifest.projects ??= [];
  state.manifest.ideas ??= [];
  const { commit, generatedAt, repo, branch } = state.manifest;
  $("meta").innerHTML = h`Built ${ago(generatedAt)}${commit
    ? h` from <a href="${repo}/commit/${commit}" target="_blank" rel="noopener"><code>${commit}</code></a>` : ""}${
    branch ? h` on <code>${branch}</code>` : ""} · <a href="${repo}" target="_blank" rel="noopener">GitHub</a>`;

  let pending;
  $("search").addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    clearTimeout(pending);
    pending = setTimeout(() => {
      // Searching from a detail page jumps to the matching list.
      const section = route().section;
      const list = { projects: "#/", runway: "#/runway", labs: "#/labs", new: "#/" }[section];
      if (location.hash !== list && !(list === "#/" && ["", "#", "#/"].includes(location.hash))) location.hash = list;
      else render();
    }, 120);
  });
  addEventListener("hashchange", () => { render(); scrollTo(0, 0); });
  render();
}

start();
