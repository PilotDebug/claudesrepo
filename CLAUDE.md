# Sandbox repo

A playground for quick experiments in several languages, published as a browsable gallery
website (Netlify). Nothing here is production code; favour small, self-contained, runnable
experiments over shared infrastructure.

## Layout

- `labs/<lang>/<name>/` — one experiment per directory. Languages: `python`, `node`, `go`,
  `rust`, `cpp`, `web`. `labs/<lang>/hello/` is the template each new lab is copied from — keep
  it minimal.
- `scripts/lab.sh <run|test> <lab>` — the **only** place that knows each language's run/test
  commands. `test-all.sh` and the site build both call it.
- `site/` — the gallery website. `build.mjs` (Node stdlib only) scans `labs/`, runs each lab's
  tests and program, and writes `site/dist/` (gitignored). `site/src/` is the static front end.
- `scratch/` — gitignored. Put throwaway files here; they are never committed.

## Commands

- `make test` — run every lab's tests. `make test LAB=labs/go/foo` for one lab.
- `make new LANG=python NAME=foo` — create `labs/python/foo` from the template.
- `make site` / `make serve` — build the gallery / build and serve it on :8000.
- `make clean` — remove build output, `site/dist/`, and `scratch/` contents.

## How a lab appears on the site

- **Title and summary** come from the lab's `README.md`: the `# ` heading and the first paragraph.
  Always replace the scaffolded `TODO` sentence.
- **Output tab** shows what `scripts/lab.sh run` printed at build time. Entry points:
  `main.py`, `main.js`, `go run .`, `cargo run`, `make run` (C++).
- **Tests tab** shows `scripts/lab.sh test` output; the status badge comes from its exit code.
- **Demo tab** embeds a live page: a `web` lab's `index.html`, or `demo/index.html` in any other
  lab (e.g. a visualisation of a Go lab's results). Demos are plain static files — no bundler.

## Conventions

- Every lab must have at least one test, and `make test` must pass before committing.
- No external dependencies unless the experiment is *about* that dependency. Stdlib test
  runners only: `unittest`, `node --test`, `go test`, `cargo test`, and plain assert-style
  `test_*.cpp` for C++. Web labs keep logic in ES modules so `node --test` can cover it.
- Programs run during the Netlify build: keep them fast (well under 60s), deterministic,
  and free of network access or interactive input.
- If a lab needs dependencies, keep them inside the lab and explain them in its README.
- To support a new language: add `labs/<lang>/hello/`, cases in `scripts/lab.sh`, a toolchain
  step in `.github/workflows/ci.yml`, and a name/colour in `site/src/app.js` + `style.css`.

## Branches

- `main` — what Netlify deploys. Only updated by merging `develop`.
- `develop` — integration branch. Feature branches open pull requests into `develop`.
