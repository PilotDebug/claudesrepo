# Hangar — a prototype sandbox

Where project ideas get built, in conversation with [Claude Code](https://claude.ai/code),
into working prototypes you can preview, tweak, and eventually graduate into their own
deployments.

**Live site:** https://celadon-meerkat-0da244.netlify.app/

## The loop

```
 IDEAS.md ──/prototype──▶ projects/<slug>/ ──PR──▶ develop ──/ship──▶ main ──▶ Netlify
 (runway)                   │    ▲                (preview)                   (live)
                            └────┘ /tweak <slug> <change>
                            └──────/graduate──▶ its own repo + site
```

1. **Idea** — park it with `/idea …`, or add it to `IDEAS.md`. The site's Runway page gives
   every idea a one-click "build this" prompt.
2. **Prototype** — `/prototype METAR decoder — paste a METAR, get plain English`. Claude
   scaffolds `projects/<slug>/`, builds it with tests, checks it in a browser, and opens a PR.
3. **Tweak** — open the project in Hangar, type what should change in **Tweak with Claude**,
   and paste the generated `/tweak` prompt into a session. Planned next steps are one click.
4. **Ship** — `/ship` merges into `develop`, then `main`, and Netlify publishes.
5. **Graduate** — `/graduate <slug>` exports it as its own repo and Netlify site.

## What's in the hangar

| Project | What it does |
|---|---|
| [E6B Flight Computer](projects/e6b) | Crosswind (with runway diagram), density altitude, wind correction |
| [Kit Build Log](projects/build-log) | Shop hours by assembly and week, CSV export/import |

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
