# Pilot Debug's Hangar

My personal workshop, where million-dollar ideas rest on the runway, get shaped, and come to
life as working prototypes, built in conversation with [Claude Code](https://claude.ai/code),
previewed live, and graduated into their own deployments when they're ready.

**Live site:** https://celadon-meerkat-0da244.netlify.app/

## The loop

```
 IDEAS.md (runway)
    │ /shape         talk it through, find the angle and a first slice
    ▼
 first slice
    │ /prototype     build it, test it, check it in a browser
    ▼
 projects/<slug>/ ◀──┐
    │                └─ /tweak <slug> <change>
    ▼ PR
 develop  (deploy preview)
    │ /ship
    ▼
 main  ──▶ Netlify (live)          /graduate ──▶ its own repo + site
```

1. **Idea** — park it with `/idea …`, or add it to `IDEAS.md`. The Runway page lists every
   idea with its status (Raw, Shaped, Out there, Building), prior art, and a first slice.
2. **Shape** — `/shape <idea>` talks a raw idea through with Claude: what it really is, what
   already exists, the angle, the hard part, and the smallest thing worth building.
3. **Prototype** — `/prototype METAR decoder — paste a METAR, get plain English`. Claude
   scaffolds `projects/<slug>/`, builds it with tests, checks it in a browser, and opens a PR.
4. **Tweak** — open the project in Hangar, type what should change in **Tweak with Claude**,
   and paste the generated `/tweak` prompt into a session. Planned next steps are one click.
5. **Ship** — `/ship` merges into `develop`, then `main`, and Netlify publishes.
6. **Graduate** — `/graduate <slug>` exports it as its own repo and Netlify site.

## What's in the hangar

| Project | What it does |
|---|---|
| [E6B Flight Computer](projects/e6b) | Crosswind (with runway diagram), density altitude, wind correction |
| [Kit Build Log](projects/build-log) | Shop hours by assembly and week, CSV export/import |
| [Part Studio](projects/part-studio) | Parametric flat parts (plate, bent bracket, panel), manufacturability checks, DXF/SVG export |
| [Airfoil Lab](projects/airfoil-lab) | NACA sections, thin-airfoil lift curves, design for a target Cl, Reynolds number |
| [FC Voter](projects/fc-voter) | Fault injection on three flight controllers: median voting vs master/slave |

Plus `labs/` — small experiments in Python, Node, Go, Rust, C++, and web — each shown with
its program output and test results.

## Commands

```sh
make project NAME=metar TITLE="METAR Decoder"   # scaffold a prototype
make test                                       # all project + lab tests
make serve                                      # build the site → http://localhost:8000
make graduate NAME=e6b                          # export as a standalone repo folder
make help                                       # everything else
```

## Branches and deploys

| Branch | Purpose |
|---|---|
| `main` | Production: Netlify deploys it to the live site |
| `develop` | Integration: PRs land here first |
| `claude/*` | Claude Code session branches, which open PRs into `develop` |

CI runs every test and builds the site on each PR and on pushes to `main`/`develop`.
Turn on Netlify **deploy previews** to get a preview URL on every PR.
