# Sandbox repo

A playground for quick experiments in several languages. Nothing here is production code;
favour small, self-contained, runnable experiments over shared infrastructure.

## Layout

- `labs/<lang>/<name>/` — one experiment per directory. Languages: `python`, `node`, `go`, `rust`.
  `labs/<lang>/hello/` is the template each new lab is copied from — keep it minimal.
- `scratch/` — gitignored. Put throwaway files here; they are never committed.
- `scripts/` — `test-all.sh` (runs lab tests) and `new.sh` (scaffolds a lab).

## Commands

- `make test` — run every lab's tests. `make test LAB=labs/go/foo` for one lab.
- `make new LANG=python NAME=foo` — create `labs/python/foo` from the template.
- `make clean` — remove build output and empty `scratch/`.

## Conventions

- Every lab must have at least one test, and `make test` must pass before committing.
- No external dependencies unless the experiment is *about* that dependency. Stdlib test
  runners only: `unittest` (Python), `node --test`, `go test`, `cargo test`.
- If a lab needs dependencies, keep them inside the lab (its own `requirements.txt`,
  `package.json`, `go.mod`, or `Cargo.toml`) and add a short `README.md` to that lab.
- To support a new language, add `labs/<lang>/hello/` and a case in `scripts/test-all.sh`,
  plus the toolchain setup step in `.github/workflows/ci.yml`.
