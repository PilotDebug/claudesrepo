---
name: prototype
description: Build a new web prototype in projects/ from an idea — scaffold it, implement it with tests, check it in a real browser, and open a PR to develop. Use when the user wants to prototype, build, or try out a new project idea in the Hangar sandbox.
argument-hint: <name> — <what it does>
---

# Prototype a new project

The idea: $ARGUMENTS

If it's too vague to build anything sensible (no clear "what it does"), ask one short
question first. Otherwise make reasonable calls and note them in the README.

## 1. Set up

- If the idea matches a `## ` heading in `IDEAS.md`, use that pitch and remove the entry
  from `IDEAS.md` in the same change — it's leaving the runway.
- Choose a short kebab-case slug, then `make project NAME=<slug> TITLE="<Title>"`.
- Fill in `projects/<slug>/project.json`: `tagline` (one line, shown on cards), `tags`,
  `stage: "prototype"`, and `next`: 2–4 concrete follow-ups a user could click to request.

## 2. Build the first working version

- Plain static files: `index.html`, `app.js`, `style.css`, plus pure ES modules for logic.
  No bundler or build step. A CDN library (cdnjs or jsdelivr only) is fine when it clearly
  earns its place, e.g. a chart or map library.
- Put logic in pure modules (no DOM) and cover it with `*.test.js` using `node --test`.
  Test real behaviour with hand-worked expected values, not just "it runs".
- Must work in light and dark mode (`prefers-color-scheme`) and at 390px wide with no
  horizontal scroll. Persist user data in `localStorage`, wrapped in try/catch.
- Never put API keys or secrets in the page. If the idea needs a keyed API, prototype on
  bundled sample data and note in the README what a serverless function would need.
- Replace the template's greeting code entirely. Rewrite the README: what it is, how to
  use it, and notes on decisions.

## 3. Verify like a user would

1. `make test LAB=projects/<slug>` must pass.
2. `make site`, serve `site/dist` (e.g. `python3 -m http.server -d site/dist 8000` in the
   background), and screenshot `/p/<slug>/index.html` with Playwright (Chromium is
   preinstalled; use `/opt/node22/lib/node_modules/playwright`) at 1280px and 390px, in
   light and dark. Exercise the main interaction. Look at the screenshots and fix anything
   broken, clipped, or ugly. Check for page errors.

## 4. Hand it over

- Commit on the session's working branch, push, and open a PR **into `develop`** titled
  `Prototype: <Title>`. In the body, say what it does, the key decisions, and that the
  Netlify deploy preview shows it at `/p/<slug>/` (and in Hangar at `#/p/<slug>`).
- Reply with a short summary, the PR link, and 2–3 ideas for the next tweak.
