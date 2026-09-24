# Ideas

The runway: project ideas waiting for a prototype. Each `## ` heading is one idea; the
paragraph under it is the pitch, and an optional `Tags:` line groups it. The sandbox site
shows these with a one-click prompt to hand to Claude. Delete an idea once it becomes a
project in `projects/`.

## Weight & balance for the Bearhawk

Enter empty weight and arm from the weighing, then pilot, passengers, fuel, and baggage;
plot the CG on the envelope and flag out-of-limits loadings. Needs your aircraft's real
numbers — the prototype should ship with obviously fake placeholders.

Tags: aviation, calculator

## METAR decoder

Paste a raw METAR/TAF and get a plain-English breakdown, with flight category colouring
(VFR/MVFR/IFR/LIFR) and the crosswind for a chosen runway.

Tags: aviation, weather

## Preflight checklist trainer

Flashcard-style drills for checklists and memory items, with spaced repetition so the
ones you miss come back sooner.

Tags: aviation, learning

## Market watchlist

A compact watchlist with sparklines and a daily-move heatmap. Prototype on bundled sample
data; wiring a live quote API (e.g. Alpha Vantage) needs a small serverless function to
keep the API key off the page.

Tags: finance, dashboard

## Build-task board

Kanban for the kit build — backlog of manual steps, in progress, waiting on parts, done —
with each card linking to the matching Build Log sessions.

Tags: aviation, tracker, bearhawk
