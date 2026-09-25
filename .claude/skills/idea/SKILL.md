---
name: idea
description: Park a project idea on the Hangar runway (IDEAS.md) without building it yet. Use when the user has an idea to save for later.
argument-hint: <the idea>
---

# Add an idea to the runway

Idea: $ARGUMENTS

Append a new entry to `IDEAS.md`, following the format described at the top of the file:

```
## <Short title, in the owner's words>

<2–3 sentence pitch: what it does, who it's for. If it's ambiguous, end with
"Open question: …".>

Status: raw
Category: <one of the categories listed at the top of IDEAS.md>
Prior art: <what already exists, if you know; omit if unsure>
First slice: <smallest buildable web prototype, if one is obvious>
Tags: <tag>, <tag>
```

If what they describe clearly already exists, say so kindly and use `Status: exists` with an
`Angle:` line for what's still open.

Reuse existing tags where they fit. Commit it on the session's branch, push, and open a PR
into `develop` (or add it to an open one). Reply with the entry, and offer to `/shape` it or
`/prototype` its first slice.
