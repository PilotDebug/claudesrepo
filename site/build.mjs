// Builds the sandbox website ("Hangar") into site/dist.
//
// - projects/<slug>/  web prototypes: copied to dist/p/<slug>/ so each has its own
//                     URL, tested, and given a history from git log.
// - labs/<lang>/<n>/  language experiments: tests and program run via scripts/lab.sh.
// - IDEAS.md          the idea backlog.
// Everything the front end needs goes into manifest.json.
//
// Environment:
//   SANDBOX_SKIP_EXEC=1   don't run tests or programs (fast preview builds)
//   SANDBOX_TIMEOUT=60    per-command timeout in seconds

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseIdeas } from "./ideas.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const labsDir = path.join(root, "labs");
const projectsDir = path.join(root, "projects");
const srcDir = path.join(root, "site", "src");
const distDir = path.join(root, "site", "dist");

const SKIP_EXEC = process.env.SANDBOX_SKIP_EXEC === "1";
const TIMEOUT_MS = Number(process.env.SANDBOX_TIMEOUT || 60) * 1000;
const MAX_FILE_BYTES = 200_000;
const MAX_OUTPUT_BYTES = 20_000;

// Directories and files that are build output or noise, never shown or copied.
const IGNORED_DIRS = new Set(["build", "target", "node_modules", "__pycache__", ".venv", "dist"]);
const IGNORED_FILES = new Set(["Cargo.lock", "package-lock.json", ".DS_Store"]);

const ignored = (entry) =>
  entry.isDirectory() ? IGNORED_DIRS.has(entry.name) : IGNORED_FILES.has(entry.name);

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !ignored(e))
    .flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
    });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (ignored(e)) continue;
    const [src, dst] = [path.join(from, e.name), path.join(to, e.name)];
    e.isDirectory() ? copyDir(src, dst) : fs.copyFileSync(src, dst);
  }
}

function clip(text, max) {
  return text.length <= max ? text : text.slice(0, max) + `\n… (truncated, ${text.length - max} more bytes)`;
}

// Runs `scripts/lab.sh <action> <dir>` and maps the result to a status.
function exec(action, dir) {
  if (SKIP_EXEC) return { status: "skipped", output: "Not run (SANDBOX_SKIP_EXEC=1)." };
  const started = Date.now();
  const r = spawnSync(path.join(root, "scripts", "lab.sh"), [action, dir], {
    cwd: root, encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024,
  });
  const output = clip([r.stdout, r.stderr].filter(Boolean).join("\n").trimEnd(), MAX_OUTPUT_BYTES);
  const ms = Date.now() - started;
  if (r.error?.code === "ETIMEDOUT") return { status: "timeout", output, ms };
  if (r.status === 0) return { status: action === "test" ? "passed" : "ok", output, ms };
  if (r.status === 2) return { status: "skipped", output: output || "No toolchain or not applicable.", ms };
  return { status: action === "test" ? "failed" : "error", output, ms };
}

