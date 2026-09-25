---
name: shape
description: Flesh out a raw idea from the Hangar runway (IDEAS.md) through a short back-and-forth — clarify what it is, check what already exists, find the angle, and define a buildable first slice — then update its entry. Use when the user wants to shape, flesh out, think through, or pressure-test an idea.
argument-hint: <idea title, or a new idea>
---

# Shape an idea

Idea: $ARGUMENTS

Find it in `IDEAS.md` (match the `## ` title loosely). If it isn't there, treat it as a new
idea and add it at the end when you're done.

These are the owner's own ideas, some years old. Be a candid, encouraging co-founder: take
the idea seriously, and say plainly when something already exists or the physics or
economics don't work. That's useful, not discouraging. Don't invent facts; when you're
unsure whether something exists, say so.

## Conversation (keep it short: 2–4 exchanges)

1. Restate the idea in one sentence as you understand it. If it's ambiguous (the entry's
   pitch often ends in an "Open question"), offer 2–3 concrete interpretations and ask which
   one the owner means. Wait for the answer.
2. Once it's pinned down, give:
   - **Who it's for and the problem it solves**, in one line each.
   - **What's out there**: existing products, research, or failed attempts, and what they
     teach.
   - **The angle**: what's still open, or why now.
   - **The hard part**: the one thing most likely to kill it (physics, regulation, cost,
     distribution, safety).
   - **Back-of-envelope numbers** where they decide feasibility (energy, cost, market size).
   - **First slice**: the smallest piece buildable here as a static web prototype
     (a calculator, simulator, planner, or mock-up) that teaches something real about the idea.
3. Ask if anything should change, then update the entry.

## Update IDEAS.md

Rewrite the idea's entry in the format described at the top of `IDEAS.md`: a sharper pitch,
`Status:` (`shaped` if the first slice is clear; `exists` if the angle is thin; keep `raw`
if it's still undecided), `Category:`, `Prior art:`, `Angle:`, `First slice:`, `Tags:`.
Keep the owner's original title.

Commit on the session's branch, push, and open a PR into `develop` (or add to an open one).
Finish by asking whether to `/prototype` the first slice now.
