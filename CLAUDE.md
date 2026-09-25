# Pilot Debug's Hangar — personal prototype workshop

This is Pilot Debug's personal sandbox and workshop: where their "million-dollar ideas" rest
on the runway, get shaped, and come to life, built in conversation with Claude. Each
prototype is a small static web app in `projects/`, previewed on the Hangar site (Netlify),
tweaked through more conversations, and eventually "graduated" into its own repo and
deployment. Speed and a working, good-looking result matter more than architecture.

Pilot Debug's ideas span aviation and drones, cars and mobility, home robotics, gaming and
esports, making and manufacturing, markets, and civic tech. Many are years old: some already
exist in the world, some need shaping. Be a candid, encouraging co-founder about them.

## Skills (slash commands)

- `/prototype <name> — <what it does>` — new project from an idea, through to a PR.
- `/tweak <slug> <change>` — change an existing project.
- `/ship` — merge PRs into `develop`, then promote `develop` → `main` (deploys the site).
- `/graduate <slug>` — export a project to its own repo + Netlify site.
- `/idea <idea>` — park an idea in `IDEAS.md` (the "runway").
- `/shape <idea>` — talk a raw idea through: interpretations, prior art, the angle, the hard
  part, and a buildable first slice. Updates its `IDEAS.md` entry.

## Layout

- `projects/<slug>/` — web prototypes. `project.json` holds `title`, `tagline`, `stage`
  (`prototype` → `active` → `graduated`, or `shelved`), `tags`, `created`, `links`
  (`live`, `repo`), and `next` (follow-ups shown as one-click tweak prompts). Served at
  `/p/<slug>/`. Created from `templates/project/`.
- `IDEAS.md` — the runway. Each `## ` heading is an idea with a pitch and field lines:
  `Status:` (`raw` / `shaped` / `exists` / `building`), `Category:`, `Prior art:`, `Angle:`,
  `First slice:`, `Project:`, `Tags:`. The format is described at the top of the file and
  parsed by `site/ideas.mjs` (tested by `site/ideas.test.mjs`, which also validates the real
  file). Keep the owner's original wording in titles. When a first slice gets built, the idea
  stays on the runway with `Status: building` and `Project: <slug>`.
- `labs/<lang>/<name>/` — small language experiments (`python`, `node`, `go`, `rust`,
  `cpp`, `web`); `labs/<lang>/hello/` is each language's template.
- `scripts/lab.sh <run|test> <dir>` — the **only** place that knows how to run and test
  each kind of directory. `test-all.sh` and the site build both call it.
- `site/` — the Hangar site. `build.mjs` (Node stdlib only) scans everything, runs tests,
  collects git history, and writes `site/dist/` (gitignored). `site/src/` is the front end.
- `scratch/` — gitignored throwaway space (graduation exports land in `scratch/graduated/`).

## Commands

- `make test` — every project's and lab's tests; `make test LAB=projects/e6b` for one.
- `make project NAME=slug [TITLE="Name"]` — scaffold a prototype.
- `make new LANG=go NAME=foo` — scaffold a language lab.
- `make graduate NAME=slug` — export a project as a standalone repo folder.
- `make site` / `make serve` — build the site / build and serve it on :8000.

## Project conventions

- Static files only: no bundler, no build step, no `node_modules`. CDN libraries only from
  cdnjs or jsdelivr, and only when they clearly earn their place.
- Logic in pure ES modules (no DOM), tested with `node --test` (`*.test.js`). The project's
  `package.json` just sets `"type": "module"`.
- Light and dark mode via `prefers-color-scheme`; works at 390px with no horizontal scroll.
- `localStorage` for user data, always inside try/catch; offer CSV/JSON export when the
  data matters to the user.
- Never commit API keys or secrets. Keyed APIs → sample data plus a README note.
- Aviation tools compute from standard rules of thumb, and must say plainly that they're
  not for flight planning. Never invent aircraft-specific numbers (weights, arms, limits):
  use obvious placeholders the owner replaces.
- Before a PR: tests pass, and you've looked at Playwright screenshots of the page at
  desktop and phone widths in both colour schemes.

## Labs conventions

- Every lab has at least one test, using stdlib runners only: `unittest`, `node --test`,
  `go test`, `cargo test`, and assert-style `test_*.cpp` for C++.
- Programs run during the Netlify build: fast, deterministic, no network, no input.
- New language: add `labs/<lang>/hello/`, cases in `scripts/lab.sh`, a toolchain step in
  `.github/workflows/ci.yml`, and a name and colour in `site/src/app.js` + `style.css`.

## Branches

- `main` — what Netlify deploys to the live site. Only updated by merging `develop`.
- `develop` — integration. Session branches open PRs into `develop`; Netlify deploy
  previews show each PR's version of the site.