function git(...args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

// Title = first "# " heading; description = first paragraph after it.
function parseReadme(md) {
  const lines = md.split("\n");
  const h1 = lines.findIndex((l) => l.startsWith("# "));
  const title = h1 >= 0 ? lines[h1].slice(2).trim() : null;
  const para = [];
  for (const line of lines.slice(h1 + 1)) {
    if (!line.trim()) { if (para.length) break; else continue; }
    if (/^(#|```|[-*] |\|)/.test(line)) { if (para.length) break; else continue; }
    para.push(line.trim());
  }
  return { title, description: para.join(" ") };
}

function readSource(dir, rel) {
  const buf = fs.readFileSync(path.join(dir, rel));
  if (buf.subarray(0, 8000).includes(0)) return { path: rel, binary: true, size: buf.length };
  return { path: rel, size: buf.length, content: clip(buf.toString("utf8"), MAX_FILE_BYTES) };
}

// Entry points first, then tests, then everything else alphabetically.
function fileRank(p) {
  const base = path.basename(p);
  if (/^(index\.html|main\.\w+|lib\.rs)$/.test(base)) return 0;
  if (/(^test_|[._]test\.|_test\.)/.test(base)) return 2;
  return 1;
}

function buildLab(lang, name) {
  const dir = path.join(labsDir, lang, name);
  const rel = path.relative(root, dir);
  const readmePath = path.join(dir, "README.md");
  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
  const { title, description } = parseReadme(readme);

  const files = listFiles(dir)
    .filter((f) => f !== "README.md")
    .sort((a, b) => fileRank(a) - fileRank(b) || a.localeCompare(b))
    .map((f) => readSource(dir, f));

  // A live demo is a web lab's index.html, or any lab's demo/index.html.
  let demo = null;
  const demoSrc = lang === "web" ? dir : path.join(dir, "demo");
  if (fs.existsSync(path.join(demoSrc, "index.html"))) {
    copyDir(demoSrc, path.join(distDir, "demos", lang, name));
    demo = `demos/${lang}/${name}/index.html`;
  }

  process.stdout.write(`  ${rel.padEnd(28)}`);
  const test = exec("test", rel);
  const run = exec("run", rel);
  console.log(`test: ${test.status.padEnd(8)} run: ${run.status}`);

  return {
    id: `${lang}/${name}`, lang, name, path: rel,
    title: title || name, description, readme,
    updated: git("log", "-1", "--format=%cI", "--", rel) || null,
    files, demo, test, run,
  };
}

const STAGES = ["idea", "prototype", "active", "graduated", "shelved"];

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (err) {
    if (fs.existsSync(file)) console.warn(`  ! ${path.relative(root, file)}: ${err.message}`);
    return fallback;
  }
}

function history(rel, limit = 40) {
  return git("log", `-n${limit}`, "--format=%h%x1f%cI%x1f%s", "--", rel)
    .split("\n").filter(Boolean)
    .map((line) => { const [hash, date, subject] = line.split("\x1f"); return { hash, date, subject }; });
}

function buildProject(slug) {
  const dir = path.join(projectsDir, slug);
  const rel = path.relative(root, dir);
  const meta = readJSON(path.join(dir, "project.json"), {});
  const readmePath = path.join(dir, "README.md");
  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
  const fromReadme = parseReadme(readme);
  const entry = meta.entry || "index.html";

  copyDir(dir, path.join(distDir, "p", slug));
  const files = listFiles(dir)
    .filter((f) => f !== "README.md" && f !== "project.json" && f !== "package.json")
    .sort((a, b) => fileRank(a) - fileRank(b) || a.localeCompare(b))
    .map((f) => readSource(dir, f));

  process.stdout.write(`  ${rel.padEnd(28)}`);
  const test = exec("test", rel);
  console.log(`test: ${test.status}`);

  const log = history(rel);
  return {
    slug, path: rel,
    title: meta.title || fromReadme.title || slug,
    tagline: meta.tagline || fromReadme.description,
    stage: STAGES.includes(meta.stage) ? meta.stage : "prototype",
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    created: meta.created || log.at(-1)?.date?.slice(0, 10) || null,
    updated: log[0]?.date || null,
    links: meta.links || {},
    next: Array.isArray(meta.next) ? meta.next : [],
    url: fs.existsSync(path.join(dir, entry)) ? `p/${slug}/${entry}` : null,
    readme, files, test, history: log,
  };
}

function readIdeas() {
  const file = path.join(root, "IDEAS.md");
  return fs.existsSync(file) ? parseIdeas(fs.readFileSync(file, "utf8")) : [];
}

const subdirs = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  : [];

function main() {
  fs.rmSync(distDir, { recursive: true, force: true });
  copyDir(srcDir, distDir);

  console.log("Building projects:");
  const projects = subdirs(projectsDir).map(buildProject);
  console.log("Building labs:");
  const labs = subdirs(labsDir).flatMap((lang) => subdirs(path.join(labsDir, lang)).map((n) => buildLab(lang, n)));
  const ideas = readIdeas();

  const manifest = {
    generatedAt: new Date().toISOString(),
    commit: (process.env.COMMIT_REF || git("rev-parse", "HEAD")).slice(0, 7) || null,
    branch: process.env.BRANCH || git("rev-parse", "--abbrev-ref", "HEAD") || null,
    repo: process.env.REPOSITORY_URL || "https://github.com/PilotDebug/claudesrepo",
    projects, ideas, labs,
  };
  fs.writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(manifest));

  const failed = [...projects, ...labs].filter((x) => x.test.status === "failed").length;
  console.log(`\nWrote ${path.relative(root, distDir)}/ — ${projects.length} projects, ${labs.length} labs, ` +
    `${ideas.length} ideas; ${failed} with failing tests.`);
}

main();
