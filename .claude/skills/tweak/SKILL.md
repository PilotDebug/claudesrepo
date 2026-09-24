---
name: tweak
description: Change an existing Hangar project (projects/<slug>/) — a feature, fix, or polish pass — then test, check it in a browser, and open a PR to develop. Use when the user asks to tweak, change, fix, or extend a sandbox project.
argument-hint: <slug> <what to change>
---

# Tweak a project

Request: $ARGUMENTS

The first word is the project slug (a directory in `projects/`). If it doesn't match one,
list the projects and ask which one is meant.

1. Read the project's README, `project.json`, and code before changing anything.
2. Make the change in the project's existing style. Keep logic in pure, tested modules.
   Add or update tests for any new behaviour; fix the cause of a bug rather than
   papering over it.
3. If the change completes an item in `project.json` → `next`, remove it; add any new
   follow-ups that came up. Update the README if usage changed.
4. Verify: `make test LAB=projects/<slug>`, then `make site` and screenshot
   `/p/<slug>/index.html` with Playwright at 1280px and 390px (light and dark), exercising
   the changed behaviour. Fix what looks wrong.
5. Commit, push, and open a PR **into `develop`** (or add to the open PR for this
   project if there is one on this branch). Reply with what changed and the PR link.
